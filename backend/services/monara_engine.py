"""
MonaraEngine — Gap 6, 7, 9, 11.
Synchronous streaming ReAct loop for Monara's chat interface.
Uses AsyncAnthropic with tool-use for internal App actions.
"""
import os
import json
import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, ChatSession
from services.internal_tool_executor import (
    get_tool_schemas_for_claude,
    execute_internal_tool,
    tool_requires_confirmation,
    describe_action,
)
from services.ws_manager import ws_manager

MONARA_MODEL = "claude-sonnet-4-5-20250929"
MAX_TOOL_LOOPS = 6

MONARA_SYSTEM = """You are Monara, an intelligent AI assistant built into LeadFlow AI — a B2B sales automation platform.

You help users manage their leads, campaigns, email drafts, and AI configuration. You can take real actions using the tools available to you.

Guidelines:
- Be concise. Users are busy. Lead with the result.
- For data reads, act immediately and report what you found.
- For writes (creating campaigns, approving drafts), execute and confirm.
- Destructive actions (delete, bulk-approve) are automatically gated — just call the tool.
- Format lists with bullet points. Keep explanations brief.
- If asked to do something outside your tools, say so clearly.
- Never fabricate data. If you don't know, say so."""


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _serialize_content(content) -> list:
    """Convert Anthropic SDK content blocks to plain dicts for JSON storage."""
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    result = []
    for block in content:
        if hasattr(block, "model_dump"):
            result.append(block.model_dump())
        elif isinstance(block, dict):
            result.append(block)
    return result


def _extract_text(content) -> str:
    """Pull plain text from a response content list."""
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        b = block if isinstance(block, dict) else (block.model_dump() if hasattr(block, "model_dump") else {})
        if b.get("type") == "text":
            parts.append(b.get("text", ""))
    return " ".join(parts)


class MonaraEngine:
    def __init__(self, db: AsyncSession, user: User, api_key: str):
        self.db = db
        self.user = user
        self.client = anthropic.AsyncAnthropic(api_key=api_key)

    # ── Session management ────────────────────────────────────────────────────

    async def get_or_create_session(self, session_id: Optional[str] = None) -> ChatSession:
        if session_id:
            res = await self.db.execute(
                select(ChatSession).where(
                    ChatSession.id == session_id,
                    ChatSession.user_id == self.user.id,
                )
            )
            session = res.scalar_one_or_none()
            if session:
                return session
        # Create new
        session = ChatSession(
            user_id=self.user.id,
            messages=[],
            api_history=[],
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def list_sessions(self) -> list[dict]:
        res = await self.db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == self.user.id)
            .order_by(ChatSession.updated_at.desc())
            .limit(20)
        )
        return [
            {"id": s.id, "title": s.title, "updated_at": s.updated_at.isoformat()}
            for s in res.scalars().all()
        ]

    # ── Main streaming ReAct loop ─────────────────────────────────────────────

    async def chat_stream(
        self, session_id: Optional[str], user_message: str
    ) -> AsyncGenerator[str, None]:
        """
        Gap 7: Yields SSE-formatted strings.
        Gap 9: Implements ReAct loop — LLM → tool_use → execute → inject result → LLM.
        Gap 11: user_id is always self.user.id, never sourced from LLM output.
        Gap 12: Destructive tools yield confirmation_required and pause.
        """
        if not self.client.api_key:
            yield _sse({"type": "error", "message": "Anthropic API key not configured."})
            yield _sse({"type": "done", "session_id": None})
            return

        try:
            session = await self.get_or_create_session(session_id)
        except Exception as e:
            yield _sse({"type": "error", "message": f"Session error: {e}"})
            return

        # Append user message to display log
        display_msgs = list(session.messages or [])
        display_msgs.append({"role": "user", "content": user_message})

        # Append to API history
        api_history = list(session.api_history or [])
        api_history.append({"role": "user", "content": user_message})

        tools = get_tool_schemas_for_claude()
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        system = MONARA_SYSTEM + f"\n\nToday's date: {today}"

        assistant_display = ""

        for loop_i in range(MAX_TOOL_LOOPS):
            try:
                response = await self.client.messages.create(
                    model=MONARA_MODEL,
                    max_tokens=2048,
                    system=system,
                    messages=api_history,
                    tools=tools,
                )
            except Exception as e:
                yield _sse({"type": "error", "message": str(e)})
                break

            # Serialize response content and add to API history
            serialized = _serialize_content(response.content)
            api_history.append({"role": "assistant", "content": serialized})

            tool_calls = [b for b in serialized if b.get("type") == "tool_use"]
            text_blocks = [b for b in serialized if b.get("type") == "text"]

            # Stream any text blocks immediately
            for block in text_blocks:
                text = block.get("text", "")
                if text:
                    assistant_display += text
                    # Word-by-word streaming
                    words = text.split(" ")
                    for i, word in enumerate(words):
                        yield _sse({"type": "token", "content": word + (" " if i < len(words) - 1 else "")})
                        await asyncio.sleep(0)

            if not tool_calls:
                # Pure text — we're done
                break

            # Process tool calls
            tool_results = []
            confirmation_pending = None

            for tc in tool_calls:
                tool_name = tc.get("name", "")
                tool_input = tc.get("input", {})
                tool_use_id = tc.get("id", "")

                # Gap 12: destructive action gate
                if tool_requires_confirmation(tool_name):
                    confirmation_pending = {
                        "tool_use_id": tool_use_id,
                        "tool_name": tool_name,
                        "params": tool_input,
                        "label": describe_action(tool_name, tool_input),
                        "api_history_snapshot": api_history,
                    }
                    break  # Pause on first destructive tool; handle others in next turn

                # Execute tool
                yield _sse({
                    "type": "tool_status",
                    "tool": tool_name,
                    "message": f"Running {tool_name.replace('_', ' ')}…",
                })

                result = await execute_internal_tool(tool_name, tool_input, self.user.id, self.db)

                # Gap 10: push mutation event via WebSocket
                if result.get("mutation_event"):
                    asyncio.create_task(
                        ws_manager.send_to_user(self.user.id, result["mutation_event"])
                    )

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": result["message"],
                })

            if confirmation_pending:
                # Save pending state and pause — Gap 12
                session.pending_tool_call = {
                    "tool_call": confirmation_pending,
                    "api_history_snapshot": api_history,
                }
                session.messages = display_msgs
                session.api_history = api_history
                session.updated_at = datetime.now(timezone.utc)
                await self.db.commit()

                yield _sse({
                    "type": "confirmation_required",
                    "session_id": session.id,
                    "tool": confirmation_pending["tool_name"],
                    "label": confirmation_pending["label"],
                    "params": confirmation_pending["params"],
                })
                yield _sse({"type": "done", "session_id": session.id})
                return

            # Inject tool results and loop
            if tool_results:
                api_history.append({"role": "user", "content": tool_results})

        # Save final session
        if assistant_display:
            display_msgs.append({"role": "assistant", "content": assistant_display})

        # Auto-title from first exchange
        if len(display_msgs) == 2 and session.title == "New Chat":
            session.title = user_message[:60]

        session.messages = display_msgs
        session.api_history = api_history
        session.updated_at = datetime.now(timezone.utc)
        await self.db.commit()

        yield _sse({"type": "done", "session_id": session.id})

    # ── Confirm / Cancel destructive actions ──────────────────────────────────

    async def confirm_action(self, session_id: str) -> dict:
        """Gap 12: Execute the staged destructive tool call."""
        res = await self.db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == self.user.id,
            )
        )
        session = res.scalar_one_or_none()
        if not session or not session.pending_tool_call:
            return {"success": False, "message": "No pending action found."}

        pending = session.pending_tool_call
        tc = pending["tool_call"]

        result = await execute_internal_tool(
            tc["tool_name"], tc["params"], self.user.id, self.db
        )

        if result.get("mutation_event"):
            asyncio.create_task(
                ws_manager.send_to_user(self.user.id, result["mutation_event"])
            )

        # Append result to session history
        api_history = list(pending.get("api_history_snapshot", session.api_history or []))
        api_history.append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tc["tool_use_id"],
                "content": result["message"],
            }],
        })

        display_msgs = list(session.messages or [])
        display_msgs.append({"role": "assistant", "content": result["message"]})

        session.api_history = api_history
        session.messages = display_msgs
        session.pending_tool_call = None
        session.updated_at = datetime.now(timezone.utc)
        await self.db.commit()

        return {"success": result["success"], "message": result["message"], "mutation_event": result.get("mutation_event")}

    async def cancel_action(self, session_id: str) -> dict:
        """Gap 12: Clear the staged action without executing."""
        res = await self.db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == self.user.id,
            )
        )
        session = res.scalar_one_or_none()
        if not session:
            return {"success": False, "message": "Session not found."}

        pending = session.pending_tool_call
        if pending:
            action_label = pending.get("tool_call", {}).get("label", "action")
            display_msgs = list(session.messages or [])
            display_msgs.append({"role": "assistant", "content": f"Got it — I've cancelled the '{action_label}'."})
            session.messages = display_msgs
            session.pending_tool_call = None
            session.updated_at = datetime.now(timezone.utc)
            await self.db.commit()

        return {"success": True, "message": "Action cancelled."}

"""
Stateful Multi-Agent Graph Orchestration Engine
- DAG traversal via workflow_edges
- Multi-LLM dispatch (Claude, GPT, Gemini) per agent node
- HITL pause/resume
- Token summarization at 80k tokens
- Triple-context RAG injection
- Universal tool calling
"""
import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    AgentConfig, WorkflowEdge, ExecutionState, LeadRaw,
    UserProduct, KnowledgeBase
)

from services.rag_retriever import build_rag_context
from services.tool_executor import execute_tool, format_tool_for_claude, format_tool_for_openai

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

TOKEN_SUMMARIZE_THRESHOLD = 80_000  # chars (~20k tokens)
SUMMARY_KEEP_LAST = 10  # keep last N messages verbatim after summarization


# ─── Token Management ─────────────────────────────────────────────────────────

def estimate_tokens(messages: list[dict]) -> int:
    total_chars = sum(len(json.dumps(m)) for m in messages)
    return total_chars // 4  # rough 4 chars per token


async def summarize_history_if_needed(messages: list[dict]) -> list[dict]:
    """If history exceeds 80k tokens, summarize old messages with Claude."""
    if estimate_tokens(messages) < TOKEN_SUMMARIZE_THRESHOLD:
        return messages

    to_summarize = messages[:-SUMMARY_KEEP_LAST]
    keep_recent = messages[-SUMMARY_KEEP_LAST:]

    if not to_summarize:
        return messages

    # Summarize with Claude
    summary_prompt = (
        "Summarize the following multi-agent execution history concisely. "
        "Preserve all key decisions, tool results, and lead information.\n\n"
        + json.dumps(to_summarize, indent=2)
    )

    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        resp = await client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1024,
            messages=[{"role": "user", "content": summary_prompt}],
        )
        summary_text = resp.content[0].text
    except Exception:
        summary_text = f"[Summarized {len(to_summarize)} earlier steps]"

    summary_msg = {
        "role": "system",
        "content": f"[HISTORY SUMMARY — {len(to_summarize)} earlier steps compressed]\n{summary_text}",
        "summarized_at": datetime.now(timezone.utc).isoformat(),
    }
    return [summary_msg] + keep_recent


# ─── LLM Dispatch ─────────────────────────────────────────────────────────────

async def call_llm(
    agent: AgentConfig,
    system_prompt: str,
    messages: list[dict],
    tools: list[dict] = None,
) -> dict:
    """
    Dispatch to the correct LLM based on agent.provider.
    Returns {"content": str, "tool_calls": list, "tokens_used": int}
    """
    provider = agent.provider.lower()
    model = agent.model_name
    temperature = agent.temperature or 0.7

    llm_messages = []
    for m in messages:
        role = m.get("role", "user")
        if role in ("user", "assistant"):
            llm_messages.append({"role": role, "content": str(m.get("content", ""))})

    if not llm_messages:
        llm_messages = [{"role": "user", "content": "Begin processing."}]

    try:
        if provider == "anthropic":
            return await _call_anthropic(model, system_prompt, llm_messages, temperature, tools)
        elif provider == "openai":
            return await _call_openai(model, system_prompt, llm_messages, temperature, tools)
        elif provider == "gemini":
            return await _call_gemini(model, system_prompt, llm_messages, temperature)
        else:
            raise ValueError(f"Unknown provider: {provider}")
    except Exception as e:
        # Try fallback model
        if agent.fallback_model and agent.fallback_provider:
            try:
                fallback = AgentConfig(
                    provider=agent.fallback_provider,
                    model_name=agent.fallback_model,
                    temperature=temperature,
                    fallback_model=None,
                    fallback_provider=None,
                )
                return await call_llm(fallback, system_prompt, messages, tools)
            except Exception as fe:
                raise RuntimeError(f"Primary ({provider}/{model}) and fallback both failed: {e} | {fe}")
        raise


async def _call_anthropic(model, system_prompt, messages, temperature, tools=None) -> dict:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    kwargs = dict(
        model=model,
        max_tokens=2048,
        system=system_prompt,
        messages=messages,
        temperature=temperature,
    )
    if tools:
        kwargs["tools"] = tools

    resp = await client.messages.create(**kwargs)
    tool_calls = []
    text_content = ""
    for block in resp.content:
        if block.type == "text":
            text_content += block.text
        elif block.type == "tool_use":
            tool_calls.append({"name": block.name, "input": block.input, "id": block.id})

    return {
        "content": text_content,
        "tool_calls": tool_calls,
        "tokens_used": resp.usage.input_tokens + resp.usage.output_tokens,
    }


async def _call_openai(model, system_prompt, messages, temperature, tools=None) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, SystemMessage

    key = EMERGENT_LLM_KEY or os.environ.get("OPENAI_API_KEY", "")
    chat = LlmChat(api_key=key, session_id=f"agent-{model}", system_message=system_prompt)
    chat.with_model("openai", model)

    # Combine messages into a single prompt for emergentintegrations
    combined = "\n\n".join(
        f"[{m['role'].upper()}]: {m['content']}"
        for m in messages
    )
    user_msg = UserMessage(text=combined)
    reply = await chat.send_message(user_msg)
    return {"content": str(reply), "tool_calls": [], "tokens_used": len(combined) // 4}


async def _call_gemini(model, system_prompt, messages, temperature) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    key = GEMINI_API_KEY or EMERGENT_LLM_KEY
    chat = LlmChat(api_key=key, session_id=f"agent-gemini", system_message=system_prompt)
    chat.with_model("gemini", model)

    combined = "\n\n".join(
        f"[{m['role'].upper()}]: {m['content']}"
        for m in messages
    )
    user_msg = UserMessage(text=combined)
    reply = await chat.send_message(user_msg)
    return {"content": str(reply), "tool_calls": [], "tokens_used": len(combined) // 4}


# ─── Graph Executor ───────────────────────────────────────────────────────────

class GraphExecutor:
    def __init__(self, db: AsyncSession, ws_callback=None):
        self.db = db
        self.ws_callback = ws_callback  # for simulator real-time updates

    async def _notify(self, thread_id: str, event: dict):
        if self.ws_callback:
            await self.ws_callback(thread_id, event)

    async def _get_entry_agent(self, user_id: str, signal_category: str = None) -> Optional[AgentConfig]:
        """Find the God/entry agent for this user's workflow."""
        # First try: agent with role 'god' and on_webhook edge
        stmt = (
            select(AgentConfig)
            .join(WorkflowEdge, WorkflowEdge.source_node_id == AgentConfig.id, isouter=True)
            .where(
                AgentConfig.user_id == user_id,
                AgentConfig.is_active == True,
                AgentConfig.agent_role == "god",
            )
        )
        result = await self.db.execute(stmt)
        agent = result.scalars().first()
        if agent:
            return agent

        # Fallback: any agent with an on_webhook edge matching signal_category
        stmt2 = (
            select(AgentConfig)
            .join(WorkflowEdge, WorkflowEdge.source_node_id == AgentConfig.id)
            .where(
                AgentConfig.user_id == user_id,
                AgentConfig.is_active == True,
                WorkflowEdge.condition_type == "on_webhook",
            )
        )
        if signal_category:
            stmt2 = stmt2.where(
                (WorkflowEdge.signal_category == signal_category) |
                (WorkflowEdge.signal_category == None)
            )
        result2 = await self.db.execute(stmt2)
        return result2.scalars().first()

    async def _get_next_agents(
        self, source_agent_id: str, condition_type: str, user_id: str
    ) -> list[AgentConfig]:
        """Follow workflow_edges to get next agents."""
        stmt = (
            select(AgentConfig)
            .join(WorkflowEdge, WorkflowEdge.target_node_id == AgentConfig.id)
            .where(
                WorkflowEdge.source_node_id == source_agent_id,
                WorkflowEdge.condition_type == condition_type,
                AgentConfig.user_id == user_id,
                AgentConfig.is_active == True,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def _get_user_product(self, user_id: str) -> Optional[dict]:
        from models import UserProduct
        stmt = select(UserProduct).where(UserProduct.user_id == user_id)
        result = await self.db.execute(stmt)
        prod = result.scalar_one_or_none()
        if prod:
            return {
                "company_name": prod.company_name,
                "product_description": prod.product_description,
                "value_proposition": prod.value_proposition,
                "target_audience": prod.target_audience,
            }
        return None

    async def _execute_agent_step(
        self,
        thread_id: str,
        agent: AgentConfig,
        state: ExecutionState,
        input_text: str,
    ) -> dict:
        """Run a single agent step: RAG → LLM → Tool Calls → Output."""
        await self._notify(thread_id, {
            "event": "agent_start",
            "agent_id": agent.id,
            "agent_name": agent.name,
            "agent_role": agent.agent_role,
        })

        # Summarize history if needed
        history = state.message_history or []
        history = await summarize_history_if_needed(history)

        # Build RAG context
        user_product = await self._get_user_product(state.user_id)
        rag_context = ""
        if agent.rag_weights and any(v > 0 for v in agent.rag_weights.values()):
            try:
                rag_context = await build_rag_context(
                    self.db,
                    query=input_text,
                    user_id=state.user_id,
                    rag_weights=agent.rag_weights,
                    user_product=user_product,
                )
            except Exception:
                pass

        # Build system prompt
        base_prompt = agent.system_prompt or f"You are {agent.name}, an AI agent in a multi-agent workflow."
        if rag_context:
            base_prompt = base_prompt + "\n\n## Retrieved Knowledge\n" + rag_context

        # Build tool specs
        tool_specs = []
        if hasattr(agent, "tools") and agent.tools:
            for tool in agent.tools:
                if tool.is_active:
                    if agent.provider == "anthropic":
                        tool_specs.append(format_tool_for_claude(
                            {"name": tool.name, "description": tool.description, "openapi_schema": tool.openapi_schema}
                        ))
                    elif agent.provider == "openai":
                        tool_specs.append(format_tool_for_openai(
                            {"name": tool.name, "description": tool.description, "openapi_schema": tool.openapi_schema}
                        ))

        # Add current input to history
        history.append({"role": "user", "content": input_text})

        # Call LLM
        llm_result = await call_llm(
            agent,
            base_prompt,
            history,
            tools=tool_specs if tool_specs else None,
        )

        output_text = llm_result["content"]
        tool_calls = llm_result.get("tool_calls", [])

        # Execute tool calls
        tool_results = []
        if tool_calls and hasattr(agent, "tools") and agent.tools:
            tool_map = {t.name.replace(" ", "_").lower(): t for t in agent.tools}
            for tc in tool_calls:
                tool_name = tc["name"]
                tool_input = tc.get("input", {})
                tool_obj = tool_map.get(tool_name)
                if tool_obj:
                    await self._notify(thread_id, {"event": "tool_call", "tool": tool_name})
                    tool_result = await execute_tool(
                        {
                            "name": tool_obj.name,
                            "integration_type": tool_obj.integration_type,
                            "endpoint_url": tool_obj.endpoint_url,
                            "auth_headers_encrypted": tool_obj.auth_headers_encrypted,
                            "openapi_schema": tool_obj.openapi_schema,
                            "oauth_config_encrypted": tool_obj.oauth_config_encrypted,
                        },
                        tool_input,
                    )
                    tool_results.append({"tool": tool_name, "result": tool_result})
                    if not tool_result["success"]:
                        await self._notify(thread_id, {"event": "tool_error", "tool": tool_name, "error": tool_result["error"]})

        # If there were tool results, do a second LLM call to synthesize
        if tool_results:
            tool_summary = json.dumps(tool_results, indent=2)
            history.append({"role": "assistant", "content": output_text or "[tool calls]"})
            history.append({"role": "user", "content": f"Tool execution results:\n{tool_summary}\n\nPlease synthesize a final response."})
            llm_result2 = await call_llm(agent, base_prompt, history)
            output_text = llm_result2["content"]
            llm_result["tokens_used"] += llm_result2.get("tokens_used", 0)

        # Append final output to history
        history.append({"role": "assistant", "content": output_text})

        await self._notify(thread_id, {
            "event": "agent_complete",
            "agent_id": agent.id,
            "agent_name": agent.name,
            "output_preview": output_text[:200],
        })

        return {
            "output": output_text,
            "history": history,
            "tokens_used": llm_result.get("tokens_used", 0),
            "tool_results": tool_results,
            "success": True,
        }

    async def run(
        self,
        thread_id: str,
        lead_payload: dict,
        user_id: str,
        signal_category: str = None,
        dry_run: bool = False,
    ) -> ExecutionState:
        """
        Main graph execution entry point.
        dry_run=True: don't write to DB (simulator mode)
        """
        db = self.db

        # Create or load execution state
        if not dry_run:
            state = ExecutionState(
                id=thread_id,
                user_id=user_id,
                signal_category=signal_category,
                status="running",
                message_history=[],
                thread_metadata={"lead_payload": lead_payload},
            )
            db.add(state)
            await db.commit()
            await db.refresh(state)
        else:
            state = ExecutionState(
                id=thread_id,
                user_id=user_id,
                signal_category=signal_category,
                status="running",
                message_history=[],
                thread_metadata={"lead_payload": lead_payload, "dry_run": True},
            )

        await self._notify(thread_id, {"event": "thread_start", "thread_id": thread_id})

        # Find entry agent
        entry_agent = await self._get_entry_agent(user_id, signal_category)
        if not entry_agent:
            state.status = "failed"
            state.final_output = "No entry agent configured. Set up a God/Manager agent with an on_webhook edge."
            if not dry_run:
                await db.commit()
            await self._notify(thread_id, {"event": "thread_failed", "reason": state.final_output})
            return state

        # Convert lead payload to initial prompt
        initial_prompt = (
            f"New intent signal received.\nSignal Category: {signal_category or 'unknown'}\n"
            f"Lead Data: {json.dumps(lead_payload, indent=2)}\n\n"
            "Process this lead according to your role."
        )

        # Execute the graph
        current_agents = [entry_agent]
        visited = set()
        last_output = initial_prompt

        while current_agents:
            agent = current_agents.pop(0)
            if agent.id in visited:
                continue
            visited.add(agent.id)

            # Update current agent in state
            state.current_agent_id = agent.id
            if not dry_run:
                state.updated_at = datetime.now(timezone.utc)
                await db.commit()

            # Check for HITL gate
            if agent.agent_role == "evaluator":
                state.status = "pending_human_approval"
                state.hitl_gate_agent_id = agent.id
                if not dry_run:
                    state.updated_at = datetime.now(timezone.utc)
                    await db.commit()
                await self._notify(thread_id, {
                    "event": "hitl_gate",
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "thread_id": thread_id,
                    "message": f"Human approval required at gate: {agent.name}",
                })
                return state  # Pause here; resume via /approve or /reject

            # Execute agent step
            try:
                step_result = await self._execute_agent_step(thread_id, agent, state, last_output)
                last_output = step_result["output"]
                state.message_history = step_result["history"]
                state.total_tokens_used = (state.total_tokens_used or 0) + step_result["tokens_used"]

            except Exception as e:
                state.status = "failed"
                state.final_output = f"Agent {agent.name} failed: {str(e)}"
                # Rollback transaction to clear any aborted state before querying again
                try:
                    await db.rollback()
                except Exception:
                    pass
                if not dry_run:
                    try:
                        await db.commit()
                    except Exception:
                        pass
                await self._notify(thread_id, {"event": "agent_error", "agent_id": agent.id, "error": str(e)})

                # Follow on_failure edges
                try:
                    fail_agents = await self._get_next_agents(agent.id, "on_failure", user_id)
                    current_agents.extend(fail_agents)
                except Exception:
                    pass  # If we can't get failure edges, stop here
                continue

            # Follow on_success edges
            next_agents = await self._get_next_agents(agent.id, "on_success", user_id)
            current_agents.extend(next_agents)

        # All agents done — Gap 5: auto-create OutreachDraft if output_type = email_draft
        state.status = "completed"
        state.final_output = last_output
        if not dry_run:
            state.updated_at = datetime.now(timezone.utc)
            # Auto-create OutreachDraft when the entry agent is an email-writing agent
            if (
                entry_agent
                and getattr(entry_agent, "output_type", "email_draft") == "email_draft"
                and state.lead_id
                and last_output
                and last_output != initial_prompt
            ):
                try:
                    from models import OutreachDraft
                    draft = OutreachDraft(
                        user_id=state.user_id,
                        lead_id=state.lead_id,
                        content=last_output,
                        subject="[AI Draft]",
                        status="draft",
                    )
                    db.add(draft)
                except Exception as draft_err:
                    print(f"[orchestrator] OutreachDraft creation failed: {draft_err}")
            await db.commit()

        await self._notify(thread_id, {
            "event": "thread_complete",
            "thread_id": thread_id,
            "output_preview": last_output[:300],
        })
        return state

    async def resume(self, thread_id: str, decision: str) -> ExecutionState:
        """Resume a paused HITL thread with 'approved' or 'rejected'."""
        stmt = select(ExecutionState).where(ExecutionState.id == thread_id)
        result = await self.db.execute(stmt)
        state = result.scalar_one_or_none()

        if not state or state.status != "pending_human_approval":
            raise ValueError("Thread not found or not awaiting approval")

        state.hitl_decision = decision
        state.status = "running"
        await self.db.commit()

        gate_agent_id = state.hitl_gate_agent_id
        condition = "if_approved" if decision == "approved" else "if_rejected"
        next_agents = await self._get_next_agents(gate_agent_id, condition, state.user_id)

        if not next_agents:
            state.status = "completed"
            state.final_output = f"[HITL] Decision: {decision}. No further agents configured."
            await self.db.commit()
            await self._notify(thread_id, {"event": "thread_complete", "thread_id": thread_id})
            return state

        # Re-run from next agents
        for agent in next_agents:
            try:
                step_result = await self._execute_agent_step(
                    thread_id, agent, state,
                    f"Human decision: {decision}. Continue workflow."
                )
                state.message_history = step_result["history"]
                state.total_tokens_used = (state.total_tokens_used or 0) + step_result["tokens_used"]
            except Exception as e:
                state.status = "failed"
                state.final_output = str(e)
                await self.db.commit()
                return state

        state.status = "completed"
        state.final_output = state.message_history[-1].get("content", "") if state.message_history else ""
        await self.db.commit()
        await self._notify(thread_id, {"event": "thread_complete", "thread_id": thread_id})
        return state

"""
Monara routes — SSE streaming chat, WebSocket mutation bus, session CRUD,
confirm/cancel for destructive actions (Gaps 6, 7, 10, 12).
"""
import os
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from routes.auth import get_current_user
from services.monara_engine import MonaraEngine
from services.ws_manager import ws_manager

router = APIRouter(prefix="/monara", tags=["Monara"])


# ─── Session management ───────────────────────────────────────────────────────

@router.get("/session")
async def get_or_create_session(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the most recent session or create a new one."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    engine = MonaraEngine(db=db, user=user, api_key=api_key)
    session = await engine.get_or_create_session()
    return {
        "id": session.id,
        "title": session.title,
        "messages": session.messages or [],
        "has_pending_action": bool(session.pending_tool_call),
    }


@router.get("/sessions")
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    engine = MonaraEngine(db=db, user=user, api_key=api_key)
    return await engine.list_sessions()


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from models import ChatSession
    res = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"ok": True}


# ─── SSE Streaming Chat (Gaps 6, 7, 9) ───────────────────────────────────────

@router.post("/chat/stream")
async def chat_stream(
    payload: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    SSE endpoint. Streams token events, tool_status events,
    confirmation_required gates, and done signal.
    Frontend must consume with fetch() + ReadableStream, not EventSource.
    """
    session_id = payload.get("session_id")
    message = payload.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    engine = MonaraEngine(db=db, user=user, api_key=api_key)

    async def generate():
        async for event in engine.chat_stream(session_id, message):
            yield event

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Confirm / Cancel (Gap 12) ────────────────────────────────────────────────

@router.post("/confirm/{session_id}")
async def confirm_action(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    engine = MonaraEngine(db=db, user=user, api_key=api_key)
    result = await engine.confirm_action(session_id)
    return result


@router.post("/cancel/{session_id}")
async def cancel_action(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    engine = MonaraEngine(db=db, user=user, api_key=api_key)
    result = await engine.cancel_action(session_id)
    return result


# ─── WebSocket Mutation Bus (Gap 10) ─────────────────────────────────────────

@router.websocket("/ws/{user_id}")
async def monara_websocket(websocket: WebSocket, user_id: str):
    """
    Per-user WebSocket. Frontend opens this on login and listens for
    ACTION_* mutation events pushed by Monara's internal tools.
    No auth on the WS itself — user_id is trusted from the URL since
    it's only reachable via the same-origin app. For production,
    pass a token as a query param and validate here.
    """
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            # Keep connection alive; mutations are server-pushed
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)

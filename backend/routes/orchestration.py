"""
Orchestration Routes — Thread execution, HITL, WebSocket simulator
"""
import uuid
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, ExecutionState
from routes.auth import get_current_user
from routes.admin import get_admin_user
from services.orchestrator import GraphExecutor

router = APIRouter(prefix="/admin/orchestration", tags=["Orchestration"])

# Active WebSocket connections: thread_id -> [WebSocket]
_ws_connections: dict[str, list[WebSocket]] = {}


async def ws_broadcast(thread_id: str, event: dict):
    """Send real-time events to all subscribers of a thread."""
    if thread_id in _ws_connections:
        dead = []
        for ws in _ws_connections[thread_id]:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for d in dead:
            _ws_connections[thread_id].remove(d)


class SimulateRequest(BaseModel):
    payload: dict
    signal_category: Optional[str] = None


class HITLDecision(BaseModel):
    decision: str  # "approved" or "rejected"


# ─── Thread Management ────────────────────────────────────────────────────────

@router.post("/threads/simulate")
async def simulate_thread(
    req: SimulateRequest,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Dry-run mode: Execute graph without writing leads/drafts to DB.
    Returns full execution trace.
    """
    thread_id = f"sim-{uuid.uuid4().hex[:12]}"
    events = []

    async def capture_event(tid: str, event: dict):
        events.append(event)
        await ws_broadcast(tid, event)

    executor = GraphExecutor(db=db, ws_callback=capture_event)
    state = await executor.run(
        thread_id=thread_id,
        lead_payload=req.payload,
        user_id=user.id,
        signal_category=req.signal_category,
        dry_run=True,
    )

    return {
        "thread_id": thread_id,
        "status": state.status,
        "final_output": state.final_output,
        "total_tokens_used": state.total_tokens_used,
        "events": events,
        "message_history": state.message_history,
    }


@router.get("/threads")
async def list_threads(
    status: Optional[str] = Query(None),
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200),
):
    stmt = select(ExecutionState).where(ExecutionState.user_id == user.id)
    if status:
        stmt = stmt.where(ExecutionState.status == status)
    stmt = stmt.order_by(ExecutionState.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    states = result.scalars().all()
    return [
        {
            "id": s.id, "status": s.status,
            "signal_category": s.signal_category,
            "current_agent_id": s.current_agent_id,
            "total_tokens_used": s.total_tokens_used,
            "hitl_gate_agent_id": s.hitl_gate_agent_id,
            "created_at": s.created_at.isoformat(),
        }
        for s in states
    ]


@router.post("/threads/{thread_id}/approve")
async def approve_hitl(
    thread_id: str,
    body: HITLDecision,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a paused HITL thread."""
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")

    async def capture(tid: str, event: dict):
        await ws_broadcast(tid, event)

    executor = GraphExecutor(db=db, ws_callback=capture)
    state = await executor.resume(thread_id=thread_id, decision=body.decision)
    return {
        "thread_id": thread_id,
        "status": state.status,
        "decision": body.decision,
        "final_output": state.final_output,
    }


# ─── WebSocket Simulator ──────────────────────────────────────────────────────

@router.websocket("/ws/{thread_id}")
async def thread_websocket(
    websocket: WebSocket,
    thread_id: str,
    token: str = Query(None),
):
    """
    WebSocket endpoint for real-time thread event streaming.
    Client subscribes to a thread_id and receives agent start/complete/tool_call events.
    """
    # Basic token validation
    if not token:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    if thread_id not in _ws_connections:
        _ws_connections[thread_id] = []
    _ws_connections[thread_id].append(websocket)

    try:
        # Keep alive — client sends pings
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        if thread_id in _ws_connections:
            _ws_connections[thread_id] = [
                ws for ws in _ws_connections[thread_id] if ws != websocket
            ]

"""
Admin Routes — Agent Studio, Tool Registry, Knowledge Base, User Products
Protected by is_admin flag on user.
"""
import os
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import (
    User, AgentConfig, WorkflowEdge, ToolRegistry, AgentToolsJunction,
    KnowledgeBase, KnowledgeEmbedding, AgentKnowledgeJunction, UserProduct, ExecutionState
)
from routes.auth import get_current_user
from utils.auth import encrypt_api_key, decrypt_api_key

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── Admin Guard ──────────────────────────────────────────────────────────────

async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class AgentConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    agent_role: str = "worker"
    provider: str = "anthropic"
    model_name: str = "claude-sonnet-4-5-20250929"
    fallback_provider: Optional[str] = None
    fallback_model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    rag_weights: Optional[dict] = None
    position_x: float = 0.0
    position_y: float = 0.0


class AgentConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    agent_role: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    fallback_provider: Optional[str] = None
    fallback_model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    rag_weights: Optional[dict] = None
    is_active: Optional[bool] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class WorkflowEdgeCreate(BaseModel):
    source_node_id: str
    target_node_id: str
    condition_type: str
    signal_category: Optional[str] = None
    weight: float = 1.0


class ToolRegistryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    integration_type: str
    endpoint_url: Optional[str] = None
    auth_headers: Optional[dict] = None
    openapi_schema: Optional[dict] = None
    oauth_config: Optional[dict] = None


class ToolRegistryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    integration_type: Optional[str] = None
    endpoint_url: Optional[str] = None
    auth_headers: Optional[dict] = None
    openapi_schema: Optional[dict] = None
    oauth_config: Optional[dict] = None
    is_active: Optional[bool] = None


class UserProductUpsert(BaseModel):
    company_name: Optional[str] = None
    product_description: Optional[str] = None
    value_proposition: Optional[str] = None
    target_audience: Optional[str] = None


# ─── Admin Overview ───────────────────────────────────────────────────────────

@router.get("/overview")
async def admin_overview(
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    agents = (await db.execute(select(func.count(AgentConfig.id)).where(AgentConfig.user_id == user.id))).scalar() or 0
    tools = (await db.execute(select(func.count(ToolRegistry.id)))).scalar() or 0
    kb_files = (await db.execute(select(func.count(KnowledgeBase.id)))).scalar() or 0
    executions = (await db.execute(select(func.count(ExecutionState.id)).where(ExecutionState.user_id == user.id))).scalar() or 0
    pending_hitl = (await db.execute(
        select(func.count(ExecutionState.id))
        .where(ExecutionState.user_id == user.id, ExecutionState.status == "pending_human_approval")
    )).scalar() or 0

    return {
        "agent_count": agents,
        "tool_count": tools,
        "knowledge_files": kb_files,
        "total_executions": executions,
        "pending_hitl": pending_hitl,
    }


@router.post("/promote-self")
async def promote_self_to_admin(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """One-time endpoint: make current user admin. Only works if no admins exist yet."""
    from sqlalchemy import func
    admin_count = (await db.execute(select(func.count(User.id)).where(User.is_admin == True))).scalar() or 0
    if admin_count > 0 and not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin already exists. Contact your admin.")
    user.is_admin = True
    await db.commit()
    return {"message": "You are now an admin", "is_admin": True}


# ─── Agent Config CRUD ────────────────────────────────────────────────────────

@router.get("/agents")
async def list_agents(user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfig).where(AgentConfig.user_id == user.id))
    agents = result.scalars().all()
    return [
        {
            "id": a.id, "name": a.name, "description": a.description,
            "agent_role": a.agent_role, "provider": a.provider,
            "model_name": a.model_name, "fallback_provider": a.fallback_provider,
            "fallback_model": a.fallback_model, "system_prompt": a.system_prompt,
            "temperature": a.temperature, "rag_weights": a.rag_weights,
            "is_active": a.is_active, "position_x": a.position_x,
            "position_y": a.position_y, "created_at": a.created_at.isoformat(),
        }
        for a in agents
    ]


@router.post("/agents")
async def create_agent(data: AgentConfigCreate, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    agent = AgentConfig(
        user_id=user.id,
        name=data.name,
        description=data.description,
        agent_role=data.agent_role,
        provider=data.provider,
        model_name=data.model_name,
        fallback_provider=data.fallback_provider,
        fallback_model=data.fallback_model,
        system_prompt=data.system_prompt,
        temperature=data.temperature,
        rag_weights=data.rag_weights or {"global": 0.3, "user": 0.5, "product": 0.2},
        position_x=data.position_x,
        position_y=data.position_y,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return {"id": agent.id, "name": agent.name, "message": "Agent created"}


@router.patch("/agents/{agent_id}")
async def update_agent(agent_id: str, data: AgentConfigUpdate, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfig).where(AgentConfig.id == agent_id, AgentConfig.user_id == user.id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(agent, field, val)
    agent.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Agent updated"}


@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(AgentConfig).where(AgentConfig.id == agent_id, AgentConfig.user_id == user.id))
    await db.commit()
    return {"message": "Agent deleted"}


# ─── Workflow Edges ───────────────────────────────────────────────────────────

@router.get("/edges")
async def list_edges(user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkflowEdge).where(WorkflowEdge.user_id == user.id))
    edges = result.scalars().all()
    return [
        {
            "id": e.id, "source_node_id": e.source_node_id, "target_node_id": e.target_node_id,
            "condition_type": e.condition_type, "signal_category": e.signal_category, "weight": e.weight,
        }
        for e in edges
    ]


@router.post("/edges")
async def create_edge(data: WorkflowEdgeCreate, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    edge = WorkflowEdge(
        user_id=user.id,
        source_node_id=data.source_node_id,
        target_node_id=data.target_node_id,
        condition_type=data.condition_type,
        signal_category=data.signal_category,
        weight=data.weight,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return {"id": edge.id, "message": "Edge created"}


@router.delete("/edges/{edge_id}")
async def delete_edge(edge_id: str, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(WorkflowEdge).where(WorkflowEdge.id == edge_id, WorkflowEdge.user_id == user.id))
    await db.commit()
    return {"message": "Edge deleted"}


# ─── Tool Registry CRUD ───────────────────────────────────────────────────────

@router.get("/tools")
async def list_tools(user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolRegistry).where(
        (ToolRegistry.user_id == user.id) | (ToolRegistry.user_id == None)
    ))
    tools = result.scalars().all()
    return [
        {
            "id": t.id, "name": t.name, "description": t.description,
            "integration_type": t.integration_type, "endpoint_url": t.endpoint_url,
            "openapi_schema": t.openapi_schema, "is_active": t.is_active,
            "has_auth": bool(t.auth_headers_encrypted), "has_oauth": bool(t.oauth_config_encrypted),
            "created_at": t.created_at.isoformat(),
        }
        for t in tools
    ]


@router.post("/tools")
async def create_tool(data: ToolRegistryCreate, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    auth_enc = encrypt_api_key(json.dumps(data.auth_headers)) if data.auth_headers else None
    oauth_enc = encrypt_api_key(json.dumps(data.oauth_config)) if data.oauth_config else None
    tool = ToolRegistry(
        user_id=user.id,
        name=data.name,
        description=data.description,
        integration_type=data.integration_type,
        endpoint_url=data.endpoint_url,
        auth_headers_encrypted=auth_enc,
        openapi_schema=data.openapi_schema,
        oauth_config_encrypted=oauth_enc,
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return {"id": tool.id, "name": tool.name, "message": "Tool registered"}


@router.patch("/tools/{tool_id}")
async def update_tool(tool_id: str, data: ToolRegistryUpdate, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolRegistry).where(ToolRegistry.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    payload = data.model_dump(exclude_none=True)
    if "auth_headers" in payload:
        tool.auth_headers_encrypted = encrypt_api_key(json.dumps(payload.pop("auth_headers")))
    if "oauth_config" in payload:
        tool.oauth_config_encrypted = encrypt_api_key(json.dumps(payload.pop("oauth_config")))
    for field, val in payload.items():
        setattr(tool, field, val)
    tool.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Tool updated"}


@router.delete("/tools/{tool_id}")
async def delete_tool(tool_id: str, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ToolRegistry).where(ToolRegistry.id == tool_id))
    await db.commit()
    return {"message": "Tool deleted"}


# Agent ↔ Tool wiring
@router.post("/agents/{agent_id}/tools/{tool_id}")
async def wire_tool(agent_id: str, tool_id: str, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    junc = AgentToolsJunction(agent_config_id=agent_id, tool_registry_id=tool_id)
    db.add(junc)
    await db.commit()
    return {"message": "Tool wired to agent"}


@router.delete("/agents/{agent_id}/tools/{tool_id}")
async def unwire_tool(agent_id: str, tool_id: str, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(AgentToolsJunction).where(
        AgentToolsJunction.agent_config_id == agent_id,
        AgentToolsJunction.tool_registry_id == tool_id,
    ))
    await db.commit()
    return {"message": "Tool removed from agent"}


# ─── User Product ─────────────────────────────────────────────────────────────

@router.get("/product")
async def get_product(user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProduct).where(UserProduct.user_id == user.id))
    prod = result.scalar_one_or_none()
    if not prod:
        return {}
    return {
        "id": prod.id, "company_name": prod.company_name,
        "product_description": prod.product_description,
        "value_proposition": prod.value_proposition,
        "target_audience": prod.target_audience,
    }


@router.post("/product")
async def upsert_product(data: UserProductUpsert, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProduct).where(UserProduct.user_id == user.id))
    prod = result.scalar_one_or_none()
    if prod:
        for f, v in data.model_dump(exclude_none=True).items():
            setattr(prod, f, v)
        prod.updated_at = datetime.now(timezone.utc)
    else:
        prod = UserProduct(user_id=user.id, **data.model_dump(exclude_none=True))
        db.add(prod)
    await db.commit()
    return {"message": "Product context saved"}


# ─── Execution Logs ───────────────────────────────────────────────────────────

@router.get("/executions")
async def list_executions(
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200),
):
    result = await db.execute(
        select(ExecutionState)
        .where(ExecutionState.user_id == user.id)
        .order_by(ExecutionState.created_at.desc())
        .limit(limit)
    )
    states = result.scalars().all()
    return [
        {
            "id": s.id,
            "status": s.status,
            "signal_category": s.signal_category,
            "current_agent_id": s.current_agent_id,
            "hitl_gate_agent_id": s.hitl_gate_agent_id,
            "hitl_decision": s.hitl_decision,
            "total_tokens_used": s.total_tokens_used,
            "final_output_preview": (s.final_output or "")[:200],
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in states
    ]


@router.get("/executions/{thread_id}")
async def get_execution(thread_id: str, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExecutionState).where(ExecutionState.id == thread_id, ExecutionState.user_id == user.id))
    state = result.scalar_one_or_none()
    if not state:
        raise HTTPException(status_code=404, detail="Execution not found")
    return {
        "id": state.id,
        "status": state.status,
        "signal_category": state.signal_category,
        "message_history": state.message_history,
        "final_output": state.final_output,
        "total_tokens_used": state.total_tokens_used,
        "hitl_gate_agent_id": state.hitl_gate_agent_id,
        "hitl_decision": state.hitl_decision,
        "thread_metadata": state.thread_metadata,
        "created_at": state.created_at.isoformat(),
    }

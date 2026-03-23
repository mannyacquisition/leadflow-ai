"""
Webhook endpoint for receiving Apify scraper data
Implements the secure dispatcher with Mixture of Experts routing
"""
import os
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, AsyncSessionLocal
from models import User, LeadRaw
from agents import route_to_agent

router = APIRouter(prefix="/webhook", tags=["Webhook"])

# Webhook secret for validation
APIFY_WEBHOOK_SECRET = os.environ.get('APIFY_WEBHOOK_SECRET', 'leadflow-webhook-secret-change-me')


# ─── Schemas ─────────────────────────────────────────────────────────────────────

class WebhookPayload(BaseModel):
    """Expected payload structure from Apify scrapers"""
    user_id: str  # User ID who owns this signal
    signal_category: str  # warm_inbound, topic_authority, network_sniper, trigger_event, competitor_engagement
    
    # Lead data
    name: str | None = None
    email: str | None = None
    job_title: str | None = None
    company: str | None = None
    linkedin_url: str | None = None
    
    # Additional context (varies by signal type)
    engagement_type: str | None = None
    keywords: list | None = None
    influencer_name: str | None = None
    competitor_name: str | None = None
    trigger_type: str | None = None
    event_details: str | None = None
    post_topic: str | None = None
    post_content: str | None = None
    
    # Calculated score (optional, can be overridden by AI)
    ai_score: int | None = None


# ─── Background Task ─────────────────────────────────────────────────────────────

async def process_lead_async(lead_id: str, user_id: str, signal_category: str):
    """
    Background task to process lead.
    Uses God Mode GraphExecutor if user has active agent_configs,
    otherwise falls back to legacy workers.
    """
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(LeadRaw).where(LeadRaw.id == lead_id))
            lead = result.scalar_one_or_none()
            if not lead:
                return

            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if not user:
                return

            # Check if user has God Mode agent configs
            from models import AgentConfig
            from sqlalchemy import func
            agent_count = (
                await db.execute(
                    select(func.count(AgentConfig.id)).where(
                        AgentConfig.user_id == user_id,
                        AgentConfig.is_active.is_(True),
                    )
                )
            ).scalar() or 0

            if agent_count > 0:
                # ── God Mode path ─────────────────────────────────────────────
                import uuid
                from services.orchestrator import GraphExecutor
                thread_id = f"wh-{uuid.uuid4().hex[:12]}"
                executor = GraphExecutor(db=db)
                state = await executor.run(
                    thread_id=thread_id,
                    lead_payload=lead.raw_payload or {},
                    user_id=user_id,
                    signal_category=signal_category,
                    dry_run=False,
                )
                if state.status in ("completed", "pending_human_approval"):
                    lead.processed = True
                    await db.commit()
                print(f"God Mode processed lead {lead_id} — status: {state.status}")
            else:
                # ── Legacy fallback ───────────────────────────────────────────
                draft = await route_to_agent(signal_category, lead, db, user)
                if draft:
                    lead.processed = True
                    await db.commit()
                    print(f"Legacy agent processed lead {lead_id} with {signal_category}")
                else:
                    print(f"Failed to generate draft for lead {lead_id}")

        except Exception as e:
            print(f"Error processing lead {lead_id}: {e}")


# ─── Routes ──────────────────────────────────────────────────────────────────────

@router.post("/apify")
async def apify_webhook(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_apify_secret: str = Header(None, alias="x-apify-secret")
):
    """
    Secure webhook endpoint for Apify scrapers
    
    Security: Validates x-apify-secret header against environment variable
    Storage: Inserts raw data into leads_raw table
    Router: Triggers appropriate AI agent based on signal_category
    """
    # ─── Security Check ──────────────────────────────────────────────────────────
    if x_apify_secret != APIFY_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")
    
    # ─── Validate User Exists ────────────────────────────────────────────────────
    result = await db.execute(select(User).where(User.id == payload.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # ─── Validate Signal Category ────────────────────────────────────────────────
    valid_categories = ['warm_inbound', 'topic_authority', 'network_sniper', 'trigger_event', 'competitor_engagement']
    if payload.signal_category not in valid_categories:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid signal_category. Must be one of: {valid_categories}"
        )
    
    # ─── Store Raw Lead Data ─────────────────────────────────────────────────────
    lead = LeadRaw(
        user_id=payload.user_id,
        signal_category=payload.signal_category,
        name=payload.name,
        email=payload.email,
        job_title=payload.job_title,
        company=payload.company,
        linkedin_url=payload.linkedin_url,
        raw_payload=payload.model_dump(),
        ai_score=payload.ai_score or 2,  # Default to medium score
        processed=False
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    
    # ─── Trigger AI Agent Asynchronously ─────────────────────────────────────────
    # This runs in background so webhook responds immediately
    background_tasks.add_task(
        process_lead_async,
        lead.id,
        payload.user_id,
        payload.signal_category
    )
    
    return {
        "success": True,
        "lead_id": lead.id,
        "message": f"Lead received and queued for {payload.signal_category} agent processing"
    }


@router.get("/health")
async def webhook_health():
    """Health check for webhook endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

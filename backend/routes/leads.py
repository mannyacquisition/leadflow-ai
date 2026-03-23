"""
Routes for leads and outreach drafts
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import User, LeadRaw, OutreachDraft
from routes.auth import get_current_user
from utils.auth import encrypt_api_key, decrypt_api_key

router = APIRouter(tags=["Leads & Drafts"])


# ─── Schemas ─────────────────────────────────────────────────────────────────────

class LeadResponse(BaseModel):
    id: str
    user_id: str
    signal_category: str
    name: str | None
    email: str | None
    job_title: str | None
    company: str | None
    linkedin_url: str | None
    ai_score: int | None
    processed: bool
    created_at: datetime

class OutreachDraftResponse(BaseModel):
    id: str
    user_id: str
    lead_id: str
    subject: str | None
    body: str
    agent_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    # Nested lead info
    lead_name: str | None = None
    lead_company: str | None = None
    lead_job_title: str | None = None
    lead_linkedin_url: str | None = None
    signal_category: str | None = None

class DraftUpdateRequest(BaseModel):
    subject: str | None = None
    body: str | None = None
    status: str | None = None

class StatsResponse(BaseModel):
    total_leads: int
    hot_leads: int
    contacted: int
    replies: int

class UpdateApiKeyRequest(BaseModel):
    apify_api_token: str | None = None

class UpdateUserSettingsRequest(BaseModel):
    trigify_api_key: str | None = None
    unipile_api_key: str | None = None
    netrows_api_key: str | None = None

class CreateLeadRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    job_title: str | None = None
    company: str | None = None
    linkedin_url: str | None = None
    location: str | None = None
    signal_category: str = "manual"
    ai_score: int = 2

class UpdateLeadRequest(BaseModel):
    fit_status: str | None = None
    ai_score: int | None = None
    processed: bool | None = None


# ─── Leads Routes ────────────────────────────────────────────────────────────────

@router.get("/leads", response_model=List[LeadResponse])
async def list_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    signal_category: str = None,
    processed: bool = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List leads for current user with optional filtering"""
    query = select(LeadRaw).where(LeadRaw.user_id == user.id)
    
    if signal_category:
        query = query.where(LeadRaw.signal_category == signal_category)
    if processed is not None:
        query = query.where(LeadRaw.processed == processed)
    
    query = query.order_by(LeadRaw.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    leads = result.scalars().all()
    
    return [
        LeadResponse(
            id=l.id,
            user_id=l.user_id,
            signal_category=l.signal_category,
            name=l.name,
            email=l.email,
            job_title=l.job_title,
            company=l.company,
            linkedin_url=l.linkedin_url,
            ai_score=l.ai_score,
            processed=l.processed,
            created_at=l.created_at
        )
        for l in leads
    ]


@router.get("/leads/stats", response_model=StatsResponse)
async def get_lead_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get lead statistics for dashboard"""
    # Total leads
    total_result = await db.execute(
        select(func.count(LeadRaw.id)).where(LeadRaw.user_id == user.id)
    )
    total_leads = total_result.scalar() or 0
    
    # Hot leads (score 3)
    hot_result = await db.execute(
        select(func.count(LeadRaw.id))
        .where(LeadRaw.user_id == user.id, LeadRaw.ai_score == 3)
    )
    hot_leads = hot_result.scalar() or 0
    
    # Processed (contacted)
    contacted_result = await db.execute(
        select(func.count(LeadRaw.id))
        .where(LeadRaw.user_id == user.id, LeadRaw.processed == True)
    )
    contacted = contacted_result.scalar() or 0
    
    # Drafts with status 'sent' (replies proxy)
    replies_result = await db.execute(
        select(func.count(OutreachDraft.id))
        .where(OutreachDraft.user_id == user.id, OutreachDraft.status == 'sent')
    )
    replies = replies_result.scalar() or 0
    
    return StatsResponse(
        total_leads=total_leads,
        hot_leads=hot_leads,
        contacted=contacted,
        replies=replies
    )


# ─── Outreach Drafts Routes ──────────────────────────────────────────────────────

@router.get("/drafts", response_model=List[OutreachDraftResponse])
async def list_drafts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: str = None,
    agent_type: str = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List outreach drafts with lead info for dashboard table"""
    query = (
        select(OutreachDraft)
        .options(selectinload(OutreachDraft.lead))
        .where(OutreachDraft.user_id == user.id)
    )
    
    if status:
        query = query.where(OutreachDraft.status == status)
    if agent_type:
        query = query.where(OutreachDraft.agent_type == agent_type)
    
    query = query.order_by(OutreachDraft.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    drafts = result.scalars().all()
    
    return [
        OutreachDraftResponse(
            id=d.id,
            user_id=d.user_id,
            lead_id=d.lead_id,
            subject=d.subject,
            body=d.body,
            agent_type=d.agent_type,
            status=d.status,
            created_at=d.created_at,
            updated_at=d.updated_at,
            lead_name=d.lead.name if d.lead else None,
            lead_company=d.lead.company if d.lead else None,
            lead_job_title=d.lead.job_title if d.lead else None,
            lead_linkedin_url=d.lead.linkedin_url if d.lead else None,
            signal_category=d.lead.signal_category if d.lead else None
        )
        for d in drafts
    ]


@router.get("/drafts/{draft_id}", response_model=OutreachDraftResponse)
async def get_draft(
    draft_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single draft by ID"""
    result = await db.execute(
        select(OutreachDraft)
        .options(selectinload(OutreachDraft.lead))
        .where(OutreachDraft.id == draft_id, OutreachDraft.user_id == user.id)
    )
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return OutreachDraftResponse(
        id=draft.id,
        user_id=draft.user_id,
        lead_id=draft.lead_id,
        subject=draft.subject,
        body=draft.body,
        agent_type=draft.agent_type,
        status=draft.status,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
        lead_name=draft.lead.name if draft.lead else None,
        lead_company=draft.lead.company if draft.lead else None,
        lead_job_title=draft.lead.job_title if draft.lead else None,
        lead_linkedin_url=draft.lead.linkedin_url if draft.lead else None,
        signal_category=draft.lead.signal_category if draft.lead else None
    )


@router.patch("/drafts/{draft_id}", response_model=OutreachDraftResponse)
async def update_draft(
    draft_id: str,
    data: DraftUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a draft (edit content or change status)"""
    result = await db.execute(
        select(OutreachDraft)
        .options(selectinload(OutreachDraft.lead))
        .where(OutreachDraft.id == draft_id, OutreachDraft.user_id == user.id)
    )
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if data.subject is not None:
        draft.subject = data.subject
    if data.body is not None:
        draft.body = data.body
    if data.status is not None:
        if data.status not in ['draft', 'approved', 'sent']:
            raise HTTPException(status_code=400, detail="Invalid status")
        draft.status = data.status
    
    draft.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(draft)
    
    return OutreachDraftResponse(
        id=draft.id,
        user_id=draft.user_id,
        lead_id=draft.lead_id,
        subject=draft.subject,
        body=draft.body,
        agent_type=draft.agent_type,
        status=draft.status,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
        lead_name=draft.lead.name if draft.lead else None,
        lead_company=draft.lead.company if draft.lead else None,
        lead_job_title=draft.lead.job_title if draft.lead else None,
        lead_linkedin_url=draft.lead.linkedin_url if draft.lead else None,
        signal_category=draft.lead.signal_category if draft.lead else None
    )


@router.delete("/drafts/{draft_id}")
async def delete_draft(
    draft_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a draft"""
    result = await db.execute(
        select(OutreachDraft)
        .where(OutreachDraft.id == draft_id, OutreachDraft.user_id == user.id)
    )
    draft = result.scalar_one_or_none()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    await db.delete(draft)
    await db.commit()
    
    return {"message": "Draft deleted successfully"}

@router.post("/leads", response_model=LeadResponse)
async def create_lead(
    data: CreateLeadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a lead manually (e.g., saved from Lead Database search)"""
    lead = LeadRaw(
        user_id=user.id,
        signal_category=data.signal_category,
        name=data.name,
        email=data.email,
        job_title=data.job_title,
        company=data.company,
        linkedin_url=data.linkedin_url,
        raw_payload={"source": "manual", "location": data.location},
        ai_score=data.ai_score,
        processed=False,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return LeadResponse(
        id=lead.id, user_id=lead.user_id, signal_category=lead.signal_category,
        name=lead.name, email=lead.email, job_title=lead.job_title,
        company=lead.company, linkedin_url=lead.linkedin_url,
        ai_score=lead.ai_score, processed=lead.processed, created_at=lead.created_at
    )


@router.patch("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    data: UpdateLeadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a lead's fit status or score"""
    result = await db.execute(
        select(LeadRaw).where(LeadRaw.id == lead_id, LeadRaw.user_id == user.id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if data.ai_score is not None:
        lead.ai_score = data.ai_score
    if data.processed is not None:
        lead.processed = data.processed
    # Store fit_status in raw_payload
    if data.fit_status is not None:
        payload = dict(lead.raw_payload or {})
        payload["fit_status"] = data.fit_status
        lead.raw_payload = payload
    await db.commit()
    return {"message": "Lead updated"}


# ─── User Settings ───────────────────────────────────────────────────────────────

@router.post("/user/api-keys")
async def update_api_keys(
    data: UpdateApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user's Apify API key (stored encrypted)"""
    if data.apify_api_token is not None:
        user.apify_api_token_encrypted = encrypt_api_key(data.apify_api_token)
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "API keys updated successfully"}


@router.get("/user/api-keys/status")
async def get_api_keys_status(
    user: User = Depends(get_current_user)
):
    """Check which API keys are configured"""
    import json
    settings = {}
    if user.user_settings_json:
        try:
            settings = json.loads(decrypt_api_key(user.user_settings_json))
        except Exception:
            settings = {}
    return {
        "apify_configured": bool(user.apify_api_token_encrypted),
        "trigify_configured": bool(settings.get("trigify_api_key")),
        "unipile_configured": bool(settings.get("unipile_api_key")),
        "netrows_configured": bool(settings.get("netrows_api_key")),
    }


@router.post("/user/settings")
async def update_user_settings(
    data: UpdateUserSettingsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user's 3rd party API keys (stored encrypted as JSON)"""
    import json
    existing = {}
    if user.user_settings_json:
        try:
            existing = json.loads(decrypt_api_key(user.user_settings_json))
        except Exception:
            existing = {}
    if data.trigify_api_key is not None:
        existing["trigify_api_key"] = data.trigify_api_key
    if data.unipile_api_key is not None:
        existing["unipile_api_key"] = data.unipile_api_key
    if data.netrows_api_key is not None:
        existing["netrows_api_key"] = data.netrows_api_key
    user.user_settings_json = encrypt_api_key(json.dumps(existing))
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Settings saved successfully"}


@router.get("/user/settings")
async def get_user_settings(
    user: User = Depends(get_current_user)
):
    """Get user's stored API key hints (masked)"""
    import json
    settings = {}
    if user.user_settings_json:
        try:
            settings = json.loads(decrypt_api_key(user.user_settings_json))
        except Exception:
            settings = {}
    def mask(v):
        if not v:
            return ""
        return v[:4] + "*" * (len(v) - 4) if len(v) > 4 else "****"
    return {
        "trigify_api_key": mask(settings.get("trigify_api_key", "")),
        "unipile_api_key": mask(settings.get("unipile_api_key", "")),
        "netrows_api_key": mask(settings.get("netrows_api_key", "")),
    }

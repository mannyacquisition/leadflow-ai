"""
Signal Agent routes for configuring and managing tracked signals
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, TrackedSignal
from routes.auth import get_current_user

router = APIRouter(prefix="/signals", tags=["Signals"])


# ─── Schemas ─────────────────────────────────────────────────────────────────────

class KeywordItem(BaseModel):
    text: str
    track_mode: str = "All"

class SignalCreateRequest(BaseModel):
    name: str
    status: str = "active"
    
    # ICP
    target_job_titles: List[str] = []
    target_locations: List[str] = []
    target_industries: List[str] = []
    company_sizes: List[str] = []
    excluded_keywords: List[str] = []
    lead_matching_mode: int = 80
    
    # You & Your Company
    linkedin_page_url: str | None = None
    linkedin_profile_url: str | None = None
    track_profile_visitors: bool = False
    company_followers_url: str | None = None
    
    # Engagement & Interest
    keywords: List[KeywordItem] = []
    
    # LinkedIn Profiles
    influencer_urls: List[str] = []
    
    # Trigger Events
    track_top_profiles: bool = False
    track_funding_events: bool = False
    track_job_changes: bool = False
    
    # Competitors
    competitor_urls: List[str] = []

class SignalUpdateRequest(SignalCreateRequest):
    pass

class SignalResponse(BaseModel):
    id: str
    user_id: str
    name: str
    status: str
    target_job_titles: List[str]
    target_locations: List[str]
    target_industries: List[str]
    company_sizes: List[str]
    excluded_keywords: List[str]
    lead_matching_mode: int
    linkedin_page_url: str | None
    linkedin_profile_url: str | None
    track_profile_visitors: bool
    company_followers_url: str | None
    keywords: List[dict]
    influencer_urls: List[str]
    track_top_profiles: bool
    track_funding_events: bool
    track_job_changes: bool
    competitor_urls: List[str]
    created_at: datetime
    updated_at: datetime


# ─── Routes ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SignalResponse])
async def list_signals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all signal agents for current user"""
    result = await db.execute(
        select(TrackedSignal)
        .where(TrackedSignal.user_id == user.id)
        .order_by(TrackedSignal.created_at.desc())
    )
    signals = result.scalars().all()
    
    return [
        SignalResponse(
            id=s.id,
            user_id=s.user_id,
            name=s.name,
            status=s.status,
            target_job_titles=s.target_job_titles or [],
            target_locations=s.target_locations or [],
            target_industries=s.target_industries or [],
            company_sizes=s.company_sizes or [],
            excluded_keywords=s.excluded_keywords or [],
            lead_matching_mode=s.lead_matching_mode or 80,
            linkedin_page_url=s.linkedin_page_url,
            linkedin_profile_url=s.linkedin_profile_url,
            track_profile_visitors=s.track_profile_visitors or False,
            company_followers_url=s.company_followers_url,
            keywords=s.keywords or [],
            influencer_urls=s.influencer_urls or [],
            track_top_profiles=s.track_top_profiles or False,
            track_funding_events=s.track_funding_events or False,
            track_job_changes=s.track_job_changes or False,
            competitor_urls=s.competitor_urls or [],
            created_at=s.created_at,
            updated_at=s.updated_at
        )
        for s in signals
    ]


@router.post("/", response_model=SignalResponse)
async def create_signal(
    data: SignalCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new signal agent"""
    signal = TrackedSignal(
        user_id=user.id,
        name=data.name,
        status=data.status,
        target_job_titles=data.target_job_titles,
        target_locations=data.target_locations,
        target_industries=data.target_industries,
        company_sizes=data.company_sizes,
        excluded_keywords=data.excluded_keywords,
        lead_matching_mode=data.lead_matching_mode,
        linkedin_page_url=data.linkedin_page_url,
        linkedin_profile_url=data.linkedin_profile_url,
        track_profile_visitors=data.track_profile_visitors,
        company_followers_url=data.company_followers_url,
        keywords=[k.model_dump() for k in data.keywords],
        influencer_urls=data.influencer_urls,
        track_top_profiles=data.track_top_profiles,
        track_funding_events=data.track_funding_events,
        track_job_changes=data.track_job_changes,
        competitor_urls=data.competitor_urls
    )
    db.add(signal)
    await db.commit()
    await db.refresh(signal)
    
    return SignalResponse(
        id=signal.id,
        user_id=signal.user_id,
        name=signal.name,
        status=signal.status,
        target_job_titles=signal.target_job_titles or [],
        target_locations=signal.target_locations or [],
        target_industries=signal.target_industries or [],
        company_sizes=signal.company_sizes or [],
        excluded_keywords=signal.excluded_keywords or [],
        lead_matching_mode=signal.lead_matching_mode or 80,
        linkedin_page_url=signal.linkedin_page_url,
        linkedin_profile_url=signal.linkedin_profile_url,
        track_profile_visitors=signal.track_profile_visitors or False,
        company_followers_url=signal.company_followers_url,
        keywords=signal.keywords or [],
        influencer_urls=signal.influencer_urls or [],
        track_top_profiles=signal.track_top_profiles or False,
        track_funding_events=signal.track_funding_events or False,
        track_job_changes=signal.track_job_changes or False,
        competitor_urls=signal.competitor_urls or [],
        created_at=signal.created_at,
        updated_at=signal.updated_at
    )


@router.put("/{signal_id}", response_model=SignalResponse)
async def update_signal(
    signal_id: str,
    data: SignalUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an existing signal agent"""
    result = await db.execute(
        select(TrackedSignal)
        .where(TrackedSignal.id == signal_id, TrackedSignal.user_id == user.id)
    )
    signal = result.scalar_one_or_none()
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    # Update fields
    signal.name = data.name
    signal.status = data.status
    signal.target_job_titles = data.target_job_titles
    signal.target_locations = data.target_locations
    signal.target_industries = data.target_industries
    signal.company_sizes = data.company_sizes
    signal.excluded_keywords = data.excluded_keywords
    signal.lead_matching_mode = data.lead_matching_mode
    signal.linkedin_page_url = data.linkedin_page_url
    signal.linkedin_profile_url = data.linkedin_profile_url
    signal.track_profile_visitors = data.track_profile_visitors
    signal.company_followers_url = data.company_followers_url
    signal.keywords = [k.model_dump() for k in data.keywords]
    signal.influencer_urls = data.influencer_urls
    signal.track_top_profiles = data.track_top_profiles
    signal.track_funding_events = data.track_funding_events
    signal.track_job_changes = data.track_job_changes
    signal.competitor_urls = data.competitor_urls
    signal.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(signal)
    
    return SignalResponse(
        id=signal.id,
        user_id=signal.user_id,
        name=signal.name,
        status=signal.status,
        target_job_titles=signal.target_job_titles or [],
        target_locations=signal.target_locations or [],
        target_industries=signal.target_industries or [],
        company_sizes=signal.company_sizes or [],
        excluded_keywords=signal.excluded_keywords or [],
        lead_matching_mode=signal.lead_matching_mode or 80,
        linkedin_page_url=signal.linkedin_page_url,
        linkedin_profile_url=signal.linkedin_profile_url,
        track_profile_visitors=signal.track_profile_visitors or False,
        company_followers_url=signal.company_followers_url,
        keywords=signal.keywords or [],
        influencer_urls=signal.influencer_urls or [],
        track_top_profiles=signal.track_top_profiles or False,
        track_funding_events=signal.track_funding_events or False,
        track_job_changes=signal.track_job_changes or False,
        competitor_urls=signal.competitor_urls or [],
        created_at=signal.created_at,
        updated_at=signal.updated_at
    )


@router.delete("/{signal_id}")
async def delete_signal(
    signal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a signal agent"""
    result = await db.execute(
        select(TrackedSignal)
        .where(TrackedSignal.id == signal_id, TrackedSignal.user_id == user.id)
    )
    signal = result.scalar_one_or_none()
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    await db.delete(signal)
    await db.commit()
    
    return {"message": "Signal deleted successfully"}


@router.patch("/{signal_id}/status")
async def update_signal_status(
    signal_id: str,
    status: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update signal status (active/paused)"""
    if status not in ["active", "paused"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.execute(
        select(TrackedSignal)
        .where(TrackedSignal.id == signal_id, TrackedSignal.user_id == user.id)
    )
    signal = result.scalar_one_or_none()
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    signal.status = status
    signal.updated_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": f"Signal status updated to {status}"}

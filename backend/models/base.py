"""
SQLAlchemy models for LeadFlow AI
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    """User account with encrypted API keys"""
    __tablename__ = 'users'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Null for OAuth-only users
    full_name = Column(String(255), nullable=True)
    picture = Column(Text, nullable=True)
    
    # Encrypted API tokens (stored encrypted, not plain text)
    apify_api_token_encrypted = Column(Text, nullable=True)
    
    # OAuth fields
    google_id = Column(String(255), nullable=True, unique=True, index=True)
    auth_provider = Column(String(50), default='email')  # 'email', 'google'
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    # Relationships
    tracked_signals = relationship('TrackedSignal', back_populates='user', cascade='all, delete-orphan')
    leads_raw = relationship('LeadRaw', back_populates='user', cascade='all, delete-orphan')
    outreach_drafts = relationship('OutreachDraft', back_populates='user', cascade='all, delete-orphan')
    sessions = relationship('UserSession', back_populates='user', cascade='all, delete-orphan')


class UserSession(Base):
    """User sessions for authentication"""
    __tablename__ = 'user_sessions'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    user = relationship('User', back_populates='sessions')


class TrackedSignal(Base):
    """Intent signals configured by the user"""
    __tablename__ = 'tracked_signals'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Agent configuration
    name = Column(String(255), nullable=False)
    status = Column(String(50), default='active', index=True)  # active, paused
    
    # ICP (Ideal Customer Profile)
    target_job_titles = Column(JSON, default=list)
    target_locations = Column(JSON, default=list)
    target_industries = Column(JSON, default=list)
    company_sizes = Column(JSON, default=list)
    excluded_keywords = Column(JSON, default=list)
    lead_matching_mode = Column(Integer, default=80)
    
    # You & Your Company signals
    linkedin_page_url = Column(Text, nullable=True)
    linkedin_profile_url = Column(Text, nullable=True)
    track_profile_visitors = Column(Boolean, default=False)
    company_followers_url = Column(Text, nullable=True)
    
    # Engagement & Interest signals
    keywords = Column(JSON, default=list)  # [{text: str, track_mode: str}]
    
    # LinkedIn Profiles (Influencers)
    influencer_urls = Column(JSON, default=list)
    
    # Change & Trigger Events
    track_top_profiles = Column(Boolean, default=False)
    track_funding_events = Column(Boolean, default=False)
    track_job_changes = Column(Boolean, default=False)
    
    # Companies & Competitors
    competitor_urls = Column(JSON, default=list)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    user = relationship('User', back_populates='tracked_signals')


class LeadRaw(Base):
    """Raw webhook data from Apify scrapers"""
    __tablename__ = 'leads_raw'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Signal classification
    signal_category = Column(String(100), nullable=False, index=True)
    # Categories: 'warm_inbound', 'topic_authority', 'network_sniper', 'trigger_event', 'competitor_engagement'
    
    # Lead data
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    job_title = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True, index=True)
    linkedin_url = Column(Text, nullable=True)
    
    # Raw payload from webhook
    raw_payload = Column(JSON, nullable=False)
    
    # Processing status
    processed = Column(Boolean, default=False, index=True)
    ai_score = Column(Integer, nullable=True)  # 1-3 fire score
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    user = relationship('User', back_populates='leads_raw')
    outreach_drafts = relationship('OutreachDraft', back_populates='lead', cascade='all, delete-orphan')


class OutreachDraft(Base):
    """AI-generated email drafts"""
    __tablename__ = 'outreach_drafts'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey('leads_raw.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Draft content
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)
    
    # Agent that generated this
    agent_type = Column(String(100), nullable=False)
    # Types: 'warm_inbound', 'topic_authority', 'network_sniper', 'trigger_event', 'competitor_intercept'
    
    # Status
    status = Column(String(50), default='draft', index=True)  # draft, approved, sent
    
    # Additional context used for generation
    generation_context = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    user = relationship('User', back_populates='outreach_drafts')
    lead = relationship('LeadRaw', back_populates='outreach_drafts')

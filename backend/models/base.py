"""
SQLAlchemy models for LeadFlow AI — Phase 5 God Mode
"""
import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, ForeignKey, JSON, Float, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)


class ExecutionStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"
    pending_human_approval = "pending_human_approval"


class User(Base):
    """User account with encrypted API keys"""
    __tablename__ = 'users'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    picture = Column(Text, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    
    apify_api_token_encrypted = Column(Text, nullable=True)
    user_settings_json = Column(Text, nullable=True)
    
    google_id = Column(String(255), nullable=True, unique=True, index=True)
    auth_provider = Column(String(50), default='email')
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    tracked_signals = relationship('TrackedSignal', back_populates='user', cascade='all, delete-orphan')
    leads_raw = relationship('LeadRaw', back_populates='user', cascade='all, delete-orphan')
    outreach_drafts = relationship('OutreachDraft', back_populates='user', cascade='all, delete-orphan')
    sessions = relationship('UserSession', back_populates='user', cascade='all, delete-orphan')
    agent_configs = relationship('AgentConfig', back_populates='user', cascade='all, delete-orphan')
    execution_states = relationship('ExecutionState', back_populates='user', cascade='all, delete-orphan')
    knowledge_files = relationship('KnowledgeBase', back_populates='user')
    user_product = relationship('UserProduct', back_populates='user', uselist=False, cascade='all, delete-orphan')


class UserSession(Base):
    __tablename__ = 'user_sessions'
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    user = relationship('User', back_populates='sessions')


class TrackedSignal(Base):
    __tablename__ = 'tracked_signals'
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default='active', index=True)
    target_job_titles = Column(JSON, default=list)
    target_locations = Column(JSON, default=list)
    target_industries = Column(JSON, default=list)
    company_sizes = Column(JSON, default=list)
    excluded_keywords = Column(JSON, default=list)
    lead_matching_mode = Column(Integer, default=80)
    linkedin_page_url = Column(Text, nullable=True)
    linkedin_profile_url = Column(Text, nullable=True)
    track_profile_visitors = Column(Boolean, default=False)
    company_followers_url = Column(Text, nullable=True)
    keywords = Column(JSON, default=list)
    influencer_urls = Column(JSON, default=list)
    track_top_profiles = Column(Boolean, default=False)
    track_funding_events = Column(Boolean, default=False)
    track_job_changes = Column(Boolean, default=False)
    competitor_urls = Column(JSON, default=list)
    # ── Phase 6 AI Hub config ──────────────────────────────────────────────────
    offer_id = Column(String(36), ForeignKey('user_offers.id', ondelete='SET NULL'), nullable=True)
    playbook_id = Column(String(36), ForeignKey('user_playbooks.id', ondelete='SET NULL'), nullable=True)
    tone_id = Column(String(100), nullable=True)
    kb_file_ids = Column(JSONB, default=list)
    battlecard_ids = Column(JSONB, default=list)
    is_autopilot = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    user = relationship('User', back_populates='tracked_signals')


class LeadRaw(Base):
    __tablename__ = 'leads_raw'
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    signal_category = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    job_title = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True, index=True)
    linkedin_url = Column(Text, nullable=True)
    raw_payload = Column(JSON, nullable=False)
    processed = Column(Boolean, default=False, index=True)
    ai_score = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    user = relationship('User', back_populates='leads_raw')
    outreach_drafts = relationship('OutreachDraft', back_populates='lead', cascade='all, delete-orphan')


class OutreachDraft(Base):
    __tablename__ = 'outreach_drafts'
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey('leads_raw.id', ondelete='CASCADE'), nullable=False, index=True)
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)
    agent_type = Column(String(100), nullable=False)
    status = Column(String(50), default='draft', index=True)
    generation_context = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    user = relationship('User', back_populates='outreach_drafts')
    lead = relationship('LeadRaw', back_populates='outreach_drafts')


# ─── Phase 5 God Mode Tables ──────────────────────────────────────────────────

class AgentConfig(Base):
    """Multi-LLM agent nodes with role, RAG weights, and fallback model"""
    __tablename__ = 'agent_configs'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    agent_role = Column(String(50), default='worker')  # god, manager, worker, evaluator
    provider = Column(String(50), default='anthropic')  # anthropic, openai, gemini
    model_name = Column(String(100), default='claude-sonnet-4-5-20250929')
    fallback_provider = Column(String(50), nullable=True)
    fallback_model = Column(String(100), nullable=True)
    system_prompt = Column(Text, nullable=True)
    temperature = Column(Float, default=0.7)
    rag_weights = Column(JSONB, default=lambda: {"global": 0.3, "user": 0.5, "product": 0.2})
    is_active = Column(Boolean, default=True)
    position_x = Column(Float, default=0.0)
    position_y = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship('User', back_populates='agent_configs')
    outgoing_edges = relationship('WorkflowEdge', foreign_keys='WorkflowEdge.source_node_id', back_populates='source_node', cascade='all, delete-orphan')
    incoming_edges = relationship('WorkflowEdge', foreign_keys='WorkflowEdge.target_node_id', back_populates='target_node')
    tools = relationship('ToolRegistry', secondary='agent_tools_junction', back_populates='agents')
    knowledge_files = relationship('KnowledgeBase', secondary='agent_knowledge_junction', back_populates='agents')
    execution_states = relationship('ExecutionState', foreign_keys='ExecutionState.current_agent_id', back_populates='current_agent')


class WorkflowEdge(Base):
    """DAG edges connecting agent nodes"""
    __tablename__ = 'workflow_edges'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    source_node_id = Column(String(36), ForeignKey('agent_configs.id', ondelete='CASCADE'), nullable=False)
    target_node_id = Column(String(36), ForeignKey('agent_configs.id', ondelete='CASCADE'), nullable=False)
    condition_type = Column(String(50), nullable=False)
    # on_success, on_failure, on_webhook, if_approved, if_rejected, on_tool_failure
    signal_category = Column(String(100), nullable=True)
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    source_node = relationship('AgentConfig', foreign_keys=[source_node_id], back_populates='outgoing_edges')
    target_node = relationship('AgentConfig', foreign_keys=[target_node_id], back_populates='incoming_edges')


class ToolRegistry(Base):
    """Universal tool/integration registry"""
    __tablename__ = 'tool_registry'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    integration_type = Column(String(50), nullable=False)
    # rest, graphql, mcp, webhook, direct_sql, browser, smtp, oauth2
    endpoint_url = Column(Text, nullable=True)
    auth_headers_encrypted = Column(Text, nullable=True)
    openapi_schema = Column(JSONB, nullable=True)
    oauth_config_encrypted = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    agents = relationship('AgentConfig', secondary='agent_tools_junction', back_populates='tools')


class AgentToolsJunction(Base):
    __tablename__ = 'agent_tools_junction'
    __table_args__ = (UniqueConstraint('agent_config_id', 'tool_registry_id'),)

    id = Column(String(36), primary_key=True, default=generate_uuid)
    agent_config_id = Column(String(36), ForeignKey('agent_configs.id', ondelete='CASCADE'), nullable=False)
    tool_registry_id = Column(String(36), ForeignKey('tool_registry.id', ondelete='CASCADE'), nullable=False)


class KnowledgeBase(Base):
    """Knowledge file metadata"""
    __tablename__ = 'knowledge_base'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    file_name = Column(String(500), nullable=False)
    file_url = Column(Text, nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, image, video, text
    tags = Column(JSONB, default=list)
    is_global = Column(Boolean, default=False)
    supabase_storage_path = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship('User', back_populates='knowledge_files')
    embeddings = relationship('KnowledgeEmbedding', back_populates='knowledge_file', cascade='all, delete-orphan')
    agents = relationship('AgentConfig', secondary='agent_knowledge_junction', back_populates='knowledge_files')


class KnowledgeEmbedding(Base):
    """pgvector chunks with 3072-dim Gemini embeddings"""
    __tablename__ = 'knowledge_embeddings'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    knowledge_base_id = Column(String(36), ForeignKey('knowledge_base.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    is_global = Column(Boolean, default=False, index=True)
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    embedding = Column(Vector(3072), nullable=True)
    metadata_ = Column('metadata', JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    knowledge_file = relationship('KnowledgeBase', back_populates='embeddings')


class AgentKnowledgeJunction(Base):
    __tablename__ = 'agent_knowledge_junction'
    __table_args__ = (UniqueConstraint('agent_config_id', 'knowledge_base_id'),)

    id = Column(String(36), primary_key=True, default=generate_uuid)
    agent_config_id = Column(String(36), ForeignKey('agent_configs.id', ondelete='CASCADE'), nullable=False)
    knowledge_base_id = Column(String(36), ForeignKey('knowledge_base.id', ondelete='CASCADE'), nullable=False)


class UserProduct(Base):
    """User's product/company context for RAG injection"""
    __tablename__ = 'user_products'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    company_name = Column(String(255), nullable=True)
    product_description = Column(Text, nullable=True)
    value_proposition = Column(Text, nullable=True)
    target_audience = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship('User', back_populates='user_product')


class ExecutionState(Base):
    """Stateful multi-agent execution thread"""
    __tablename__ = 'execution_state'

    id = Column(String(36), primary_key=True, default=generate_uuid)  # = thread_id
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey('leads_raw.id', ondelete='SET NULL'), nullable=True)
    current_agent_id = Column(String(36), ForeignKey('agent_configs.id', ondelete='SET NULL'), nullable=True)
    message_history = Column(JSONB, default=list)
    final_output = Column(Text, nullable=True)
    status = Column(String(50), default='running', index=True)
    # running, completed, failed, pending_human_approval
    signal_category = Column(String(100), nullable=True)
    hitl_gate_agent_id = Column(String(36), nullable=True)
    hitl_decision = Column(String(20), nullable=True)  # approved, rejected
    total_tokens_used = Column(Integer, default=0)
    thread_metadata = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship('User', back_populates='execution_states')
    current_agent = relationship('AgentConfig', foreign_keys=[current_agent_id], back_populates='execution_states')


# ─── Phase 6 AI Hub Tables ────────────────────────────────────────────────────

class UserOffer(Base):
    """User's product/offer definitions for AI context injection"""
    __tablename__ = 'user_offers'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    internal_name = Column(String(255), nullable=False)
    external_name = Column(String(255), nullable=True)
    website_url = Column(Text, nullable=True)
    industry = Column(String(255), nullable=True)
    icp = Column(Text, nullable=True)
    pain_points = Column(Text, nullable=True)
    cost_of_inaction = Column(Text, nullable=True)
    solution_benefits = Column(Text, nullable=True)
    social_proof = Column(Text, nullable=True)
    offering_description = Column(Text, nullable=True)
    problem_solved = Column(Text, nullable=True)
    differentiator = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class UserPlaybook(Base):
    """Outreach sequence templates with Do/Don't guidelines"""
    __tablename__ = 'user_playbooks'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    initial_email_template = Column(Text, nullable=True)
    follow_up_template = Column(Text, nullable=True)
    connect_message_template = Column(Text, nullable=True)
    do_guidelines = Column(Text, nullable=True)
    dont_guidelines = Column(Text, nullable=True)
    cadence_rules = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class UserBattlecard(Base):
    """Objection handling cards for AI rebuttal injection"""
    __tablename__ = 'user_battlecards'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    objection_type = Column(String(255), nullable=False)
    rebuttal_strategy = Column(Text, nullable=True)
    example_response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class UserGuardrails(Base):
    """Per-user global safety constraints for AI generation"""
    __tablename__ = 'user_guardrails'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    blocked_keywords = Column(JSONB, default=list)
    hard_rules = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


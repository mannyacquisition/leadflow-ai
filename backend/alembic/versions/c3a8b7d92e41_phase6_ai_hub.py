"""phase6_ai_hub

Revision ID: c3a8b7d92e41
Revises: f78aa5285565
Create Date: 2026-03-23

Adds user_offers, user_playbooks, user_battlecards, user_guardrails tables
and AI Hub config columns on tracked_signals.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'c3a8b7d92e41'
down_revision = 'f78aa5285565'
branch_labels = None
depends_on = None


def upgrade():
    # ── user_offers ────────────────────────────────────────────────────────────
    op.create_table(
        'user_offers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('internal_name', sa.String(255), nullable=False),
        sa.Column('external_name', sa.String(255), nullable=True),
        sa.Column('website_url', sa.Text, nullable=True),
        sa.Column('industry', sa.String(255), nullable=True),
        sa.Column('icp', sa.Text, nullable=True),
        sa.Column('pain_points', sa.Text, nullable=True),
        sa.Column('cost_of_inaction', sa.Text, nullable=True),
        sa.Column('solution_benefits', sa.Text, nullable=True),
        sa.Column('social_proof', sa.Text, nullable=True),
        sa.Column('offering_description', sa.Text, nullable=True),
        sa.Column('problem_solved', sa.Text, nullable=True),
        sa.Column('differentiator', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_user_offers_user_id', 'user_offers', ['user_id'])

    # ── user_playbooks ─────────────────────────────────────────────────────────
    op.create_table(
        'user_playbooks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('initial_email_template', sa.Text, nullable=True),
        sa.Column('follow_up_template', sa.Text, nullable=True),
        sa.Column('connect_message_template', sa.Text, nullable=True),
        sa.Column('do_guidelines', sa.Text, nullable=True),
        sa.Column('dont_guidelines', sa.Text, nullable=True),
        sa.Column('cadence_rules', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_user_playbooks_user_id', 'user_playbooks', ['user_id'])

    # ── user_battlecards ───────────────────────────────────────────────────────
    op.create_table(
        'user_battlecards',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('objection_type', sa.String(255), nullable=False),
        sa.Column('rebuttal_strategy', sa.Text, nullable=True),
        sa.Column('example_response', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_user_battlecards_user_id', 'user_battlecards', ['user_id'])

    # ── user_guardrails ────────────────────────────────────────────────────────
    op.create_table(
        'user_guardrails',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('blocked_keywords', JSONB, nullable=True),
        sa.Column('hard_rules', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── tracked_signals — AI Hub config columns ────────────────────────────────
    op.add_column('tracked_signals', sa.Column('offer_id', sa.String(36), sa.ForeignKey('user_offers.id', ondelete='SET NULL'), nullable=True))
    op.add_column('tracked_signals', sa.Column('playbook_id', sa.String(36), sa.ForeignKey('user_playbooks.id', ondelete='SET NULL'), nullable=True))
    op.add_column('tracked_signals', sa.Column('tone_id', sa.String(100), nullable=True))
    op.add_column('tracked_signals', sa.Column('kb_file_ids', JSONB, nullable=True))
    op.add_column('tracked_signals', sa.Column('battlecard_ids', JSONB, nullable=True))
    op.add_column('tracked_signals', sa.Column('is_autopilot', sa.Boolean(), nullable=True, server_default='false'))


def downgrade():
    op.drop_column('tracked_signals', 'is_autopilot')
    op.drop_column('tracked_signals', 'battlecard_ids')
    op.drop_column('tracked_signals', 'kb_file_ids')
    op.drop_column('tracked_signals', 'tone_id')
    op.drop_column('tracked_signals', 'playbook_id')
    op.drop_column('tracked_signals', 'offer_id')
    op.drop_index('ix_user_battlecards_user_id', 'user_battlecards')
    op.drop_table('user_battlecards')
    op.drop_index('ix_user_playbooks_user_id', 'user_playbooks')
    op.drop_table('user_playbooks')
    op.drop_index('ix_user_offers_user_id', 'user_offers')
    op.drop_table('user_offers')
    op.drop_table('user_guardrails')

"""phase7_monara_agency

Revision ID: d4e9f1a3b5c7
Revises: c3a8b7d92e41
Create Date: 2026-03-23

Adds:
- agent_configs.output_type
- tool_registry: use_user_credential, credential_key, handler_name, requires_confirmation
- chat_sessions table (Monara persistent memory)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'd4e9f1a3b5c7'
down_revision = 'c3a8b7d92e41'
branch_labels = None
depends_on = None


def upgrade():
    # agent_configs — output_type
    op.add_column('agent_configs', sa.Column('output_type', sa.String(50), nullable=True, server_default='email_draft'))

    # tool_registry — agency columns
    op.add_column('tool_registry', sa.Column('use_user_credential', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('tool_registry', sa.Column('credential_key', sa.String(100), nullable=True))
    op.add_column('tool_registry', sa.Column('handler_name', sa.String(100), nullable=True))
    op.add_column('tool_registry', sa.Column('requires_confirmation', sa.Boolean(), nullable=True, server_default='false'))

    # chat_sessions
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_config_id', sa.String(36), sa.ForeignKey('agent_configs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(255), nullable=True, server_default='New Chat'),
        sa.Column('messages', JSONB, nullable=True),
        sa.Column('api_history', JSONB, nullable=True),
        sa.Column('pending_tool_call', JSONB, nullable=True),
        sa.Column('model_used', sa.String(100), nullable=True, server_default='claude-sonnet-4-5-20250929'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_chat_sessions_user_id', 'chat_sessions', ['user_id'])


def downgrade():
    op.drop_index('ix_chat_sessions_user_id', 'chat_sessions')
    op.drop_table('chat_sessions')
    op.drop_column('tool_registry', 'requires_confirmation')
    op.drop_column('tool_registry', 'handler_name')
    op.drop_column('tool_registry', 'credential_key')
    op.drop_column('tool_registry', 'use_user_credential')
    op.drop_column('agent_configs', 'output_type')

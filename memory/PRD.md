# LeadFlow AI - Product Requirements Document

## Project Overview
**LeadFlow AI** is a B2B SaaS intent-signal monitoring platform that monitors LinkedIn engagement signals, captures leads, and generates personalized AI-powered cold emails.

## Original Problem Statement
- Build backend infrastructure for existing React/Vite frontend
- Implement authentication (Email/Password + Google OAuth)
- PostgreSQL with Supabase (RLS for multi-tenant)
- 5 AI Worker Agents using Claude Sonnet 4.5
- Secure webhook system for Apify scrapers
- Real-time updates via Supabase Realtime

## User Personas
1. **B2B Sales Teams** - Need automated lead generation from intent signals
2. **Growth Marketers** - Want to identify and engage warm leads
3. **SDRs** - Need personalized email drafts at scale

## Core Requirements (Static)
- [x] User authentication (Email/Password + Google OAuth)
- [x] PostgreSQL database with RLS (Supabase)
- [x] Signal Agent configuration UI
- [x] Webhook endpoint for Apify scrapers
- [x] 5 AI Worker Agents for email generation
- [x] Dashboard with lead statistics
- [ ] Real-time updates via Supabase Realtime (pending DB config)

## Architecture

### Backend (FastAPI)
```
/app/backend/
├── server.py          # Main FastAPI app
├── database.py        # SQLAlchemy async config
├── models/            # User, TrackedSignal, LeadRaw, OutreachDraft
├── routes/
│   ├── auth.py        # Email/Password + Google OAuth
│   ├── signals.py     # Signal agent CRUD
│   ├── webhook.py     # Apify webhook dispatcher
│   └── leads.py       # Leads & drafts endpoints
├── agents/
│   └── workers.py     # 5 AI worker agents (Claude)
└── utils/
    └── auth.py        # JWT, password hashing, encryption
```

### Frontend (Vite + React)
```
/app/frontend/src/
├── App.jsx            # Router with protected routes
├── api/client.js      # API client (replaces Base44 SDK)
├── lib/AuthProvider.jsx # Auth context
├── pages/
│   ├── Login.jsx      # Email/Password + Google OAuth
│   ├── Dashboard.jsx  # Stats, leads, drafts
│   └── SignalsAgents.jsx # Agent configuration
```

## What's Been Implemented (Jan 2026)

### Phase 1: Authentication & Database Schema ✅
- [x] FastAPI backend with SQLAlchemy async
- [x] User model with encrypted API keys
- [x] TrackedSignal, LeadRaw, OutreachDraft models
- [x] JWT authentication with session tokens
- [x] Emergent-managed Google OAuth integration
- [x] Alembic setup for migrations

### Phase 2: Secure Dispatcher Webhook ✅
- [x] POST /api/webhook/apify endpoint
- [x] x-apify-secret header validation
- [x] Signal category routing to AI agents
- [x] Background task processing

### Phase 3: AI Worker Agents ✅
- [x] Warm Inbound Agent
- [x] Topic Authority Agent
- [x] Network Sniper Agent
- [x] Trigger Event Agent (with Apify news fetching)
- [x] Competitor Intercept Agent

### Phase 4: Frontend Wiring ✅
- [x] Login/Register page with Google OAuth
- [x] Protected routes with auth redirect
- [x] Dashboard with stats cards
- [x] Signal Agents page with CRUD
- [x] API client replacing Base44 SDK

## Prioritized Backlog

### P0 - Critical (User Action Required)
1. Configure DATABASE_URL (Supabase Transaction Pooler)
2. Configure ANTHROPIC_API_KEY

### P1 - High Priority
1. Test full auth flow after DB config
2. Test webhook → AI agent → draft pipeline
3. Implement Supabase Realtime subscriptions

### P2 - Medium Priority
1. Settings page for API key management
2. Draft editing and approval workflow
3. Lead list filtering and export

## Environment Variables Checklist

```bash
# /app/backend/.env

# REQUIRED - Supabase PostgreSQL
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# REQUIRED - For AI email generation
ANTHROPIC_API_KEY=sk-ant-...

# CONFIGURED - Webhook security
APIFY_WEBHOOK_SECRET=leadflow-webhook-secret-change-me

# CONFIGURED - JWT auth
JWT_SECRET_KEY=leadflow-ai-super-secret-key-change-in-production

# AUTO-GENERATED - API key encryption
ENCRYPTION_KEY=
```

## Next Tasks
1. User provides Supabase Transaction Pooler URI
2. Run Alembic migrations: `cd /app/backend && alembic revision --autogenerate -m "Initial" && alembic upgrade head`
3. Test complete auth flow
4. Test webhook with sample Apify payload

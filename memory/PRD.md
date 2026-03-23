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

## User Choices
- Database: External Supabase PostgreSQL (Option A - external DB)
- Auth: Email/Password + Emergent Google OAuth
- AI: Claude Sonnet 4.5 with user's own ANTHROPIC_API_KEY
- Real-time: Supabase Realtime subscriptions (pending)

## What's Been Implemented

### Phase 1: Authentication & Database ✅
- FastAPI backend with SQLAlchemy async + Alembic
- PostgreSQL tables: users, tracked_signals, leads_raw, outreach_drafts, user_sessions
- JWT authentication with session tokens + session persistence
- Emergent-managed Google OAuth
- Encrypted API key storage (Fernet) for Apify + Trigify/Unipile/Netrows

### Phase 2: Secure Webhook ✅
- POST /api/webhook/apify with x-apify-secret validation
- Signal category routing (5 categories)
- Background task processing

### Phase 3: AI Agents ✅
- Warm Inbound Agent
- Topic Authority Agent
- Network Sniper Agent
- Trigger Event Agent (with Apify news fetching)
- Competitor Intercept Agent

### Phase 4: Frontend Wiring ✅ (March 2026)
- Login/Register pages + Google OAuth
- Protected routes with session persistence
- Dashboard with real stats (leads, hot leads, drafts, sent)
- InsightsPanel wired to /api/ai/insights (Claude-powered)
- SystemHealthBadge wired to /api/health
- Copilot page wired to /api/drafts (approve/remove drafts)
- Contacts page wired to /api/leads (real data, fit status update)
- Settings API tab wired to /api/user/settings (Trigify/Unipile/Netrows/Apify keys)
- CommandCenter Monara AI wired to /api/ai/chat (Claude Sonnet 4.5)
- Campaigns page wired to /api/signals (shows signal agents as campaigns)
- Unibox wired to /api/drafts (shows outreach as conversations)
- LeadDatabase UI intact (Netrows search requires API key - stubbed gracefully)
- Removed ALL Base44 SDK references across 10 files

### New Backend Endpoints (March 2026) ✅
- POST /api/leads - create lead manually
- PATCH /api/leads/{id} - update fit_status/score
- POST /api/ai/chat - Claude Sonnet chat
- GET /api/ai/insights - dashboard insights
- POST /api/ai/insights/generate - AI-powered insights refresh
- GET/POST /api/user/settings - generic API key storage

## Test Results (Iteration 3)
- Backend: 100% (31/31 tests passed)
- Frontend: 95% (all pages load, session persistence verified)
- AI Chat: Claude Sonnet 4.5 verified working
- Mocked: Netrows B2B search, Unibox send, email enrichment

## Environment Variables (Production)
```
DATABASE_URL=postgresql://postgres.xxx:PASSWORD@aws-1-us-east-1.pooler.supabase.com:6543/postgres
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET_KEY=<secure-random>
APIFY_WEBHOOK_SECRET=<secure-random>
ENCRYPTION_KEY=<fernet-key>
```

## Pending / Next Tasks (Prioritized)

### P0 (High Priority)
- Supabase Realtime WebSocket integration - Dashboard auto-updates when AI Agent finishes a draft
- Apify webhook payload parsing + MoE routing in /api/apify-webhook

### P1 (Medium Priority)
- Netrows API integration in LeadDatabase (requires user's Netrows API key)
- Unibox real send functionality (requires Unipile API key)
- Email enrichment in Contacts (requires enrichment provider)
- Apify tool calling in Trigger Event Agent (workers.py)

### P2 (Low Priority)
- Supabase RLS policies for multi-tenant isolation
- Email queuing with retry logic (Redis-backed)
- Settings → Company/Account/Security tabs

## Architecture
```
/app/
├── backend/
│   ├── agents/workers.py (5 AI Claude Agents)
│   ├── alembic/ (DB migrations)
│   ├── models/base.py (Users, TrackedSignals, LeadsRaw, OutreachDrafts)
│   ├── routes/
│   │   ├── auth.py (login, register, google oauth)
│   │   ├── leads.py (leads CRUD + user settings)
│   │   ├── signals.py (signal agents CRUD)
│   │   ├── webhook.py (Apify webhook)
│   │   └── ai_chat.py (Claude chat + insights)
│   ├── utils/auth.py (JWT, encryption)
│   ├── database.py
│   └── server.py
└── frontend/
    ├── src/
    │   ├── api/client.js (API client)
    │   ├── lib/AuthProvider.jsx (auth context)
    │   ├── pages/ (Dashboard, Copilot, Contacts, Settings, etc.)
    │   └── components/ (InsightsPanel, SystemHealthBadge, etc.)
    └── .env (VITE_API_URL=)
```

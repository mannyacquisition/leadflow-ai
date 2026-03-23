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
- Real-time: Supabase Realtime subscriptions

## What's Been Implemented (March 2026)

### Phase 1: Authentication & Database ✅
- [x] FastAPI backend with SQLAlchemy async + Alembic
- [x] PostgreSQL tables: users, tracked_signals, leads_raw, outreach_drafts, user_sessions
- [x] JWT authentication with session tokens
- [x] Emergent-managed Google OAuth
- [x] Encrypted API key storage (Fernet)

### Phase 2: Secure Webhook ✅
- [x] POST /api/webhook/apify with x-apify-secret validation
- [x] Signal category routing (5 categories)
- [x] Background task processing

### Phase 3: AI Agents ✅
- [x] Warm Inbound Agent
- [x] Topic Authority Agent
- [x] Network Sniper Agent
- [x] Trigger Event Agent (with Apify news fetching)
- [x] Competitor Intercept Agent

### Phase 4: Frontend Wiring ✅
- [x] Login/Register pages
- [x] Protected routes with session persistence
- [x] Dashboard with stats
- [x] Signal Agents configuration wizard
- [x] Removed legacy Base44 SDK

## Deployment Status
- ✅ Backend 100% working (all API endpoints tested)
- ✅ Frontend 100% working (auth flow, session persistence)
- ✅ External Supabase PostgreSQL configured
- ✅ CORS configured for production
- ✅ Encryption keys generated
- ⚠️ Uses external DB (not Emergent MongoDB) - requires DATABASE_URL in deployment

## Environment Variables (Production)
```
DATABASE_URL=postgresql://postgres.xxx:PASSWORD@aws-1-us-east-1.pooler.supabase.com:6543/postgres
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET_KEY=<secure-random>
APIFY_WEBHOOK_SECRET=<secure-random>
ENCRYPTION_KEY=<fernet-key>
```

## Next Tasks
- Add Supabase RLS policies for multi-tenant isolation
- Implement Supabase Realtime subscriptions
- Settings page for user API key management

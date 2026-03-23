# LeadFlow AI — Product Requirements Document

## Original Problem Statement
Build a B2B SaaS application called "Leadflow AI" (an intent-signal monitoring platform).
Connect a new FastAPI backend to an existing React/Vite UI. Multi-phase build culminating
in a God Mode multi-agent orchestration platform.

## Core Architecture
- **Frontend**: React + Vite + TailwindCSS + React Flow (DAG viz)
- **Backend**: FastAPI + SQLAlchemy (Async) + Alembic
- **Database**: External Supabase PostgreSQL + pgvector extension
- **AI**: Anthropic Claude Sonnet 4.5 (user key), Gemini embeddings (3072-dim), Emergent Universal Key (multi-LLM)
- **Auth**: JWT Email/Password + Emergent-managed Google OAuth

---

## What's Been Implemented

### Phase 1–4 Core App (COMPLETE)
- JWT Email/Password auth + Google OAuth login
- Secure Apify webhook (`/api/webhook/apify`) with `x-apify-secret` validation
- 5 AI Worker Agents: Warm Inbound, Topic Authority, Network Sniper, Trigger Event (Apify news), Competitor Intercept
- Full frontend: Dashboard, Contacts, Copilot, Campaigns, Signals Agents, Unibox, Insights, Integrations, Command Center, Settings, Lead Database
- Base44 SDK fully replaced with custom `client.js`

### Phase 5 God Mode (COMPLETE)
- 9 new DB tables: agent_configs, workflow_edges, tool_registry, knowledge_base, knowledge_embeddings (pgvector 3072-dim), execution_state, agent_tools_junction, agent_knowledge_junction, user_products
- Backend services: orchestrator.py (AsyncAnthropic), embedding.py (Gemini), rag_retriever.py, tool_executor.py (REST/GraphQL/OAuth/Apify/Browser/SMTP), storage.py
- Admin routes: full CRUD for agents, edges, tools, KB, execution logs, HITL approval, WebSocket streaming
- Frontend admin: /admin with Agent Studio (React Flow DAG), Knowledge Base, Tool Registry, Execution Logs, Overview
- Webhook dual-routing: God Mode GraphExecutor if user has agent_configs, else legacy workers fallback
- Bug fixes: _get_entry_agent MultipleResultsFound (scalars().first()), KB search empty-table graceful return

### Phase 6 AI Hub (COMPLETE — 2026-03-23)
- **DB**: 4 new tables: user_offers, user_playbooks, user_battlecards, user_guardrails
- **DB**: 6 new columns on tracked_signals: offer_id, playbook_id, tone_id, kb_file_ids, battlecard_ids, is_autopilot
- **Backend**: `/api/hub/*` routes — full CRUD for all hub resources, user-scoped KB upload, tone preference, URL scrape → AI offer fill
- **Backend**: workers.py — build_campaign_context() injects tone/offer/playbook/battlecards/guardrails into system prompt
- **Backend**: webhook.py — passes active campaign config to legacy route_to_agent()
- **Frontend**: /AiHub page with 6 tabs: Knowledge Base, Tone, Offers, Playbooks, Battlecards, Guardrails
- **Frontend**: AgentWizard step 4 "AI Configuration" — dropdowns for offer/playbook/tone, multi-select KB files/battlecards, Autopilot/Copilot toggle
- **Frontend**: Layout.jsx — AI Hub nav item added (BrainCircuit icon)

---

## Prioritized Backlog

### P0 (Next Sprint)
- Supabase Realtime WebSocket for dashboard auto-updates when drafts are generated
- Wire real Apify scrapers to send payloads to /api/webhook/apify end-to-end test
- Admin panel: manny@monara.vip needs is_admin=true in Supabase DB

### P1
- Supabase RLS policies for multi-tenant row-level isolation
- Email sending integration (SMTP / SendGrid) to honor is_autopilot=true properly
- Multi-LLM dynamic routing using Emergent Universal Key (Claude/GPT/Gemini selection per agent)

### P2 (Backlog)
- Redis-backed email queue with retry logic
- Settings → Company/Account/Security tabs
- Seed default agent graph (5 legacy agents pre-loaded as agent_configs) for new users
- Webhook → God Mode orchestrator HITL approval flow in the frontend Unibox

---

## Key API Endpoints
- POST `/api/auth/register` / `/api/auth/login` / GET `/api/auth/me`
- POST `/api/webhook/apify` (x-apify-secret header)
- GET/POST/PATCH/DELETE `/api/signals/`
- GET/POST/PATCH/DELETE `/api/hub/offers`
- POST `/api/hub/offers/scrape`
- GET/POST/PATCH/DELETE `/api/hub/playbooks`
- GET/POST/PATCH/DELETE `/api/hub/battlecards`
- GET/POST `/api/hub/guardrails`
- GET/POST `/api/hub/tone`
- GET `/api/hub/knowledge/files` / POST `/api/hub/knowledge/upload`
- GET/POST/PATCH/DELETE `/api/admin/*` (is_admin required)
- POST `/api/admin/orchestration/threads/simulate`
- GET `/api/health`

## Credentials / Keys
- DATABASE_URL: Supabase connection pooler (in backend/.env)
- ANTHROPIC_API_KEY: User-provided Claude key (in backend/.env)
- GEMINI_API_KEY: User-provided Gemini key for embeddings (in backend/.env)
- APIFY_WEBHOOK_SECRET: Webhook validation (in backend/.env)
- JWT_SECRET_KEY: Token signing (in backend/.env)

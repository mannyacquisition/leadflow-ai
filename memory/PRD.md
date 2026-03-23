# LeadFlow AI — Product Requirements Document

## Original Problem Statement
B2B SaaS "LeadFlow AI" — intent-signal monitoring platform.
FastAPI + React/Vite + Supabase PostgreSQL + pgvector. Multi-phase build.

## Core Architecture
- **Frontend**: React + Vite + TailwindCSS + React Flow (admin DAG)
- **Backend**: FastAPI + SQLAlchemy Async + Alembic
- **Database**: Supabase PostgreSQL + pgvector
- **AI**: Anthropic Claude Sonnet 4.5, Gemini embeddings (3072-dim), Emergent Universal Key
- **Auth**: JWT Email/Password + Emergent Google OAuth

---

## What's Been Implemented

### Phase 1–4 Core (COMPLETE)
JWT auth, Apify webhook, 5 AI SDR agents (workers.py), full React UI, Base44 removed.

### Phase 5 God Mode (COMPLETE)
9 new DB tables, orchestrator.py (AsyncAnthropic), RAG (Gemini embeddings), tool_executor (REST/GraphQL/Apify/Browser/SMTP), Admin panel with React Flow Agent Studio, HITL, WebSocket.

### Phase 6 AI Hub (COMPLETE — 2026-03-23)
4 new tables (user_offers, user_playbooks, user_battlecards, user_guardrails), 6 new columns on tracked_signals (offer_id, playbook_id, tone_id, kb_file_ids, battlecard_ids, is_autopilot).
/api/hub/* CRUD, URL scrape → AI offer auto-fill, build_campaign_context() for system prompt injection.
AiHub.jsx (6 tabs), AgentWizard Step 4 AI Config, Autopilot/Copilot toggle.

### Phase 7 Monara Agency (COMPLETE — 2026-03-23)
All 12 architectural gaps resolved:

**DB migrations (d4e9f1a3b5c7):**
- `agent_configs.output_type` (email_draft | chat_response | report)
- `tool_registry`: use_user_credential, credential_key, handler_name, requires_confirmation
- NEW `chat_sessions` table (id, user_id, messages JSONB, api_history JSONB, pending_tool_call JSONB)

**Backend services:**
- `services/ws_manager.py` — UserConnectionManager, per-user WebSocket pool
- `services/internal_tool_executor.py` — 11 internal CRUD tools (get_dashboard_stats, list/create/delete_campaign, list/approve/delete_drafts, approve_all_drafts, search_contacts, update_tone, list_offers) with mutation events
- `services/monara_engine.py` — MonaraEngine with chat_stream() ReAct loop (SSE streaming, tool-use, confirmation gates, session persistence, user_id auth enforcement)
- `orchestrator.py` — auto-creates OutreachDraft on completion when output_type=email_draft (Gap 5)
- `tool_executor.py` — use_user_credential passthrough for personal API keys (Gap 2)

**Backend routes:**
- `routes/monara.py` — POST /monara/chat/stream (SSE), GET/DELETE /monara/sessions, GET /monara/session, POST /monara/confirm/{id}, POST /monara/cancel/{id}, WS /monara/ws/{user_id}

**Frontend:**
- `hooks/useMonaraSync.js` — WebSocket mutation event bus (auto-reconnect, typed handlers)
- `components/monara/MonaraPanel.jsx` — full SSE streaming chat UI, word-by-word tokens, inline confirm/cancel, tool_status indicators, New Chat button
- `Layout.jsx` — useMonaraSync(user.id) wired at login

---

## Prioritized Backlog

### P0 (Next)
- **Seeder**: Seed agent_configs with the 5 legacy SDR agents + Monara node so Agent Studio shows them
- Set is_admin=true for manny@monara.vip in Supabase
- End-to-end test: wire Apify → webhook → God Mode with a real agent_config that has output_type=email_draft → verify OutreachDraft appears in Unibox

### P1
- Supabase Realtime for dashboard auto-refresh (alternative to WebSocket polling)
- Email sending integration (SMTP/SendGrid) to honour is_autopilot=true
- Multi-LLM routing with Emergent Universal Key (GPT/Gemini alongside Claude)

### P2 (Backlog)
- Supabase RLS policies for multi-tenant row isolation
- Redis email queue with retry
- Settings → Company/Account/Security tabs
- onMonaraMutation() hooks in Campaigns/Unibox components for silent refresh

---

## Key API Endpoints
- POST /api/auth/register|login, GET /api/auth/me
- POST /api/webhook/apify
- /api/signals/* — campaign CRUD (now with AI Hub fields)
- /api/hub/* — offers, playbooks, battlecards, guardrails, tone, knowledge
- /api/admin/* — God Mode admin (is_admin required)
- POST /api/monara/chat/stream — SSE streaming ReAct chat
- GET /api/monara/session, GET /api/monara/sessions
- POST /api/monara/confirm|cancel/{session_id}
- WS /api/monara/ws/{user_id}
- GET /api/health

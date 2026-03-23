"""
Phase 7 Seeder — Seeds the 5 legacy SDR agents + Monara into agent_configs
and creates matching workflow_edges for on_webhook routing.
Also sets is_admin=True for manny@monara.vip.
Safe to re-run — idempotent (skips existing entries by name+user).
"""
import asyncio
import os
import sys
import uuid
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

DATABASE_URL = os.environ["DATABASE_URL"]
# Convert postgres:// → postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

TARGET_EMAIL = "manny@monara.vip"
MODEL = "claude-sonnet-4-5-20250929"


# ─── Agent definitions ────────────────────────────────────────────────────────

AGENTS = [
    {
        "name": "Warm Inbound SDR",
        "signal_category": "warm_inbound",
        "agent_role": "worker",
        "output_type": "email_draft",
        "system_prompt": """You are an expert B2B sales copywriter specializing in warm outreach.
Your goal is to draft a personalized, human-sounding cold email for someone who has engaged with the host brand's content.

Style guidelines:
- Be conversational and natural, not salesy
- Reference their specific engagement (like, comment, or visit)
- Ask a soft discovery question rather than pushing for a meeting
- Keep it under 100 words
- No generic phrases like "I hope this email finds you well"
- Sound like a human, not an AI

Format your response as:
Subject: [engaging subject line]

[email body]""",
    },
    {
        "name": "Topic Authority SDR",
        "signal_category": "topic_authority",
        "agent_role": "worker",
        "output_type": "email_draft",
        "system_prompt": """You are an expert B2B sales copywriter specializing in thought leadership outreach.
Your goal is to draft a personalized email based on the specific industry keywords the lead engaged with.

Style guidelines:
- Reference the specific topic/keyword they showed interest in
- Position yourself as knowledgeable in that space
- Share a quick insight or ask their opinion on the topic
- Be intellectually curious, not pushy
- Keep it under 100 words
- Sound genuinely interested in the topic

Format your response as:
Subject: [engaging subject line about the topic]

[email body]""",
    },
    {
        "name": "Network Sniper SDR",
        "signal_category": "network_sniper",
        "agent_role": "worker",
        "output_type": "email_draft",
        "system_prompt": """You are an expert B2B sales copywriter specializing in relationship-based outreach.
Your goal is to draft a personalized email referencing shared influencers or thought leaders they follow.

Style guidelines:
- Mention the specific influencer/thought leader as common ground
- Reference their content or recent post if available
- Use it as a natural conversation starter
- Be genuine about the connection, not manipulative
- Keep it under 100 words
- Make it feel like reaching out to a fellow community member

Format your response as:
Subject: [subject referencing shared connection/interest]

[email body]""",
    },
    {
        "name": "Trigger Event SDR",
        "signal_category": "trigger_event",
        "agent_role": "worker",
        "output_type": "email_draft",
        "system_prompt": """You are an expert B2B sales copywriter specializing in timely, event-based outreach.
Your goal is to draft a personalized email referencing recent company news (funding, hiring, expansion).

Style guidelines:
- Congratulate them genuinely on the news
- Connect the news to a relevant pain point or opportunity
- Offer specific value related to their growth
- Be timely and relevant, not generic
- Keep it under 120 words
- Show you did your homework

Format your response as:
Subject: [subject referencing the specific news]

[email body]""",
        "needs_apify_tool": True,
    },
    {
        "name": "Competitor Intercept SDR",
        "signal_category": "competitor_engagement",
        "agent_role": "worker",
        "output_type": "email_draft",
        "system_prompt": """You are an expert B2B sales copywriter specializing in competitive positioning.
Your goal is to draft a pattern-interrupt email for someone engaging with competitors.

Style guidelines:
- DO NOT bash the competitor directly
- Focus on curiosity and alternative perspectives
- Highlight a unique differentiator or approach
- Ask what they're looking for in a solution
- Be confident but not arrogant
- Keep it under 100 words
- Position as an alternative worth exploring

Format your response as:
Subject: [intriguing subject that sparks curiosity]

[email body]""",
    },
]

MONARA_AGENT = {
    "name": "Monara",
    "signal_category": None,  # triggered by on_user_message, not webhook
    "agent_role": "god",
    "output_type": "chat_response",
    "system_prompt": """You are Monara, an intelligent AI assistant built into LeadFlow AI — a B2B sales automation platform.

You help users manage their leads, campaigns, email drafts, and AI configuration. You can take real actions using the tools available to you.

Guidelines:
- Be concise. Users are busy. Lead with the result.
- For data reads, act immediately and report what you found.
- For writes (creating campaigns, approving drafts), execute and confirm.
- Destructive actions (delete, bulk-approve) are automatically gated — just call the tool.
- Format lists with bullet points. Keep explanations brief.
- If asked to do something outside your tools, say so clearly.
- Never fabricate data. If you don't know, say so.""",
}


def gen_id():
    return str(uuid.uuid4())


async def seed():
    async with async_session() as db:
        # ── 1. Find the target user ───────────────────────────────────────────
        res = await db.execute(text("SELECT id, email, is_admin FROM users WHERE email = :email"), {"email": TARGET_EMAIL})
        row = res.fetchone()
        if not row:
            print(f"[WARN] User {TARGET_EMAIL} not found. Seeding agents for first available user...")
            res2 = await db.execute(text("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1"))
            row = res2.fetchone()
            if not row:
                print("[ERROR] No users found at all. Register a user first.")
                return

        user_id, email, *_ = row
        print(f"[INFO] Target user: {email} (id: {user_id})")

        # ── 2. Set is_admin = true ────────────────────────────────────────────
        await db.execute(
            text("UPDATE users SET is_admin = true WHERE id = :uid"),
            {"uid": user_id},
        )
        await db.commit()
        print(f"[OK] is_admin=true set for {email}")

        # ── 3. Seed the 5 SDR agents + Monara ────────────────────────────────
        all_agents = AGENTS + [MONARA_AGENT]
        seeded_agents = {}  # name → id

        for agent_def in all_agents:
            # Check if already exists (idempotent)
            res = await db.execute(
                text("SELECT id FROM agent_configs WHERE user_id = :uid AND name = :name"),
                {"uid": user_id, "name": agent_def["name"]},
            )
            existing = res.fetchone()
            if existing:
                seeded_agents[agent_def["name"]] = existing[0]
                print(f"[SKIP] {agent_def['name']} already exists (id: {existing[0]})")
                continue

            agent_id = gen_id()
            await db.execute(
                text("""
                    INSERT INTO agent_configs
                        (id, user_id, name, agent_role, provider, model_name,
                         output_type, system_prompt, temperature, is_active,
                         rag_weights, position_x, position_y)
                    VALUES
                        (:id, :user_id, :name, :role, 'anthropic', :model,
                         :output_type, :system_prompt, 0.7, true,
                         '{"global": 0.3, "user": 0.5, "product": 0.2}'::jsonb,
                         :px, :py)
                """),
                {
                    "id": agent_id,
                    "user_id": user_id,
                    "name": agent_def["name"],
                    "role": agent_def["agent_role"],
                    "model": MODEL,
                    "output_type": agent_def["output_type"],
                    "system_prompt": agent_def["system_prompt"],
                    "px": 100 + (all_agents.index(agent_def) * 220),
                    "py": 200,
                },
            )
            seeded_agents[agent_def["name"]] = agent_id
            print(f"[OK] Seeded agent: {agent_def['name']} (id: {agent_id})")

        await db.commit()

        # ── 4. Seed workflow_edges (on_webhook for each SDR agent) ────────────
        for agent_def in AGENTS:
            if not agent_def.get("signal_category"):
                continue
            agent_id = seeded_agents.get(agent_def["name"])
            if not agent_id:
                continue

            # Check if edge already exists
            res = await db.execute(
                text("SELECT id FROM workflow_edges WHERE source_node_id = :sid AND condition_type = 'on_webhook'"),
                {"sid": agent_id},
            )
            if res.fetchone():
                print(f"[SKIP] Edge for {agent_def['name']} already exists")
                continue

            edge_id = gen_id()
            await db.execute(
                text("""
                    INSERT INTO workflow_edges
                        (id, user_id, source_node_id, target_node_id,
                         condition_type, signal_category)
                    VALUES
                        (:id, :uid, :src, :tgt, 'on_webhook', :sig)
                """),
                {
                    "id": edge_id,
                    "uid": user_id,
                    "src": agent_id,
                    "tgt": agent_id,   # self-loop — this is the entry node
                    "sig": agent_def["signal_category"],
                },
            )
            print(f"[OK] Edge: on_webhook/{agent_def['signal_category']} → {agent_def['name']}")

        await db.commit()

        # ── 5. Seed Apify tool for Trigger Event agent ────────────────────────
        trigger_id = seeded_agents.get("Trigger Event SDR")
        if trigger_id:
            # Check if tool already exists
            res = await db.execute(
                text("SELECT id FROM tool_registry WHERE user_id = :uid AND name = 'Apify Google News Scraper'"),
                {"uid": user_id},
            )
            existing_tool = res.fetchone()
            if existing_tool:
                tool_id = existing_tool[0]
                print(f"[SKIP] Apify tool already exists (id: {tool_id})")
            else:
                tool_id = gen_id()
                await db.execute(
                    text("""
                        INSERT INTO tool_registry
                            (id, user_id, name, integration_type, endpoint_url,
                             use_user_credential, credential_key, is_active,
                             openapi_schema)
                        VALUES
                            (:id, :uid, 'Apify Google News Scraper', 'apify',
                             'lhotanova~google-news-scraper',
                             true, 'apify_api_token', true,
                             '{"max_items": 5, "poll_timeout_seconds": 60}'::jsonb)
                    """),
                    {"id": tool_id, "uid": user_id},
                )
                print(f"[OK] Seeded Apify tool (id: {tool_id})")

            # Link tool to Trigger Event agent via junction table
            res = await db.execute(
                text("SELECT id FROM agent_tools_junction WHERE agent_config_id = :aid AND tool_registry_id = :tid"),
                {"aid": trigger_id, "tid": tool_id},
            )
            if not res.fetchone():
                junc_id = gen_id()
                await db.execute(
                    text("INSERT INTO agent_tools_junction (id, agent_config_id, tool_registry_id) VALUES (:id, :aid, :tid)"),
                    {"id": junc_id, "aid": trigger_id, "tid": tool_id},
                )
                print(f"[OK] Linked Apify tool to Trigger Event SDR")

            await db.commit()

        # ── Summary ──────────────────────────────────────────────────────────
        print("\n─── Seeding complete ───")
        print(f"  Agents seeded: {len(seeded_agents)}")
        res = await db.execute(
            text("SELECT name, agent_role, output_type FROM agent_configs WHERE user_id = :uid ORDER BY created_at"),
            {"uid": user_id},
        )
        for r in res.fetchall():
            print(f"  • {r[0]} [{r[1]}] → {r[2]}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())

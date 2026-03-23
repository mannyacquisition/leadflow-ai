"""
Internal Tool Executor — Gap 8.
Maps handler_name → async Python function for Monara's "App Hands".
Every handler is user-scoped; user_id is ALWAYS sourced from the authenticated
session, never from LLM output.
"""
import json
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from models import TrackedSignal, LeadRaw, OutreachDraft, UserOffer, User


# ─── Tool Schema Registry ──────────────────────────────────────────────────────
# Used to inject tool definitions into Claude and for confirmation checks.

INTERNAL_TOOLS: list[dict] = [
    {
        "name": "get_dashboard_stats",
        "description": "Get overview stats for the user's workspace: total leads, active campaigns, drafts awaiting review, recently approved emails.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
        "requires_confirmation": False,
    },
    {
        "name": "list_campaigns",
        "description": "List the user's outreach campaigns/signal agents.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["active", "paused", "all"], "description": "Filter by status, default 'active'"},
            },
        },
        "requires_confirmation": False,
    },
    {
        "name": "create_campaign",
        "description": "Create a new outreach campaign/signal agent with the given name.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Campaign name"},
                "tone_id": {"type": "string", "description": "Optional tone ID (e.g. casual_friendly)"},
            },
            "required": ["name"],
        },
        "requires_confirmation": False,
    },
    {
        "name": "delete_campaign",
        "description": "Permanently delete a campaign by name or ID. This is irreversible.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "string", "description": "Campaign ID"},
                "campaign_name": {"type": "string", "description": "Or campaign name (partial match)"},
            },
        },
        "requires_confirmation": True,
    },
    {
        "name": "list_drafts",
        "description": "List email drafts in the Unibox. Defaults to pending drafts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["draft", "sent", "all"], "description": "Default 'draft'"},
                "limit": {"type": "integer", "description": "Max results, default 10"},
            },
        },
        "requires_confirmation": False,
    },
    {
        "name": "approve_draft",
        "description": "Approve (mark as ready-to-send) a specific email draft by its ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "draft_id": {"type": "string", "description": "Draft ID to approve"},
            },
            "required": ["draft_id"],
        },
        "requires_confirmation": False,
    },
    {
        "name": "approve_all_drafts",
        "description": "Approve ALL pending email drafts in the Unibox at once. This bulk-approves every draft.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
        "requires_confirmation": True,
    },
    {
        "name": "delete_draft",
        "description": "Permanently delete an email draft by ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "draft_id": {"type": "string", "description": "Draft ID to delete"},
            },
            "required": ["draft_id"],
        },
        "requires_confirmation": True,
    },
    {
        "name": "search_contacts",
        "description": "Search leads/contacts by name, company or any keyword in their data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword"},
                "limit": {"type": "integer", "description": "Max results, default 10"},
            },
            "required": ["query"],
        },
        "requires_confirmation": False,
    },
    {
        "name": "update_tone",
        "description": "Change the user's default AI tone of voice for email generation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "tone_id": {
                    "type": "string",
                    "enum": [
                        "formal_professional", "casual_friendly", "persuasive_results",
                        "consultative_insightful", "provocative_challenger", "empathetic_solution",
                        "direct_nononsense", "witty_engaging", "enthusiastic_visionary", "data_analytical",
                    ],
                    "description": "Tone identifier",
                },
            },
            "required": ["tone_id"],
        },
        "requires_confirmation": False,
    },
    {
        "name": "list_offers",
        "description": "List the user's product/offer definitions from the AI Hub.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
        "requires_confirmation": False,
    },
]

# Quick lookup
_TOOL_MAP = {t["name"]: t for t in INTERNAL_TOOLS}


def get_tool_schemas_for_claude() -> list[dict]:
    """Return INTERNAL_TOOLS in Anthropic tool-definition format."""
    return [
        {"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
        for t in INTERNAL_TOOLS
    ]


def tool_requires_confirmation(tool_name: str) -> bool:
    return _TOOL_MAP.get(tool_name, {}).get("requires_confirmation", False)


def describe_action(tool_name: str, params: dict) -> str:
    """Human-readable description of what the tool will do (for confirmation prompt)."""
    labels = {
        "delete_campaign": lambda p: f"Delete campaign '{p.get('campaign_name') or p.get('campaign_id', '?')}'",
        "approve_all_drafts": lambda p: "Approve ALL pending email drafts",
        "delete_draft": lambda p: f"Permanently delete draft {p.get('draft_id', '?')}",
    }
    fn = labels.get(tool_name)
    return fn(params) if fn else tool_name.replace("_", " ").title()


# ─── Handlers ─────────────────────────────────────────────────────────────────

async def execute_internal_tool(
    tool_name: str,
    params: dict,
    user_id: str,
    db: AsyncSession,
) -> dict:
    """
    Dispatch to the correct handler.
    Returns {"success": bool, "message": str, "mutation_event": dict|None}
    user_id is always from the authenticated session — never from LLM params.
    """
    handler = _HANDLERS.get(tool_name)
    if not handler:
        return {"success": False, "message": f"Unknown internal tool: {tool_name}", "mutation_event": None}
    try:
        return await handler(params, user_id, db)
    except Exception as e:
        return {"success": False, "message": f"Tool error: {e}", "mutation_event": None}


async def _get_dashboard_stats(params: dict, user_id: str, db: AsyncSession) -> dict:
    total_leads = (await db.execute(select(func.count(LeadRaw.id)).where(LeadRaw.user_id == user_id))).scalar() or 0
    active_campaigns = (await db.execute(select(func.count(TrackedSignal.id)).where(TrackedSignal.user_id == user_id, TrackedSignal.status == "active"))).scalar() or 0
    pending_drafts = (await db.execute(select(func.count(OutreachDraft.id)).where(OutreachDraft.user_id == user_id, OutreachDraft.status == "draft"))).scalar() or 0
    sent_emails = (await db.execute(select(func.count(OutreachDraft.id)).where(OutreachDraft.user_id == user_id, OutreachDraft.status == "sent"))).scalar() or 0
    msg = (
        f"Workspace overview:\n"
        f"• Total leads: {total_leads}\n"
        f"• Active campaigns: {active_campaigns}\n"
        f"• Drafts awaiting review: {pending_drafts}\n"
        f"• Emails approved/sent: {sent_emails}"
    )
    return {"success": True, "message": msg, "mutation_event": None}


async def _list_campaigns(params: dict, user_id: str, db: AsyncSession) -> dict:
    status_filter = params.get("status", "active")
    q = select(TrackedSignal).where(TrackedSignal.user_id == user_id)
    if status_filter != "all":
        q = q.where(TrackedSignal.status == status_filter)
    q = q.order_by(TrackedSignal.created_at.desc()).limit(20)
    res = await db.execute(q)
    campaigns = res.scalars().all()
    if not campaigns:
        return {"success": True, "message": "No campaigns found.", "mutation_event": None}
    lines = [f"• {c.name} (status: {c.status}, id: {c.id})" for c in campaigns]
    return {"success": True, "message": "Campaigns:\n" + "\n".join(lines), "mutation_event": None}


async def _create_campaign(params: dict, user_id: str, db: AsyncSession) -> dict:
    from models.base import generate_uuid
    signal = TrackedSignal(
        user_id=user_id,
        name=params["name"],
        status="active",
        tone_id=params.get("tone_id"),
    )
    db.add(signal)
    await db.commit()
    await db.refresh(signal)
    return {
        "success": True,
        "message": f"Campaign '{signal.name}' created successfully (ID: {signal.id}).",
        "mutation_event": {"type": "CAMPAIGN_CREATED", "payload": {"id": signal.id, "name": signal.name}},
    }


async def _delete_campaign(params: dict, user_id: str, db: AsyncSession) -> dict:
    q = select(TrackedSignal).where(TrackedSignal.user_id == user_id)
    if params.get("campaign_id"):
        q = q.where(TrackedSignal.id == params["campaign_id"])
    elif params.get("campaign_name"):
        q = q.where(TrackedSignal.name.ilike(f"%{params['campaign_name']}%"))
    else:
        return {"success": False, "message": "Provide campaign_id or campaign_name.", "mutation_event": None}
    res = await db.execute(q)
    campaign = res.scalars().first()
    if not campaign:
        return {"success": False, "message": "Campaign not found.", "mutation_event": None}
    name = campaign.name
    cid = campaign.id
    await db.delete(campaign)
    await db.commit()
    return {
        "success": True,
        "message": f"Campaign '{name}' has been deleted.",
        "mutation_event": {"type": "CAMPAIGN_DELETED", "payload": {"id": cid}},
    }


async def _list_drafts(params: dict, user_id: str, db: AsyncSession) -> dict:
    status_filter = params.get("status", "draft")
    limit = min(int(params.get("limit", 10)), 50)
    q = select(OutreachDraft).where(OutreachDraft.user_id == user_id)
    if status_filter != "all":
        q = q.where(OutreachDraft.status == status_filter)
    q = q.order_by(OutreachDraft.created_at.desc()).limit(limit)
    res = await db.execute(q)
    drafts = res.scalars().all()
    if not drafts:
        return {"success": True, "message": "No drafts found.", "mutation_event": None}
    lines = []
    for d in drafts:
        subject = (d.subject or "No subject")[:60]
        lines.append(f"• [{d.status}] {subject} (id: {d.id})")
    return {"success": True, "message": f"{len(drafts)} draft(s):\n" + "\n".join(lines), "mutation_event": None}


async def _approve_draft(params: dict, user_id: str, db: AsyncSession) -> dict:
    res = await db.execute(select(OutreachDraft).where(OutreachDraft.id == params["draft_id"], OutreachDraft.user_id == user_id))
    draft = res.scalar_one_or_none()
    if not draft:
        return {"success": False, "message": "Draft not found.", "mutation_event": None}
    draft.status = "sent"
    draft.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "success": True,
        "message": f"Draft approved and marked as sent.",
        "mutation_event": {"type": "DRAFT_APPROVED", "payload": {"id": draft.id}},
    }


async def _approve_all_drafts(params: dict, user_id: str, db: AsyncSession) -> dict:
    res = await db.execute(select(OutreachDraft).where(OutreachDraft.user_id == user_id, OutreachDraft.status == "draft"))
    drafts = res.scalars().all()
    count = len(drafts)
    if count == 0:
        return {"success": True, "message": "No pending drafts to approve.", "mutation_event": None}
    for d in drafts:
        d.status = "sent"
        d.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "success": True,
        "message": f"{count} draft(s) approved and marked as sent.",
        "mutation_event": {"type": "ALL_DRAFTS_APPROVED", "payload": {"count": count}},
    }


async def _delete_draft(params: dict, user_id: str, db: AsyncSession) -> dict:
    res = await db.execute(select(OutreachDraft).where(OutreachDraft.id == params["draft_id"], OutreachDraft.user_id == user_id))
    draft = res.scalar_one_or_none()
    if not draft:
        return {"success": False, "message": "Draft not found.", "mutation_event": None}
    did = draft.id
    await db.delete(draft)
    await db.commit()
    return {
        "success": True,
        "message": "Draft deleted.",
        "mutation_event": {"type": "DRAFT_DELETED", "payload": {"id": did}},
    }


async def _search_contacts(params: dict, user_id: str, db: AsyncSession) -> dict:
    q_str = params.get("query", "")
    limit = min(int(params.get("limit", 10)), 50)
    res = await db.execute(
        select(LeadRaw)
        .where(LeadRaw.user_id == user_id)
        .order_by(LeadRaw.received_at.desc())
        .limit(100)
    )
    leads = res.scalars().all()
    matched = []
    for lead in leads:
        payload_str = json.dumps(lead.raw_payload or {}).lower()
        if q_str.lower() in payload_str:
            matched.append(lead)
        if len(matched) >= limit:
            break
    if not matched:
        return {"success": True, "message": f"No contacts matching '{q_str}'.", "mutation_event": None}
    lines = []
    for lead in matched:
        p = lead.raw_payload or {}
        name = p.get("full_name") or p.get("name") or "Unknown"
        company = p.get("company") or p.get("company_name") or ""
        lines.append(f"• {name}{' @ ' + company if company else ''} (id: {lead.id})")
    return {"success": True, "message": f"Found {len(matched)} contact(s):\n" + "\n".join(lines), "mutation_event": None}


async def _update_tone(params: dict, user_id: str, db: AsyncSession) -> dict:
    import json as _json
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        return {"success": False, "message": "User not found.", "mutation_event": None}
    settings = {}
    if user.user_settings_json:
        try:
            settings = _json.loads(user.user_settings_json)
        except Exception:
            pass
    settings["default_tone_id"] = params["tone_id"]
    user.user_settings_json = _json.dumps(settings)
    await db.commit()
    tone_label = params["tone_id"].replace("_", " ").title()
    return {
        "success": True,
        "message": f"Default tone updated to '{tone_label}'.",
        "mutation_event": {"type": "TONE_UPDATED", "payload": {"tone_id": params["tone_id"]}},
    }


async def _list_offers(params: dict, user_id: str, db: AsyncSession) -> dict:
    from models import UserOffer as _UserOffer
    res = await db.execute(select(_UserOffer).where(_UserOffer.user_id == user_id).order_by(_UserOffer.created_at.desc()))
    offers = res.scalars().all()
    if not offers:
        return {"success": True, "message": "No offers defined yet. Create one in AI Hub → Offers.", "mutation_event": None}
    lines = [f"• {o.internal_name} (id: {o.id})" for o in offers]
    return {"success": True, "message": "Offers:\n" + "\n".join(lines), "mutation_event": None}


# ─── Dispatch map ─────────────────────────────────────────────────────────────
_HANDLERS = {
    "get_dashboard_stats": _get_dashboard_stats,
    "list_campaigns":      _list_campaigns,
    "create_campaign":     _create_campaign,
    "delete_campaign":     _delete_campaign,
    "list_drafts":         _list_drafts,
    "approve_draft":       _approve_draft,
    "approve_all_drafts":  _approve_all_drafts,
    "delete_draft":        _delete_draft,
    "search_contacts":     _search_contacts,
    "update_tone":         _update_tone,
    "list_offers":         _list_offers,
}

"""
AI Chat route for Monara Command Center
Uses Claude Sonnet to answer questions about leads, signals, and campaigns
"""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, LeadRaw, OutreachDraft, TrackedSignal
from routes.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI"])


class ChatMessage(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class InsightItem(BaseModel):
    type: str  # insight, warning, opportunity, action
    title: str
    body: str
    metric: str | None = None


class InsightsResponse(BaseModel):
    insights: list[InsightItem]
    date: str


async def get_context_summary(user: User, db: AsyncSession) -> str:
    """Build a summary of the user's current data for the AI"""
    total_leads = (await db.execute(
        select(func.count(LeadRaw.id)).where(LeadRaw.user_id == user.id)
    )).scalar() or 0

    hot_leads = (await db.execute(
        select(func.count(LeadRaw.id)).where(LeadRaw.user_id == user.id, LeadRaw.ai_score == 3)
    )).scalar() or 0

    total_drafts = (await db.execute(
        select(func.count(OutreachDraft.id)).where(OutreachDraft.user_id == user.id)
    )).scalar() or 0

    approved_drafts = (await db.execute(
        select(func.count(OutreachDraft.id)).where(OutreachDraft.user_id == user.id, OutreachDraft.status == 'approved')
    )).scalar() or 0

    active_signals = (await db.execute(
        select(func.count(TrackedSignal.id)).where(TrackedSignal.user_id == user.id, TrackedSignal.status == 'active')
    )).scalar() or 0

    return (
        f"User: {user.full_name or user.email}\n"
        f"Total leads captured: {total_leads}\n"
        f"Hot leads (score 3): {hot_leads}\n"
        f"AI-generated email drafts: {total_drafts}\n"
        f"Approved drafts: {approved_drafts}\n"
        f"Active signal agents: {active_signals}\n"
    )


@router.post("/chat")
async def chat(
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Monara AI chat — answers questions about leads, agents, and outreach"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI service not configured")

    context = await get_context_summary(user, db)

    system_prompt = (
        "You are Monara, an AI command center for LeadFlow AI, an intent-signal monitoring platform.\n"
        "You help users manage their leads, campaigns, signal agents, and AI-generated outreach emails.\n\n"
        "Current user data summary:\n"
        f"{context}\n\n"
        "Answer questions concisely and helpfully. When asked about data, refer to the summary above. "
        "Keep responses short (2-4 sentences) unless more detail is needed. "
        "Format lists with bullet points when appropriate."
    )

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        messages = []
        for m in req.history[-10:]:  # Last 10 messages for context
            messages.append({"role": m.role, "content": m.content})
        messages.append({"role": "user", "content": req.message})

        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=512,
            system=system_prompt,
            messages=messages,
        )
        reply = response.content[0].text
        return {"reply": reply}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


@router.get("/insights", response_model=InsightsResponse)
async def get_insights(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get or generate daily insights for the dashboard"""
    context = await get_context_summary(user, db)

    # Parse numbers from context for quick static insights
    lines = {k.strip(): v.strip() for line in context.splitlines()
             if ":" in line for k, v in [line.split(":", 1)]}

    total = int(lines.get("Total leads captured", "0"))
    hot = int(lines.get("Hot leads (score 3)", "0"))
    drafts = int(lines.get("AI-generated email drafts", "0"))
    approved = int(lines.get("Approved drafts", "0"))
    agents = int(lines.get("Active signal agents", "0"))

    insights = []

    if total == 0:
        insights.append(InsightItem(
            type="action",
            title="Set up your first signal agent",
            body="Configure a signal agent to start capturing intent signals and generating AI-powered email drafts.",
        ))
    else:
        hot_pct = round((hot / total) * 100) if total > 0 else 0
        insights.append(InsightItem(
            type="insight",
            title="Lead pipeline overview",
            body=f"You have {total} leads captured with {hot} high-intent prospects ({hot_pct}% hot rate).",
            metric=f"{hot_pct}%"
        ))

    if drafts > 0 and approved == 0:
        insights.append(InsightItem(
            type="action",
            title="Approve your AI-generated drafts",
            body=f"You have {drafts} email draft(s) waiting for your review in the Copilot. Approve them to start outreach.",
            metric=f"{drafts} drafts"
        ))
    elif approved > 0:
        insights.append(InsightItem(
            type="opportunity",
            title="Outreach is ready to send",
            body=f"{approved} draft(s) have been approved. Mark them as sent after outreach to track your pipeline.",
            metric=f"{approved} approved"
        ))

    if agents == 0:
        insights.append(InsightItem(
            type="warning",
            title="No active signal agents",
            body="Activate at least one signal agent in Signal Agents to start monitoring intent signals 24/7.",
        ))
    else:
        insights.append(InsightItem(
            type="insight",
            title=f"{agents} signal agent(s) running",
            body="Your agents are actively monitoring LinkedIn engagement, job changes, and competitor activity.",
            metric=f"{agents} active"
        ))

    return InsightsResponse(
        insights=insights,
        date=datetime.now(timezone.utc).strftime("%Y-%m-%d")
    )


@router.post("/insights/generate", response_model=InsightsResponse)
async def generate_insights(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate AI-powered insights using Claude"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Fall back to static insights
        return await get_insights(user, db)

    context = await get_context_summary(user, db)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        prompt = (
            f"Based on this LeadFlow AI user data:\n{context}\n\n"
            "Generate exactly 4 actionable insights in JSON format. "
            "Each insight should have: type (insight/warning/opportunity/action), title (short), body (1-2 sentences), metric (optional short number/percentage).\n"
            'Return ONLY a JSON array, no markdown. Example: [{"type":"insight","title":"Title","body":"Body text","metric":"42%"}]'
        )

        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        raw = response.content[0].text.strip()
        # Strip markdown code blocks if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        items = json.loads(raw)
        insights = [InsightItem(**i) for i in items]

    except Exception:
        # Fall back to static
        result = await get_insights(user, db)
        return result

    return InsightsResponse(
        insights=insights,
        date=datetime.now(timezone.utc).strftime("%Y-%m-%d")
    )

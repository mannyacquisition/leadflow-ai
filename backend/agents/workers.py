"""
AI Worker Agents - Mixture of Experts for email generation
Each agent is specialized for a specific signal category
"""
import os
import httpx
from datetime import datetime, timezone
from typing import Optional
from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import LeadRaw, OutreachDraft, User
from utils.auth import decrypt_api_key

# Initialize Anthropic client (user must provide ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')


async def get_claude_client(api_key: str = None) -> AsyncAnthropic:
    """Get Anthropic client with API key"""
    key = api_key or ANTHROPIC_API_KEY
    if not key:
        raise ValueError("ANTHROPIC_API_KEY not configured")
    return AsyncAnthropic(api_key=key)


async def generate_email_with_claude(
    client: AsyncAnthropic,
    system_prompt: str,
    lead_context: str,
    max_tokens: int = 1024
) -> dict:
    """Generate email using Claude Sonnet 4.5"""
    response = await client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[
            {"role": "user", "content": lead_context}
        ]
    )
    
    content = response.content[0].text
    
    # Parse subject and body (expecting format: Subject: ...\n\n Body)
    lines = content.split('\n', 1)
    subject = ""
    body = content
    
    if lines[0].lower().startswith('subject:'):
        subject = lines[0][8:].strip()
        body = lines[1].strip() if len(lines) > 1 else ""
    
    return {"subject": subject, "body": body}


# ─── AGENT 1: Warm Inbound Agent ─────────────────────────────────────────────────

WARM_INBOUND_SYSTEM = """You are an expert B2B sales copywriter specializing in warm outreach.
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

[email body]"""

async def warm_inbound_agent(
    lead: LeadRaw,
    db: AsyncSession,
    user: User
) -> OutreachDraft:
    """Generate email for warm inbound signals (engagement with host brand)"""
    client = await get_claude_client()
    
    payload = lead.raw_payload or {}
    lead_context = f"""
Lead Information:
- Name: {lead.name or 'Unknown'}
- Job Title: {lead.job_title or 'Unknown'}
- Company: {lead.company or 'Unknown'}
- Signal Type: Engaged with our company content
- Engagement Details: {payload.get('engagement_type', 'liked/commented on a post')}
- Post Topic: {payload.get('post_topic', 'industry insights')}
- LinkedIn URL: {lead.linkedin_url or 'Not provided'}

Generate a warm, personalized email that references their engagement.
"""
    
    result = await generate_email_with_claude(client, WARM_INBOUND_SYSTEM, lead_context)
    
    draft = OutreachDraft(
        user_id=user.id,
        lead_id=lead.id,
        subject=result["subject"],
        body=result["body"],
        agent_type="warm_inbound",
        generation_context={"lead_name": lead.name, "engagement": payload.get('engagement_type')}
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    
    return draft


# ─── AGENT 2: Topic Authority Agent ──────────────────────────────────────────────

TOPIC_AUTHORITY_SYSTEM = """You are an expert B2B sales copywriter specializing in thought leadership outreach.
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

[email body]"""

async def topic_authority_agent(
    lead: LeadRaw,
    db: AsyncSession,
    user: User
) -> OutreachDraft:
    """Generate email based on keyword engagement signals"""
    client = await get_claude_client()
    
    payload = lead.raw_payload or {}
    lead_context = f"""
Lead Information:
- Name: {lead.name or 'Unknown'}
- Job Title: {lead.job_title or 'Unknown'}  
- Company: {lead.company or 'Unknown'}
- Keywords they engaged with: {payload.get('keywords', ['industry topic'])}
- Engagement Type: {payload.get('engagement_type', 'commented on post')}
- Post Content: {payload.get('post_content', 'N/A')[:500]}

Generate an email that demonstrates thought leadership on their topic of interest.
"""
    
    result = await generate_email_with_claude(client, TOPIC_AUTHORITY_SYSTEM, lead_context)
    
    draft = OutreachDraft(
        user_id=user.id,
        lead_id=lead.id,
        subject=result["subject"],
        body=result["body"],
        agent_type="topic_authority",
        generation_context={"keywords": payload.get('keywords')}
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    
    return draft


# ─── AGENT 3: Network Sniper Agent ───────────────────────────────────────────────

NETWORK_SNIPER_SYSTEM = """You are an expert B2B sales copywriter specializing in relationship-based outreach.
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

[email body]"""

async def network_sniper_agent(
    lead: LeadRaw,
    db: AsyncSession,
    user: User
) -> OutreachDraft:
    """Generate email based on shared influencer network"""
    client = await get_claude_client()
    
    payload = lead.raw_payload or {}
    lead_context = f"""
Lead Information:
- Name: {lead.name or 'Unknown'}
- Job Title: {lead.job_title or 'Unknown'}
- Company: {lead.company or 'Unknown'}
- Shared Influencer/Connection: {payload.get('influencer_name', 'industry thought leader')}
- Influencer's Recent Topic: {payload.get('influencer_topic', 'industry insights')}
- How they engaged: {payload.get('engagement_type', 'liked/commented')}

Generate an email that naturally references the shared connection.
"""
    
    result = await generate_email_with_claude(client, NETWORK_SNIPER_SYSTEM, lead_context)
    
    draft = OutreachDraft(
        user_id=user.id,
        lead_id=lead.id,
        subject=result["subject"],
        body=result["body"],
        agent_type="network_sniper",
        generation_context={"influencer": payload.get('influencer_name')}
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    
    return draft


# ─── AGENT 4: Trigger Event Agent (with Apify tool-calling) ──────────────────────

TRIGGER_EVENT_SYSTEM = """You are an expert B2B sales copywriter specializing in timely, event-based outreach.
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

[email body]"""

async def fetch_company_news(company_name: str, apify_api_token: str) -> list:
    """Fetch recent company news using Apify Google News Scraper"""
    if not apify_api_token:
        return []
    
    try:
        async with httpx.AsyncClient() as client:
            # Start the Apify actor run
            response = await client.post(
                "https://api.apify.com/v2/acts/lhotanova~google-news-scraper/runs",
                params={"token": apify_api_token},
                json={
                    "query": f"{company_name} funding OR hiring OR expansion",
                    "maxResults": 5,
                    "language": "en"
                },
                timeout=60.0
            )
            
            if response.status_code != 201:
                return []
            
            run_data = response.json()
            run_id = run_data.get("data", {}).get("id")
            
            if not run_id:
                return []
            
            # Wait for results (polling with timeout)
            import asyncio
            for _ in range(30):  # Max 30 seconds
                await asyncio.sleep(1)
                status_response = await client.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    params={"token": apify_api_token}
                )
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    if status_data.get("data", {}).get("status") == "SUCCEEDED":
                        break
            
            # Get results
            results_response = await client.get(
                f"https://api.apify.com/v2/actor-runs/{run_id}/dataset/items",
                params={"token": apify_api_token}
            )
            
            if results_response.status_code == 200:
                return results_response.json()[:3]  # Return top 3 news items
            
    except Exception as e:
        print(f"Error fetching news: {e}")
    
    return []


async def trigger_event_agent(
    lead: LeadRaw,
    db: AsyncSession,
    user: User
) -> OutreachDraft:
    """Generate email based on trigger events (funding, job changes, etc.)"""
    client = await get_claude_client()
    
    payload = lead.raw_payload or {}
    
    # Fetch recent company news using user's Apify token
    news_items = []
    if user.apify_api_token_encrypted:
        try:
            apify_token = decrypt_api_key(user.apify_api_token_encrypted)
            news_items = await fetch_company_news(lead.company or "", apify_token)
        except Exception as e:
            print(f"Error decrypting Apify token: {e}")
    
    news_context = ""
    if news_items:
        news_context = "Recent News:\n" + "\n".join([
            f"- {item.get('title', 'N/A')}: {item.get('description', '')[:200]}"
            for item in news_items
        ])
    else:
        news_context = f"Trigger Event: {payload.get('trigger_type', 'recent job change or funding')}"
    
    lead_context = f"""
Lead Information:
- Name: {lead.name or 'Unknown'}
- Job Title: {lead.job_title or 'Unknown'}
- Company: {lead.company or 'Unknown'}
- Trigger Event Type: {payload.get('trigger_type', 'job_change')}
- Event Details: {payload.get('event_details', 'N/A')}

{news_context}

Generate an email that references their recent company news or personal career change.
"""
    
    result = await generate_email_with_claude(client, TRIGGER_EVENT_SYSTEM, lead_context)
    
    draft = OutreachDraft(
        user_id=user.id,
        lead_id=lead.id,
        subject=result["subject"],
        body=result["body"],
        agent_type="trigger_event",
        generation_context={
            "trigger_type": payload.get('trigger_type'),
            "news_fetched": len(news_items) > 0
        }
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    
    return draft


# ─── AGENT 5: Competitor Intercept Agent ─────────────────────────────────────────

COMPETITOR_INTERCEPT_SYSTEM = """You are an expert B2B sales copywriter specializing in competitive positioning.
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

[email body]"""

async def competitor_intercept_agent(
    lead: LeadRaw,
    db: AsyncSession,
    user: User
) -> OutreachDraft:
    """Generate email for competitor engagement signals"""
    client = await get_claude_client()
    
    payload = lead.raw_payload or {}
    lead_context = f"""
Lead Information:
- Name: {lead.name or 'Unknown'}
- Job Title: {lead.job_title or 'Unknown'}
- Company: {lead.company or 'Unknown'}
- Competitor they engaged with: {payload.get('competitor_name', 'industry competitor')}
- Type of engagement: {payload.get('engagement_type', 'followed/commented')}
- What competitor is known for: {payload.get('competitor_positioning', 'similar solutions')}

Generate a pattern-interrupt email that positions us as an alternative without bashing the competitor.
"""
    
    result = await generate_email_with_claude(client, COMPETITOR_INTERCEPT_SYSTEM, lead_context)
    
    draft = OutreachDraft(
        user_id=user.id,
        lead_id=lead.id,
        subject=result["subject"],
        body=result["body"],
        agent_type="competitor_intercept",
        generation_context={"competitor": payload.get('competitor_name')}
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    
    return draft


# ─── Agent Router ────────────────────────────────────────────────────────────────

AGENT_MAP = {
    "warm_inbound": warm_inbound_agent,
    "topic_authority": topic_authority_agent,
    "network_sniper": network_sniper_agent,
    "trigger_event": trigger_event_agent,
    "competitor_engagement": competitor_intercept_agent,
}

async def route_to_agent(
    signal_category: str,
    lead: LeadRaw,
    db: AsyncSession,
    user: User
) -> Optional[OutreachDraft]:
    """Route lead to appropriate AI agent based on signal category"""
    agent_func = AGENT_MAP.get(signal_category)
    
    if not agent_func:
        print(f"Unknown signal category: {signal_category}")
        return None
    
    try:
        return await agent_func(lead, db, user)
    except Exception as e:
        print(f"Error in {signal_category} agent: {e}")
        return None

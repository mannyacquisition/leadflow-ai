"""
AI Hub routes — user-scoped CRUD for Offers, Playbooks, Battlecards, Guardrails,
Knowledge Base upload, Tone preference, and the URL → AI offer scraper.
"""
import os
import json
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, UserOffer, UserPlaybook, UserBattlecard, UserGuardrails, KnowledgeBase, KnowledgeEmbedding
from routes.auth import get_current_user
from services.embedding import process_file_for_embedding, embed_text_chunk

router = APIRouter(prefix="/hub", tags=["AI Hub"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _offer_dict(o: UserOffer) -> dict:
    return {
        "id": o.id, "user_id": o.user_id, "internal_name": o.internal_name,
        "external_name": o.external_name, "website_url": o.website_url,
        "industry": o.industry, "icp": o.icp, "pain_points": o.pain_points,
        "cost_of_inaction": o.cost_of_inaction, "solution_benefits": o.solution_benefits,
        "social_proof": o.social_proof, "offering_description": o.offering_description,
        "problem_solved": o.problem_solved, "differentiator": o.differentiator,
        "created_at": o.created_at.isoformat(), "updated_at": o.updated_at.isoformat(),
    }

def _playbook_dict(p: UserPlaybook) -> dict:
    return {
        "id": p.id, "user_id": p.user_id, "name": p.name,
        "initial_email_template": p.initial_email_template,
        "follow_up_template": p.follow_up_template,
        "connect_message_template": p.connect_message_template,
        "do_guidelines": p.do_guidelines, "dont_guidelines": p.dont_guidelines,
        "cadence_rules": p.cadence_rules or {},
        "created_at": p.created_at.isoformat(), "updated_at": p.updated_at.isoformat(),
    }

def _battlecard_dict(b: UserBattlecard) -> dict:
    return {
        "id": b.id, "user_id": b.user_id, "objection_type": b.objection_type,
        "rebuttal_strategy": b.rebuttal_strategy, "example_response": b.example_response,
        "created_at": b.created_at.isoformat(), "updated_at": b.updated_at.isoformat(),
    }

def _guardrails_dict(g: UserGuardrails) -> dict:
    return {
        "id": g.id, "user_id": g.user_id,
        "blocked_keywords": g.blocked_keywords or [],
        "hard_rules": g.hard_rules,
        "created_at": g.created_at.isoformat(), "updated_at": g.updated_at.isoformat(),
    }


# ─── OFFERS ───────────────────────────────────────────────────────────────────

class OfferCreate(BaseModel):
    internal_name: str
    external_name: Optional[str] = None
    website_url: Optional[str] = None
    industry: Optional[str] = None
    icp: Optional[str] = None
    pain_points: Optional[str] = None
    cost_of_inaction: Optional[str] = None
    solution_benefits: Optional[str] = None
    social_proof: Optional[str] = None
    offering_description: Optional[str] = None
    problem_solved: Optional[str] = None
    differentiator: Optional[str] = None

class OfferUpdate(OfferCreate):
    internal_name: Optional[str] = None


@router.get("/offers")
async def list_offers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserOffer).where(UserOffer.user_id == user.id).order_by(UserOffer.created_at.desc()))
    return [_offer_dict(o) for o in result.scalars().all()]


@router.post("/offers")
async def create_offer(data: OfferCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    offer = UserOffer(user_id=user.id, **data.model_dump())
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return _offer_dict(offer)


@router.patch("/offers/{offer_id}")
async def update_offer(offer_id: str, data: OfferUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserOffer).where(UserOffer.id == offer_id, UserOffer.user_id == user.id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(offer, k, v)
    offer.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(offer)
    return _offer_dict(offer)


@router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserOffer).where(UserOffer.id == offer_id, UserOffer.user_id == user.id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    await db.delete(offer)
    await db.commit()
    return {"ok": True}


@router.post("/offers/scrape")
async def scrape_offer_from_url(
    payload: dict,
    user: User = Depends(get_current_user),
):
    """
    Playwright-scrape a website URL then use Claude to extract:
    ICP, pain_points, solution_benefits, differentiator, problem_solved, offering_description.
    """
    url = payload.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    # 1. Playwright headless scrape
    page_text = await _scrape_with_playwright(url)
    if not page_text:
        raise HTTPException(status_code=422, detail="Could not extract content from that URL")

    # 2. Claude extraction
    extracted = await _extract_offer_with_claude(url, page_text)
    return extracted


async def _scrape_with_playwright(url: str) -> str:
    """Run playwright in a thread to avoid blocking the event loop."""
    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_playwright_scrape, url)
    except Exception as e:
        print(f"Playwright scrape error: {e}")
        return ""


def _sync_playwright_scrape(url: str) -> str:
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
            page = browser.new_page()
            page.set_extra_http_headers({"User-Agent": "Mozilla/5.0 (compatible; LeadFlowBot/1.0)"})
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(2000)
            # Extract meaningful text
            text = page.evaluate("""() => {
                const remove = ['script','style','nav','header','footer','aside','noscript','svg','iframe'];
                remove.forEach(t => document.querySelectorAll(t).forEach(el => el.remove()));
                return (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 8000);
            }""")
            browser.close()
            return text
    except Exception as e:
        print(f"Sync playwright error: {e}")
        return ""


async def _extract_offer_with_claude(url: str, page_text: str) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"icp": "", "pain_points": "", "solution_benefits": "", "differentiator": "", "problem_solved": "", "offering_description": ""}

    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        prompt = f"""You are analyzing a company website to fill out a sales intelligence form.
Website URL: {url}

Website content:
{page_text}

Extract and return a JSON object with exactly these keys (use empty string if not found):
- icp: Ideal Customer Profile (who they sell to — job title, company size, industry)
- pain_points: Key problems/pain points their customers face
- solution_benefits: Main benefits/outcomes their product delivers
- differentiator: What makes them unique vs competitors
- problem_solved: The core problem they solve in 1-2 sentences
- offering_description: Brief description of their product/service

Return ONLY valid JSON, no markdown, no explanation."""

        msg = await client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        print(f"Claude extraction error: {e}")
        return {"icp": "", "pain_points": "", "solution_benefits": "", "differentiator": "", "problem_solved": "", "offering_description": ""}


# ─── PLAYBOOKS ────────────────────────────────────────────────────────────────

class PlaybookCreate(BaseModel):
    name: str
    initial_email_template: Optional[str] = None
    follow_up_template: Optional[str] = None
    connect_message_template: Optional[str] = None
    do_guidelines: Optional[str] = None
    dont_guidelines: Optional[str] = None
    cadence_rules: Optional[dict] = None

class PlaybookUpdate(PlaybookCreate):
    name: Optional[str] = None


@router.get("/playbooks")
async def list_playbooks(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserPlaybook).where(UserPlaybook.user_id == user.id).order_by(UserPlaybook.created_at.desc()))
    return [_playbook_dict(p) for p in result.scalars().all()]


@router.post("/playbooks")
async def create_playbook(data: PlaybookCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pb = UserPlaybook(user_id=user.id, **data.model_dump())
    db.add(pb)
    await db.commit()
    await db.refresh(pb)
    return _playbook_dict(pb)


@router.patch("/playbooks/{pb_id}")
async def update_playbook(pb_id: str, data: PlaybookUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserPlaybook).where(UserPlaybook.id == pb_id, UserPlaybook.user_id == user.id))
    pb = result.scalar_one_or_none()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(pb, k, v)
    pb.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pb)
    return _playbook_dict(pb)


@router.delete("/playbooks/{pb_id}")
async def delete_playbook(pb_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserPlaybook).where(UserPlaybook.id == pb_id, UserPlaybook.user_id == user.id))
    pb = result.scalar_one_or_none()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    await db.delete(pb)
    await db.commit()
    return {"ok": True}


# ─── BATTLECARDS ──────────────────────────────────────────────────────────────

class BattlecardCreate(BaseModel):
    objection_type: str
    rebuttal_strategy: Optional[str] = None
    example_response: Optional[str] = None

class BattlecardUpdate(BattlecardCreate):
    objection_type: Optional[str] = None


@router.get("/battlecards")
async def list_battlecards(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserBattlecard).where(UserBattlecard.user_id == user.id).order_by(UserBattlecard.created_at.desc()))
    return [_battlecard_dict(b) for b in result.scalars().all()]


@router.post("/battlecards")
async def create_battlecard(data: BattlecardCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    bc = UserBattlecard(user_id=user.id, **data.model_dump())
    db.add(bc)
    await db.commit()
    await db.refresh(bc)
    return _battlecard_dict(bc)


@router.patch("/battlecards/{bc_id}")
async def update_battlecard(bc_id: str, data: BattlecardUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserBattlecard).where(UserBattlecard.id == bc_id, UserBattlecard.user_id == user.id))
    bc = result.scalar_one_or_none()
    if not bc:
        raise HTTPException(status_code=404, detail="Battlecard not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(bc, k, v)
    bc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(bc)
    return _battlecard_dict(bc)


@router.delete("/battlecards/{bc_id}")
async def delete_battlecard(bc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserBattlecard).where(UserBattlecard.id == bc_id, UserBattlecard.user_id == user.id))
    bc = result.scalar_one_or_none()
    if not bc:
        raise HTTPException(status_code=404, detail="Battlecard not found")
    await db.delete(bc)
    await db.commit()
    return {"ok": True}


# ─── GUARDRAILS ───────────────────────────────────────────────────────────────

class GuardrailsUpsert(BaseModel):
    blocked_keywords: Optional[List[str]] = None
    hard_rules: Optional[str] = None


@router.get("/guardrails")
async def get_guardrails(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserGuardrails).where(UserGuardrails.user_id == user.id))
    g = result.scalar_one_or_none()
    if not g:
        return {"id": None, "user_id": user.id, "blocked_keywords": [], "hard_rules": ""}
    return _guardrails_dict(g)


@router.post("/guardrails")
async def upsert_guardrails(data: GuardrailsUpsert, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserGuardrails).where(UserGuardrails.user_id == user.id))
    g = result.scalar_one_or_none()
    if g:
        if data.blocked_keywords is not None:
            g.blocked_keywords = data.blocked_keywords
        if data.hard_rules is not None:
            g.hard_rules = data.hard_rules
        g.updated_at = datetime.now(timezone.utc)
    else:
        g = UserGuardrails(
            user_id=user.id,
            blocked_keywords=data.blocked_keywords or [],
            hard_rules=data.hard_rules or "",
        )
        db.add(g)
    await db.commit()
    await db.refresh(g)
    return _guardrails_dict(g)


# ─── TONE ─────────────────────────────────────────────────────────────────────

@router.get("/tone")
async def get_default_tone(user: User = Depends(get_current_user)):
    """Returns the user's saved default tone_id from user_settings_json."""
    settings = {}
    if user.user_settings_json:
        try:
            settings = json.loads(user.user_settings_json)
        except Exception:
            pass
    return {"tone_id": settings.get("default_tone_id", "")}


@router.post("/tone")
async def set_default_tone(
    payload: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Saves the user's default tone_id into user_settings_json."""
    tone_id = payload.get("tone_id", "")
    settings = {}
    if user.user_settings_json:
        try:
            settings = json.loads(user.user_settings_json)
        except Exception:
            pass
    settings["default_tone_id"] = tone_id
    user.user_settings_json = json.dumps(settings)
    await db.commit()
    return {"tone_id": tone_id}


# ─── USER-SCOPED KNOWLEDGE BASE ───────────────────────────────────────────────

@router.get("/knowledge/files")
async def list_user_kb_files(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.user_id == user.id, KnowledgeBase.is_global.is_(False))
        .order_by(KnowledgeBase.created_at.desc())
    )
    files = result.scalars().all()
    return [
        {
            "id": f.id, "file_name": f.file_name, "file_type": f.file_type,
            "chunk_count": f.chunk_count, "tags": f.tags or [],
            "created_at": f.created_at.isoformat(),
        }
        for f in files
    ]


@router.post("/knowledge/upload")
async def upload_user_kb_file(
    file: UploadFile = File(...),
    tags: str = Form(default="[]"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file, chunk it, embed with Gemini, store in knowledge_embeddings (is_global=False)."""
    import uuid as uuid_module
    from models import KnowledgeEmbedding

    content = await file.read()
    file_type = _detect_file_type(file.filename or "file.txt", file.content_type or "")

    chunks = process_file_for_embedding(content, file_type)
    if not chunks:
        raise HTTPException(status_code=422, detail="Could not extract text from file")

    try:
        tags_list = json.loads(tags) if tags else []
    except Exception:
        tags_list = []

    kb_file = KnowledgeBase(
        user_id=user.id,
        file_name=file.filename or "upload",
        file_url=f"/uploads/{user.id}/{file.filename}",
        file_type=file_type,
        is_global=False,
        tags=tags_list,
        chunk_count=len(chunks),
    )
    db.add(kb_file)
    await db.flush()

    for idx, chunk_text in enumerate(chunks):
        try:
            embedding = embed_text_chunk(chunk_text)
        except Exception:
            embedding = None
        emb = KnowledgeEmbedding(
            knowledge_base_id=kb_file.id,
            user_id=user.id,
            is_global=False,
            chunk_text=chunk_text,
            chunk_index=idx,
            embedding=embedding,
        )
        db.add(emb)

    await db.commit()
    await db.refresh(kb_file)
    return {
        "id": kb_file.id, "file_name": kb_file.file_name,
        "file_type": kb_file.file_type, "chunk_count": kb_file.chunk_count,
        "created_at": kb_file.created_at.isoformat(),
    }


@router.delete("/knowledge/files/{file_id}")
async def delete_user_kb_file(file_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == file_id, KnowledgeBase.user_id == user.id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="File not found")
    await db.delete(kb)
    await db.commit()
    return {"ok": True}


def _detect_file_type(filename: str, content_type: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf" or "pdf" in content_type:
        return "pdf"
    if ext in ("png", "jpg", "jpeg", "gif", "webp") or "image" in content_type:
        return "image"
    if ext in ("mp4", "mov", "avi") or "video" in content_type:
        return "video"
    return "text"

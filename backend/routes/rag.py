"""
Knowledge Base Routes — File upload, embedding, and retrieval
"""
import os
import uuid
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, KnowledgeBase, KnowledgeEmbedding, AgentKnowledgeJunction
from routes.auth import get_current_user
from routes.admin import get_admin_user
from services import storage as storage_svc

router = APIRouter(prefix="/admin/knowledge", tags=["Knowledge Base"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "image", "image/jpg": "image", "image/png": "image",
    "image/gif": "image", "image/webp": "image",
    "video/mp4": "video", "video/quicktime": "video", "video/x-msvideo": "video",
    "text/plain": "text", "text/markdown": "text",
    "application/msword": "text", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "text",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.get("/files")
async def list_knowledge_files(
    is_global: Optional[bool] = Query(None),
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(KnowledgeBase)
    if is_global is True:
        stmt = stmt.where(KnowledgeBase.is_global == True)
    elif is_global is False:
        stmt = stmt.where(KnowledgeBase.is_global == False, KnowledgeBase.user_id == user.id)
    else:
        stmt = stmt.where(
            (KnowledgeBase.is_global == True) | (KnowledgeBase.user_id == user.id)
        )
    result = await db.execute(stmt.order_by(KnowledgeBase.created_at.desc()))
    files = result.scalars().all()
    return [
        {
            "id": f.id, "file_name": f.file_name, "file_url": f.file_url,
            "file_type": f.file_type, "tags": f.tags, "is_global": f.is_global,
            "chunk_count": f.chunk_count, "created_at": f.created_at.isoformat(),
        }
        for f in files
    ]


@router.post("/upload")
async def upload_knowledge_file(
    file: UploadFile = File(...),
    is_global: bool = Form(False),
    tags: str = Form("[]"),
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a file, store it, chunk it, and embed with Gemini gemini-embedding-2-preview.
    Supports: PDF, images, video, text files.
    """
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    # Determine file type
    mime = file.content_type or mimetypes.guess_type(file.filename)[0] or "text/plain"
    file_type = ALLOWED_TYPES.get(mime, "text")

    # Upload to storage
    public_url, storage_path = await storage_svc.upload_file(
        content=content,
        file_name=file.filename,
        mime_type=mime,
        user_id=None if is_global else user.id,
    )

    # Create KB record
    import json as json_mod
    kb = KnowledgeBase(
        user_id=None if is_global else user.id,
        file_name=file.filename,
        file_url=public_url,
        file_type=file_type,
        tags=json_mod.loads(tags) if tags else [],
        is_global=is_global,
        supabase_storage_path=storage_path,
        chunk_count=0,
    )
    db.add(kb)
    await db.commit()
    await db.refresh(kb)

    # Run embedding in background
    import asyncio
    asyncio.create_task(_embed_file_background(kb.id, content, file_type, mime, is_global, user.id, db))

    return {
        "id": kb.id,
        "file_name": kb.file_name,
        "file_type": file_type,
        "is_global": is_global,
        "message": "File uploaded. Embedding in progress...",
    }


async def _embed_file_background(
    kb_id: str, content: bytes, file_type: str, mime: str,
    is_global: bool, user_id: str, db: AsyncSession
):
    """Background task: chunk + embed file and store in knowledge_embeddings."""
    from services.embedding import process_file_for_embedding
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as new_db:
        try:
            chunks = process_file_for_embedding(content, file_type, mime)
            for chunk in chunks:
                emb = KnowledgeEmbedding(
                    knowledge_base_id=kb_id,
                    user_id=None if is_global else user_id,
                    is_global=is_global,
                    chunk_text=chunk["chunk_text"],
                    chunk_index=chunk["chunk_index"],
                    embedding=chunk["embedding"],
                    metadata_=chunk.get("metadata", {}),
                )
                new_db.add(emb)

            # Update chunk_count
            result = await new_db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
            kb = result.scalar_one_or_none()
            if kb:
                kb.chunk_count = len(chunks)

            await new_db.commit()
        except Exception as e:
            # Mark KB record as failed
            result = await new_db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
            kb = result.scalar_one_or_none()
            if kb:
                kb.chunk_count = -1  # -1 = error
            await new_db.commit()


@router.delete("/files/{file_id}")
async def delete_knowledge_file(
    file_id: str,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == file_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="File not found")

    if kb.supabase_storage_path:
        await storage_svc.delete_file(kb.supabase_storage_path)

    await db.execute(delete(KnowledgeBase).where(KnowledgeBase.id == file_id))
    await db.commit()
    return {"message": "File deleted"}


@router.get("/files/{storage_path:path}")
async def serve_local_file(storage_path: str, user: User = Depends(get_current_user)):
    """Serve locally stored files when Supabase Storage is not configured."""
    content = storage_svc.get_local_file(storage_path)
    if not content:
        raise HTTPException(status_code=404, detail="File not found")
    mime, _ = mimetypes.guess_type(storage_path)
    return Response(content=content, media_type=mime or "application/octet-stream")


# Agent ↔ Knowledge wiring
@router.post("/agents/{agent_id}/files/{file_id}")
async def wire_knowledge(agent_id: str, file_id: str, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    junc = AgentKnowledgeJunction(agent_config_id=agent_id, knowledge_base_id=file_id)
    db.add(junc)
    await db.commit()
    return {"message": "Knowledge file wired to agent"}


@router.delete("/agents/{agent_id}/files/{file_id}")
async def unwire_knowledge(agent_id: str, file_id: str, user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(AgentKnowledgeJunction).where(
        AgentKnowledgeJunction.agent_config_id == agent_id,
        AgentKnowledgeJunction.knowledge_base_id == file_id,
    ))
    await db.commit()
    return {"message": "Knowledge file removed from agent"}


@router.post("/search")
async def search_knowledge(
    query: str,
    is_global: Optional[bool] = None,
    top_k: int = 5,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    from services.rag_retriever import search_embeddings
    results = await search_embeddings(
        db, query=query, user_id=user.id, is_global=is_global, top_k=top_k
    )
    return {"query": query, "results": results}

"""
Supabase Storage Service — File uploads for Knowledge Base
Falls back to local /tmp storage if SUPABASE_SERVICE_KEY is not configured
"""
import os
import uuid
import tempfile
from pathlib import Path
from typing import Optional

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET_NAME = "knowledge-base"
LOCAL_FALLBACK_DIR = Path("/tmp/kb_uploads")
LOCAL_FALLBACK_DIR.mkdir(parents=True, exist_ok=True)


def _get_supabase_client():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    try:
        from supabase import create_client
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception:
        return None


def _ensure_bucket(client) -> bool:
    try:
        buckets = client.storage.list_buckets()
        existing = [b.name for b in buckets]
        if BUCKET_NAME not in existing:
            client.storage.create_bucket(BUCKET_NAME, options={"public": True})
        return True
    except Exception:
        return False


async def upload_file(
    content: bytes,
    file_name: str,
    mime_type: str = "application/octet-stream",
    user_id: Optional[str] = None,
) -> tuple[str, str]:
    """
    Upload file to Supabase Storage (or local fallback).
    Returns (public_url, storage_path)
    """
    ext = Path(file_name).suffix
    unique_name = f"{uuid.uuid4().hex}{ext}"
    folder = f"global" if not user_id else f"users/{user_id}"
    storage_path = f"{folder}/{unique_name}"

    client = _get_supabase_client()
    if client:
        try:
            _ensure_bucket(client)
            client.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": mime_type},
            )
            public_url = client.storage.from_(BUCKET_NAME).get_public_url(storage_path)
            return public_url, storage_path
        except Exception as e:
            pass  # fall through to local

    # Local fallback
    local_dir = LOCAL_FALLBACK_DIR / folder
    local_dir.mkdir(parents=True, exist_ok=True)
    local_path = local_dir / unique_name
    local_path.write_bytes(content)
    public_url = f"/api/admin/knowledge/files/{storage_path}"
    return public_url, storage_path


async def delete_file(storage_path: str) -> bool:
    client = _get_supabase_client()
    if client:
        try:
            client.storage.from_(BUCKET_NAME).remove([storage_path])
            return True
        except Exception:
            pass

    # Local fallback
    local_path = LOCAL_FALLBACK_DIR / storage_path
    if local_path.exists():
        local_path.unlink()
    return True


def get_local_file(storage_path: str) -> Optional[bytes]:
    local_path = LOCAL_FALLBACK_DIR / storage_path
    if local_path.exists():
        return local_path.read_bytes()
    return None

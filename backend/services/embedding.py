"""
Gemini Embedding Service — gemini-embedding-2-preview (new google.genai SDK)
Supports: text, PDF (pdfplumber), images (base64), video (frame sampling)
Output: 3072-dim vectors via Matryoshka Representation Learning
"""
import os
import io
import base64
import hashlib
import tempfile
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types as genai_types

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
EMBEDDING_MODEL = "gemini-embedding-2-preview"
EMBED_DIM = 3072
CHUNK_SIZE = 1200   # characters (~300 tokens)
CHUNK_OVERLAP = 150

_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None and GEMINI_API_KEY:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


# ─── Text Chunking ────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    if not text.strip():
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = end - overlap
    return chunks


# ─── Embedding Calls ─────────────────────────────────────────────────────────

def embed_text_chunk(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    client = _get_client()
    if not client:
        raise RuntimeError("GEMINI_API_KEY not configured")
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=genai_types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=EMBED_DIM,
        ),
    )
    return list(result.embeddings[0].values)


def embed_query(query: str) -> list[float]:
    return embed_text_chunk(query, task_type="RETRIEVAL_QUERY")


def embed_image_bytes(image_bytes: bytes, mime_type: str = "image/jpeg") -> tuple[str, list[float]]:
    """Embed an image using Gemini multimodal embedding."""
    client = _get_client()
    if not client:
        raise RuntimeError("GEMINI_API_KEY not configured")

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    content = genai_types.Content(parts=[
        genai_types.Part(inline_data=genai_types.Blob(mime_type=mime_type, data=b64)),
        genai_types.Part(text="Image content for semantic retrieval."),
    ])
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=content,
        config=genai_types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=EMBED_DIM,
        ),
    )
    caption = f"[Image: {hashlib.md5(image_bytes).hexdigest()[:8]}]"
    return caption, list(result.embeddings[0].values)


# ─── File Processors ──────────────────────────────────────────────────────────

def process_text_file(content: bytes) -> list[dict]:
    text = content.decode("utf-8", errors="ignore")
    chunks = chunk_text(text)
    results = []
    for i, chunk in enumerate(chunks):
        vec = embed_text_chunk(chunk)
        results.append({"chunk_text": chunk, "chunk_index": i, "embedding": vec, "metadata": {"type": "text"}})
    return results


def process_pdf_file(content: bytes) -> list[dict]:
    import pdfplumber
    results = []
    chunk_index = 0
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page_num, page in enumerate(pdf.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                chunks = chunk_text(page_text)
                for chunk in chunks:
                    vec = embed_text_chunk(chunk)
                    results.append({
                        "chunk_text": chunk,
                        "chunk_index": chunk_index,
                        "embedding": vec,
                        "metadata": {"type": "pdf", "page": page_num + 1},
                    })
                    chunk_index += 1
    return results


def process_image_file(content: bytes, mime_type: str = "image/jpeg") -> list[dict]:
    caption, vec = embed_image_bytes(content, mime_type)
    return [{"chunk_text": caption, "chunk_index": 0, "embedding": vec, "metadata": {"type": "image"}}]


def process_video_file(content: bytes, max_frames: int = 8) -> list[dict]:
    try:
        import cv2
        from PIL import Image

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        interval = max(1, total_frames // max_frames)

        results = []
        frame_idx = 0
        sampled = 0
        while cap.isOpened() and sampled < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % interval == 0:
                pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                buf = io.BytesIO()
                pil_img.save(buf, format="JPEG")
                caption, vec = embed_image_bytes(buf.getvalue(), "image/jpeg")
                results.append({
                    "chunk_text": f"[Video Frame {sampled + 1}]: {caption}",
                    "chunk_index": sampled,
                    "embedding": vec,
                    "metadata": {"type": "video_frame", "frame_index": frame_idx},
                })
                sampled += 1
            frame_idx += 1

        cap.release()
        os.unlink(tmp_path)
        return results if results else _video_fallback(content)

    except ImportError:
        return _video_fallback(content)
    except Exception:
        return _video_fallback(content)


def _video_fallback(content: bytes) -> list[dict]:
    desc = f"[Video file — {len(content) // 1024}KB. Frame extraction unavailable.]"
    vec = embed_text_chunk(desc)
    return [{"chunk_text": desc, "chunk_index": 0, "embedding": vec, "metadata": {"type": "video_fallback"}}]


# ─── Main Dispatcher ──────────────────────────────────────────────────────────

def process_file_for_embedding(content: bytes, file_type: str, mime_type: str = "") -> list[dict]:
    ft = file_type.lower()
    if ft == "pdf":
        return process_pdf_file(content)
    elif ft in ("image", "jpg", "jpeg", "png", "gif", "webp"):
        return process_image_file(content, mime_type or "image/jpeg")
    elif ft in ("video", "mp4", "mov", "avi", "mkv"):
        return process_video_file(content)
    else:
        return process_text_file(content)

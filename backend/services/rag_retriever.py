"""
RAG Retriever — Triple-Context Weighted Search
Searches: Global KB + User KB + User Product context
Combines results using rag_weights from agent config
"""
import os
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services.embedding import embed_query


async def search_embeddings(
    db: AsyncSession,
    query: str,
    user_id: Optional[str] = None,
    is_global: Optional[bool] = None,
    top_k: int = 5,
) -> list[dict]:
    """
    Cosine similarity search on knowledge_embeddings via pgvector.
    Returns top_k chunks with score, text, and metadata.
    """
    query_vec = embed_query(query)
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"

    # Build WHERE clause
    conditions = []
    params = {"vec": vec_str, "top_k": top_k}

    if is_global is True:
        conditions.append("ke.is_global = true")
    elif is_global is False and user_id:
        conditions.append("ke.is_global = false")
        conditions.append("ke.user_id = :user_id")
        params["user_id"] = user_id
    elif user_id:
        conditions.append("(ke.is_global = true OR ke.user_id = :user_id)")
        params["user_id"] = user_id

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

    sql = text(f"""
        SELECT
            ke.id,
            ke.chunk_text,
            ke.chunk_index,
            ke.is_global,
            ke.metadata,
            kb.file_name,
            kb.file_type,
            1 - (ke.embedding <=> :vec::vector) AS score
        FROM knowledge_embeddings ke
        JOIN knowledge_base kb ON kb.id = ke.knowledge_base_id
        {where_clause}
        ORDER BY ke.embedding <=> :vec::vector
        LIMIT :top_k
    """)

    result = await db.execute(sql, params)
    rows = result.fetchall()

    return [
        {
            "id": row.id,
            "chunk_text": row.chunk_text,
            "chunk_index": row.chunk_index,
            "is_global": row.is_global,
            "file_name": row.file_name,
            "file_type": row.file_type,
            "score": float(row.score),
        }
        for row in rows
    ]


async def build_rag_context(
    db: AsyncSession,
    query: str,
    user_id: str,
    rag_weights: dict,
    user_product: Optional[dict] = None,
    top_k_each: int = 3,
) -> str:
    """
    Triple-context RAG: Global + User + Product.
    Weights: {"global": 0.3, "user": 0.5, "product": 0.2}
    Returns a formatted string to inject into agent system prompt.
    """
    global_w = rag_weights.get("global", 0.3)
    user_w = rag_weights.get("user", 0.5)
    product_w = rag_weights.get("product", 0.2)

    context_parts = []

    # 1. Global knowledge search
    if global_w > 0:
        global_results = await search_embeddings(db, query, is_global=True, top_k=top_k_each)
        if global_results:
            global_text = "\n".join(
                f"[Global KB — {r['file_name']}]: {r['chunk_text']}"
                for r in global_results
            )
            context_parts.append(
                f"## Global Knowledge (weight: {global_w:.0%})\n{global_text}"
            )

    # 2. User-specific knowledge search
    if user_w > 0:
        user_results = await search_embeddings(db, query, user_id=user_id, is_global=False, top_k=top_k_each)
        if user_results:
            user_text = "\n".join(
                f"[User KB — {r['file_name']}]: {r['chunk_text']}"
                for r in user_results
            )
            context_parts.append(
                f"## User Knowledge (weight: {user_w:.0%})\n{user_text}"
            )

    # 3. Product context (from user_products table, no vector search needed)
    if product_w > 0 and user_product:
        prod_lines = []
        if user_product.get("company_name"):
            prod_lines.append(f"Company: {user_product['company_name']}")
        if user_product.get("product_description"):
            prod_lines.append(f"Product: {user_product['product_description']}")
        if user_product.get("value_proposition"):
            prod_lines.append(f"Value Prop: {user_product['value_proposition']}")
        if user_product.get("target_audience"):
            prod_lines.append(f"Target Audience: {user_product['target_audience']}")
        if prod_lines:
            context_parts.append(
                f"## Product Context (weight: {product_w:.0%})\n" + "\n".join(prod_lines)
            )

    if not context_parts:
        return ""

    return "\n\n---\n".join(context_parts)

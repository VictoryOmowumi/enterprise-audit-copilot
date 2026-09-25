import os
import asyncpg
from flashrank import Ranker, RerankRequest
from app.embeddings import generate_embeddings

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://audit_admin:audit_admin_password@db:5432/audit_db"
)

# Initialize lightweight local cross-encoder ranker
_ranker_instance = None

def get_ranker() -> Ranker:
    global _ranker_instance
    if _ranker_instance is None:
        print("📦 Initializing FlashRank Cross-Encoder...")
        # Default model is ms-marco-TinyBERT-L-2-v2 (~4MB)
        _ranker_instance = Ranker()
        print("✅ FlashRank ready.")
    return _ranker_instance

async def hybrid_search(
    query_text: str, 
    vendor_code: str = None, 
    top_candidates: int = 10,
    top_reranked: int = 3
) -> list[dict]:
    """
    Performs hybrid retrieval:
    1. Vector cosine similarity via pgvector
    2. Full-text BM25 search via tsvector
    3. Merges candidate pools
    4. Re-ranks candidates with cross-encoder
    """
    # 1. Generate query embedding
    query_vector = generate_embeddings([query_text])[0]
    query_vector_str = str(query_vector)

    conn = await asyncpg.connect(dsn=DATABASE_URL)
    candidates = {}

    try:
        # 2. Vector Cosine Search (pgvector)
        vector_sql = """
            SELECT 
                c.id, c.document_name, c.section_title, c.clause_type, c.content,
                1 - (c.embedding <=> $1::vector) AS score,
                'dense_vector' AS source
            FROM contract_clauses c
            JOIN vendors v ON c.vendor_id = v.id
            WHERE c.embedding IS NOT NULL
              AND ($2::text IS NULL OR v.contract_code = $2::text)
            ORDER BY c.embedding <=> $1::vector ASC
            LIMIT $3;
        """
        dense_rows = await conn.fetch(vector_sql, query_vector_str, vendor_code, top_candidates)
        for r in dense_rows:
            candidates[r["id"]] = {
                "id": r["id"],
                "section_title": r["section_title"],
                "document_name": r["document_name"],
                "clause_type": r["clause_type"],
                "content": r["content"],
                "vector_score": float(r["score"]),
                "fts_score": 0.0
            }

        # 3. Lexical / Keyword Search (PostgreSQL tsvector & ts_rank)
        # websearch_to_tsquery allows natural phrases without breaking on syntax
        fts_sql = """
            SELECT 
                c.id, c.document_name, c.section_title, c.clause_type, c.content,
                ts_rank_cd(c.search_vector, websearch_to_tsquery('english', $1)) AS score,
                'keyword_fts' AS source
            FROM contract_clauses c
            JOIN vendors v ON c.vendor_id = v.id
            WHERE c.search_vector @@ websearch_to_tsquery('english', $1)
              AND ($2::text IS NULL OR v.contract_code = $2::text)
            ORDER BY score DESC
            LIMIT $3;
        """
        fts_rows = await conn.fetch(fts_sql, query_text, vendor_code, top_candidates)
        for r in fts_rows:
            cid = r["id"]
            if cid in candidates:
                candidates[cid]["fts_score"] = float(r["score"])
            else:
                candidates[cid] = {
                    "id": r["id"],
                    "section_title": r["section_title"],
                    "document_name": r["document_name"],
                    "clause_type": r["clause_type"],
                    "content": r["content"],
                    "vector_score": 0.0,
                    "fts_score": float(r["score"])
                }

    finally:
        await conn.close()

    candidate_list = list(candidates.values())
    if not candidate_list:
        return []

    # 4. Cross-Encoder Re-ranking via FlashRank
    ranker = get_ranker()
    passages = [
        {"id": c["id"], "text": f"{c['section_title']}\n{c['content']}"}
        for c in candidate_list
    ]

    rerank_request = RerankRequest(query=query_text, passages=passages)
    ranked_results = ranker.rerank(rerank_request)

    # Reattach metadata and return the top reranked items
    final_results = []
    for item in ranked_results[:top_reranked]:
        matched = candidates[item["id"]]
        matched["rerank_score"] = float(item["score"])
        final_results.append(matched)

    return final_results
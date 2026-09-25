import os
import asyncpg
from app.embeddings import generate_embeddings

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://audit_admin:audit_admin_password@db:5432/audit_db"
)

async def hybrid_search(
    query_text: str, 
    vendor_code: str = None, 
    top_candidates: int = 10,
    top_reranked: int = 3
) -> list[dict]:
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    candidates = {}

    try:
        # 1. Attempt Vector Search (pgvector)
        try:
            query_vector = generate_embeddings([query_text])[0]
            query_vector_str = str(query_vector)

            vector_sql = """
                SELECT 
                    c.id, c.document_name, c.section_title, c.clause_type, c.content,
                    1 - (c.embedding <=> $1::vector) AS score
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
        except Exception as vec_err:
            print(f"⚠️ Vector search skipped (memory protection): {vec_err}")

        # 2. PostgreSQL Full-Text Search (BM25 / tsvector) - 0 MB Python RAM
        fts_sql = """
            SELECT 
                c.id, c.document_name, c.section_title, c.clause_type, c.content,
                ts_rank_cd(c.search_vector, websearch_to_tsquery('english', $1)) AS score
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

    # Sort results by fused score
    candidate_list.sort(
        key=lambda x: (x.get("vector_score", 0.0) * 0.6 + x.get("fts_score", 0.0) * 0.4),
        reverse=True
    )
    return candidate_list[:top_reranked]
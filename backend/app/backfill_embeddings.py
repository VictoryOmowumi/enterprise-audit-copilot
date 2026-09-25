import os
import asyncio
import asyncpg
from app.embeddings import generate_embeddings

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://audit_admin:audit_admin_password@db:5432/audit_db"
)

async def backfill():
    print(f"🚀 Connecting to database for embedding backfill...")
    conn = await asyncpg.connect(dsn=DATABASE_URL)

    try:
        # Fetch rows where embedding hasn't been generated yet
        rows = await conn.fetch(
            "SELECT id, section_title, content FROM contract_clauses WHERE embedding IS NULL;"
        )

        if not rows:
            print("✨ All contract clauses already have vector embeddings.")
            return

        print(f"🔍 Found {len(rows)} clauses needing vector embeddings.")

        # Prepare text representation for embedding (header + content)
        clause_ids = [r["id"] for r in rows]
        texts_to_embed = [f"{r['section_title']}: {r['content']}" for r in rows]

        # Generate 768-dim vectors
        print("🧠 Computing dense vector embeddings...")
        embeddings = generate_embeddings(texts_to_embed)
        if len(embeddings) != len(clause_ids):
            print("⚠️ No embedding backend available (set HF_TOKEN or ENABLE_LOCAL_EMBEDDINGS=true). Nothing updated.")
            return

        # Batch update PostgreSQL
        print("💾 Saving embeddings to pgvector...")
        for clause_id, vec in zip(clause_ids, embeddings):
            # pgvector accepts vector formatted as a string list, e.g. '[0.012, -0.043, ...]'
            vec_str = str(vec)
            await conn.execute(
                """
                UPDATE contract_clauses
                SET embedding = $1::vector
                WHERE id = $2;
                """,
                vec_str, clause_id
            )

        print(f"✅ Successfully updated {len(clause_ids)} clauses with 768-dimensional vectors.")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(backfill())
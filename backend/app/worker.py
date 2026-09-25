import os
import json
import time
import redis
import asyncio
import asyncpg
from app.embeddings import generate_embeddings

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://audit_admin:audit_admin_password@db:5432/audit_db"
)
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Redis connection
r = redis.from_url(REDIS_URL, decode_responses=True)
QUEUE_KEY = "audit:ingestion:queue"

async def process_clause_job(task_data: dict):
    """
    Simulates asynchronous chunking, embedding generation, and DB insertion.
    """
    vendor_code = task_data.get("vendor_code")
    section_title = task_data.get("section_title")
    content = task_data.get("content")
    clause_type = task_data.get("clause_type", "GENERAL")
    doc_name = task_data.get("document_name", "manual_entry.md")

    print(f"⚙️ [Worker] Generating embedding for clause: '{section_title}'...")

    # 1. Generate 768-dim vector. When no embedding backend is available the clause
    #    is stored with a NULL embedding: FTS still finds it, and
    #    backfill_embeddings.py fills the vector later.
    text_to_embed = f"{section_title}: {content}"
    vectors = generate_embeddings([text_to_embed])
    vector_str = str(vectors[0]) if vectors else None
    if vector_str is None:
        print("⚠️ [Worker] No embedding available; storing clause for later backfill.")

    # 2. Write to PostgreSQL
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        vendor_row = await conn.fetchrow(
            "SELECT id FROM vendors WHERE contract_code = $1;", vendor_code
        )
        if not vendor_row:
            vendor_id = await conn.fetchval(
                """
                INSERT INTO vendors (name, contract_code)
                VALUES ($1, $2) RETURNING id;
                """,
                f"Vendor {vendor_code}", vendor_code
            )
        else:
            vendor_id = vendor_row["id"]

        clause_id = await conn.fetchval(
            """
            INSERT INTO contract_clauses 
            (vendor_id, document_name, section_title, clause_type, content, embedding)
            VALUES ($1, $2, $3, $4, $5, $6::vector)
            RETURNING id;
            """,
            vendor_id, doc_name, section_title, clause_type, content, vector_str
        )
        print(f"✅ [Worker] Stored clause ID {clause_id} in pgvector successfully.")
    finally:
        await conn.close()

    return {"clause_id": clause_id, "embedded": vector_str is not None}

def run_worker():
    print("🚀 [Worker] Ingestion Background Worker started. Listening for Redis jobs...")
    while True:
        task_id = None
        try:
            # BRPOP blocks until an item is pushed into the queue (0 = block forever)
            result = r.brpop(QUEUE_KEY, timeout=5)
            if result:
                _, task_json = result
                task_data = json.loads(task_json)
                task_id = task_data.get("task_id", "unknown")
                print(f"📥 [Worker] Received task [{task_id}]: {task_data.get('section_title')}")

                # Update status in Redis
                r.set(f"audit:task:{task_id}", json.dumps({"status": "processing"}), ex=3600)

                # Execute async database and embedding work
                outcome = asyncio.run(process_clause_job(task_data))

                # Mark complete
                r.set(f"audit:task:{task_id}", json.dumps({"status": "completed", **outcome}), ex=3600)
                print(f"🎉 [Worker] Task [{task_id}] completed.")
        except Exception as e:
            print(f"❌ [Worker] Error processing job: {e}")
            # Record the failure so pollers don't wait on "processing" forever.
            if task_id:
                try:
                    r.set(f"audit:task:{task_id}", json.dumps({"status": "failed", "error": str(e)}), ex=3600)
                except Exception:
                    pass
            time.sleep(2)

if __name__ == "__main__":
    run_worker()
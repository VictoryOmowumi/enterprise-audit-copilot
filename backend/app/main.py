import os
import json
import uuid
import redis
import asyncpg
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.retrieval import hybrid_search

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://audit_admin:audit_admin_password@db:5432/audit_db"
)
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

db_pool = None
redis_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool, redis_client
    print("🚀 Initializing connection pools...")
    try:
        db_pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=2, max_size=10)
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        print("✅ Database and Redis connections established.")
    except Exception as e:
        print(f"❌ Connection init failed: {e}")
        raise e
    yield
    if db_pool:
        await db_pool.close()

app = FastAPI(
    title="Enterprise Audit Copilot API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    query: str
    vendor_code: Optional[str] = None
    limit: Optional[int] = 3

class AsyncIngestRequest(BaseModel):
    vendor_code: str
    section_title: str
    clause_type: str
    content: str
    document_name: Optional[str] = "api_submission.md"

@app.get("/")
async def root():
    return {"status": "online", "service": "Enterprise Audit Copilot"}

@app.get("/health")
async def health_check():
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database pool not ready")
    try:
        async with db_pool.acquire() as conn:
            db_version = await conn.fetchval("SELECT version();")
            vector_installed = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector');"
            )
        redis_ping = redis_client.ping() if redis_client else False

        return {
            "status": "healthy",
            "database": {
                "connected": True,
                "version": db_version.split()[0] + " " + db_version.split()[1],
                "pgvector_active": vector_installed
            },
            "redis_connected": redis_ping
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(ex)}")

@app.post("/api/retrieve")
async def retrieve_clauses(payload: SearchRequest):
    try:
        results = await hybrid_search(
            query_text=payload.query,
            vendor_code=payload.vendor_code,
            top_reranked=payload.limit
        )
        return {
            "query": payload.query,
            "matched_clauses_count": len(results),
            "clauses": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(e)}")

@app.get("/api/shipments")
async def list_shipments(
    vendor_code: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """
    Lists shipment records joined with vendor metadata, newest dispatch first.
    SLA thresholds and transit times are derived by the client from the timestamps.
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database pool not ready")

    sql = """
        SELECT
            s.tracking_number, s.origin, s.destination,
            s.dispatched_at, s.expected_delivery_at, s.actual_delivery_at,
            s.status, s.declared_value, s.discrepancy_notes,
            v.contract_code, v.name AS vendor_name
        FROM shipments s
        JOIN vendors v ON s.vendor_id = v.id
        WHERE ($1::text IS NULL OR v.contract_code = $1::text)
        ORDER BY s.dispatched_at DESC
        LIMIT $2;
    """
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(sql, vendor_code, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch shipments: {str(e)}")

    shipments = [
        {
            "tracking_number": r["tracking_number"],
            "vendor_code": r["contract_code"],
            "vendor_name": r["vendor_name"],
            "origin": r["origin"],
            "destination": r["destination"],
            "dispatched_at": r["dispatched_at"].isoformat(),
            "expected_delivery_at": r["expected_delivery_at"].isoformat(),
            "actual_delivery_at": r["actual_delivery_at"].isoformat() if r["actual_delivery_at"] else None,
            "status": r["status"],
            "declared_value": float(r["declared_value"]),
            "discrepancy_notes": r["discrepancy_notes"],
        }
        for r in rows
    ]
    return {"total": len(shipments), "shipments": shipments}

@app.post("/api/ingest/async", status_code=status.HTTP_202_ACCEPTED)
async def queue_clause_ingestion(payload: AsyncIngestRequest):
    """
    Accepts ingestion payload, writes job to Redis queue, returns 202 Accepted.
    """
    if not redis_client:
        raise HTTPException(status_code=503, detail="Redis queue unavailable")

    task_id = str(uuid.uuid4())
    job_payload = payload.model_dump()
    job_payload["task_id"] = task_id

    # Store initial pending state in Redis
    redis_client.set(f"audit:task:{task_id}", json.dumps({"status": "queued"}), ex=3600)

    # Push to task queue
    redis_client.lpush("audit:ingestion:queue", json.dumps(job_payload))

    return {
        "task_id": task_id,
        "status": "queued",
        "message": "Clause submitted for asynchronous embedding and storage."
    }

@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    """
    Polls task completion status from Redis.
    """
    if not redis_client:
        raise HTTPException(status_code=503, detail="Redis queue unavailable")
    
    val = redis_client.get(f"audit:task:{task_id}")
    if not val:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return json.loads(val)
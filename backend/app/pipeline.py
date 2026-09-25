import os
import re
import sys
import asyncio
import traceback
import polars as pl
import asyncpg
from app.schemas import ShipmentSchema, ContractClauseChunk

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://audit_admin:audit_admin_password@db:5432/audit_db")

async def get_or_create_vendor(conn, name: str, code: str) -> int:
    row = await conn.fetchrow(
        """
        INSERT INTO vendors (name, contract_code)
        VALUES ($1, $2)
        ON CONFLICT (contract_code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
        """,
        name, code
    )
    return row["id"]

def parse_markdown_clauses(filepath: str, vendor_code: str) -> list[ContractClauseChunk]:
    """
    Parses a structured Markdown contract into discrete section chunks.
    """
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    filename = os.path.basename(filepath)
    # Split by markdown H2 sections
    sections = re.split(r'\n(?=## )', text)
    chunks = []

    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue

        lines = sec.split("\n")
        title_line = lines[0].lstrip("#").strip()
        body = "\n".join(lines[1:]).strip()

        # Classify clause type based on header content
        clause_type = "GENERAL"
        title_lower = title_line.lower()
        if "penalty" in title_lower or "delayed" in title_lower:
            clause_type = "SLA_PENALTY"
        elif "damage" in title_lower or "integrity" in title_lower:
            clause_type = "DAMAGE_LIABILITY"
        elif "temperature" in title_lower or "cold chain" in title_lower:
            clause_type = "TEMPERATURE_CONTROL"
        elif "timeline" in title_lower:
            clause_type = "DELIVERY_TIMELINE"

        if body:
            chunks.append(ContractClauseChunk(
                vendor_code=vendor_code,
                document_name=filename,
                section_title=title_line,
                clause_type=clause_type,
                content=f"{title_line}\n{body}"
            ))

    return chunks

async def ingest_all(contracts_path: str, shipments_path: str):
    print(f"🚀 Connecting to database: {DATABASE_URL.split('@')[-1]}...")
    
    conn = None
    try:
        # Add a 10s timeout so it never hangs silently
        conn = await asyncio.wait_for(asyncpg.connect(dsn=DATABASE_URL), timeout=10.0)
        print("✅ Database connection established.")

        # 1. Ensure Vendor exists
        vendor_id = await get_or_create_vendor(conn, "Apex Logistics Global", "VEND-APEX-001")
        print(f"✅ Verified Vendor: Apex Logistics Global (ID: {vendor_id})")

        # 2. Ingest Unstructured Contract Sections
        print(f"📄 Parsing contract clauses from {contracts_path}...")
        clauses = parse_markdown_clauses(contracts_path, "VEND-APEX-001")

        for c in clauses:
            await conn.execute(
                """
                INSERT INTO contract_clauses 
                (vendor_id, document_name, section_title, clause_type, content, page_number)
                VALUES ($1, $2, $3, $4, $5, $6);
                """,
                vendor_id, c.document_name, c.section_title, c.clause_type, c.content, c.page_number
            )
        print(f"✅ Ingested {len(clauses)} contract clauses.")

        # 3. Ingest Structured Shipments via Polars
        print(f"📊 Reading and validating shipment logs from {shipments_path}...")
        if not os.path.exists(shipments_path):
            raise FileNotFoundError(f"Shipments CSV not found at: {shipments_path}")

        df = pl.read_csv(shipments_path)

        valid_count = 0
        for row in df.iter_rows(named=True):
            shipment = ShipmentSchema(**row)

            await conn.execute(
                """
                INSERT INTO shipments 
                (tracking_number, vendor_id, origin, destination, dispatched_at, 
                 expected_delivery_at, actual_delivery_at, status, declared_value, discrepancy_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (tracking_number) DO NOTHING;
                """,
                shipment.tracking_number,
                vendor_id,
                shipment.origin,
                shipment.destination,
                shipment.dispatched_at,
                shipment.expected_delivery_at,
                shipment.actual_delivery_at,
                shipment.status,
                shipment.declared_value,
                shipment.discrepancy_notes
            )
            valid_count += 1

        print(f"✅ Validated and stored {valid_count} shipment records.")
        print("🎉 Ingestion pipeline complete!")

    except Exception as exc:
        print(f"❌ Ingestion failed: {exc}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    c_path = os.getenv("CONTRACT_FILE", "/data/contracts/apex_logistics_sla.md")
    s_path = os.getenv("SHIPMENT_FILE", "/data/shipments/shipment_records.csv")
    asyncio.run(ingest_all(c_path, s_path))
-- Step 1: Ensure vector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    contract_code VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Contract Clauses table (Hybrid: Relational + Vector + Full-Text)
CREATE TABLE IF NOT EXISTS contract_clauses (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    document_name VARCHAR(255) NOT NULL,
    section_title VARCHAR(255),
    clause_type VARCHAR(100), -- e.g., 'SLA_DELIVERY', 'DAMAGE_LIABILITY', 'PENALTY'
    content TEXT NOT NULL,
    page_number INTEGER DEFAULT 1,
    
    -- 768-dimensional vector embedding for semantic search
    embedding vector(768),
    
    -- Full-text search vector for lexical keyword search (Hybrid RAG)
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(section_title, '') || ' ' || content)) STORED,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Indexing for high-performance retrieval

-- HNSW Vector Index: Fast approximate nearest neighbors using cosine similarity
CREATE INDEX IF NOT EXISTS idx_contract_clauses_embedding 
ON contract_clauses USING hnsw (embedding vector_cosine_ops);

-- GIN Index: Enables lightning-fast keyword matching for hybrid search
CREATE INDEX IF NOT EXISTS idx_contract_clauses_fts 
ON contract_clauses USING gin (search_vector);

-- Step 5: Shipments table (Structured operational log)
CREATE TABLE IF NOT EXISTS shipments (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(100) NOT NULL UNIQUE,
    vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    dispatched_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_delivery_at TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_delivery_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL, -- 'DELIVERED', 'DELAYED', 'DAMAGED', 'IN_TRANSIT'
    declared_value NUMERIC(12, 2) NOT NULL,
    discrepancy_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
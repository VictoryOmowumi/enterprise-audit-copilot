export type ClauseType =
  | "SLA_PENALTY"
  | "TEMPERATURE_CONTROL"
  | "DAMAGE_LIABILITY"
  | "DELIVERY_TIMELINE"
  | "GENERAL"

export type ShipmentStatus = "BREACH" | "AT_RISK" | "COMPLIANT"

export type BreachKind = "DELAY" | "COLD_CHAIN" | "DAMAGE"

export interface Vendor {
  code: string
  name: string
}

export interface ColdChainTelemetry {
  thresholdC: number
  maxTempC: number
  /** Minutes spent above thresholdC. 0 means no excursion. */
  excursionMinutes: number
}

/** Counts are null when the source record doesn't state them. */
export interface DamageReport {
  cartonsDamaged: number | null
  cartonsTotal: number | null
  podPhotos: number | null
}

export interface Shipment {
  id: string
  vendorCode: string
  origin: string
  destination: string
  dispatchedAt: string
  /** Elapsed time so far when the shipment is still in transit. */
  transitMinutes: number
  inTransit: boolean
  slaLimitHours: number
  coldChain: ColdChainTelemetry | null
  damage: DamageReport | null
  consignmentValue: number
  status: ShipmentStatus
  /** Ordered by severity; the first kind selects the governing clause. */
  breachKinds: BreachKind[]
  /** Carrier or receiving-dock notes from the operational record. */
  notes: string | null
}

export type ShipmentRecordStatus = "DELIVERED" | "DELAYED" | "DAMAGED" | "IN_TRANSIT"

/** Mirrors a row from `GET /api/shipments` in backend app/main.py. */
export interface ShipmentRecord {
  tracking_number: string
  vendor_code: string
  vendor_name: string
  origin: string
  destination: string
  dispatched_at: string
  expected_delivery_at: string
  actual_delivery_at: string | null
  status: ShipmentRecordStatus | (string & {})
  declared_value: number
  discrepancy_notes: string | null
}

export interface ShipmentsResponse {
  total: number
  shipments: ShipmentRecord[]
}

/** Mirrors a row returned by backend `hybrid_search` in app/retrieval.py. */
export interface ContractClause {
  id: string | number
  section_title: string
  document_name: string
  clause_type: ClauseType | (string & {})
  content: string
  vector_score: number
  fts_score: number
}

/** Mirrors the `POST /api/retrieve` response body in app/main.py. */
export interface AuditResponse {
  query: string
  matched_clauses_count: number
  clauses: ContractClause[]
}

export interface RetrieveRequest {
  query: string
  vendor_code: string
  limit: number
}

export type RetrievalSource = "live" | "demo"

export interface RetrievalResult {
  response: AuditResponse
  source: RetrievalSource
  latencyMs: number
  error?: string
}

/** Mirrors a row from `GET /api/contracts` in backend app/main.py. */
export interface ContractClauseRecord {
  id: number
  document_name: string
  section_title: string
  clause_type: ClauseType | (string & {})
  content: string
  page_number: number
  /** False while the clause awaits an embedding backfill (FTS-only until then). */
  embedded: boolean
  created_at: string | null
  vendor_code: string
  vendor_name: string
}

export interface ContractsResponse {
  total: number
  clauses: ContractClauseRecord[]
}

/** Body of `POST /api/ingest/async`. */
export interface IngestRequest {
  vendor_code: string
  section_title: string
  clause_type: string
  content: string
  document_name: string
}

/** Redis task state from `GET /api/tasks/{id}`, written by backend app/worker.py. */
export type IngestTaskState =
  | { status: "queued" | "processing" }
  | { status: "completed"; clause_id: number; embedded: boolean }
  | { status: "failed"; error: string }

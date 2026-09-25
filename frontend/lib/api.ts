import { DEMO_CLAUSES, SHIPMENTS } from "@/lib/mock-data"
import type {
  AuditResponse,
  BreachKind,
  ContractClause,
  RetrievalResult,
  RetrievalSource,
  RetrieveRequest,
  Shipment,
  ShipmentRecord,
  ShipmentStatus,
  ShipmentsResponse,
} from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL
const TIMEOUT_MS = 10_000

export interface ShipmentsResult {
  shipments: Shipment[]
  source: RetrievalSource
  error?: string
}

export async function fetchShipments(vendorCode: string, signal?: AbortSignal): Promise<ShipmentsResult> {
  const demo = (error: string): ShipmentsResult => ({
    shipments: SHIPMENTS.filter((s) => s.vendorCode === vendorCode),
    source: "demo",
    error,
  })
  if (!API_URL) return demo("NEXT_PUBLIC_API_URL is not set")

  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  try {
    const url = `${API_URL.replace(/\/$/, "")}/api/shipments?vendor_code=${encodeURIComponent(vendorCode)}`
    const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as ShipmentsResponse
    const now = Date.now()
    return { shipments: body.shipments.map((r) => toShipment(r, now)), source: "live" }
  } catch (err) {
    if (signal?.aborted) throw err
    return demo(err instanceof Error ? err.message : String(err))
  }
}

const AT_RISK_SHARE = 0.9

/**
 * Derives audit telemetry from an operational record: the SLA threshold is the
 * contracted window (expected − dispatched), transit is actual − dispatched, or
 * time elapsed so far for shipments still on the road.
 */
export function toShipment(r: ShipmentRecord, now: number): Shipment {
  const dispatched = Date.parse(r.dispatched_at)
  const expected = Date.parse(r.expected_delivery_at)
  const delivered = r.actual_delivery_at ? Date.parse(r.actual_delivery_at) : null
  const inTransit = delivered === null

  const slaLimitHours = Math.round(((expected - dispatched) / 3_600_000) * 100) / 100
  const transitMinutes = Math.round(((delivered ?? now) - dispatched) / 60_000)
  const late = transitMinutes > slaLimitHours * 60
  const damaged = r.status === "DAMAGED"

  const breachKinds: BreachKind[] = []
  if (damaged) breachKinds.push("DAMAGE")
  if (late) breachKinds.push("DELAY")

  let status: ShipmentStatus = "COMPLIANT"
  if (breachKinds.length > 0) status = "BREACH"
  else if (inTransit && transitMinutes > slaLimitHours * 60 * AT_RISK_SHARE) status = "AT_RISK"

  const cartons = r.discrepancy_notes?.match(/(\d+)\s+cartons?/i)
  return {
    id: r.tracking_number,
    vendorCode: r.vendor_code,
    origin: r.origin,
    destination: r.destination,
    dispatchedAt: r.dispatched_at,
    transitMinutes,
    inTransit,
    slaLimitHours,
    coldChain: null,
    damage: damaged ? { cartonsDamaged: cartons ? Number(cartons[1]) : null, cartonsTotal: null, podPhotos: null } : null,
    consignmentValue: r.declared_value,
    status,
    breachKinds,
    notes: r.discrepancy_notes,
  }
}

export async function retrieveClauses(
  req: RetrieveRequest,
  signal?: AbortSignal
): Promise<RetrievalResult> {
  const started = performance.now()

  if (!API_URL) {
    return demoResult(req, started, "NEXT_PUBLIC_API_URL is not set")
  }

  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  try {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: combined,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as AuditResponse
    return {
      response: body,
      source: "live",
      latencyMs: Math.round(performance.now() - started),
    }
  } catch (err) {
    // A caller-initiated abort means a newer query superseded this one.
    if (signal?.aborted) throw err
    const reason = err instanceof Error ? err.message : String(err)
    return demoResult(req, started, reason)
  }
}

function demoResult(req: RetrieveRequest, started: number, error: string): RetrievalResult {
  const clauses = rankDemoClauses(req.query, req.limit)
  return {
    response: { query: req.query, matched_clauses_count: clauses.length, clauses },
    source: "demo",
    latencyMs: Math.round(performance.now() - started),
    error,
  }
}

const STOPWORDS = new Set(["and", "the", "of", "for", "a", "an", "to", "in", "on", "with"])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

/** Lexical-overlap ranking so the offline demo still responds to the query. */
function rankDemoClauses(query: string, limit: number): ContractClause[] {
  const terms = tokenize(query)
  return DEMO_CLAUSES.map((clause) => {
    const haystack = new Set(
      tokenize(`${clause.section_title} ${clause.clause_type.replace("_", " ")} ${clause.content}`)
    )
    const hits = terms.filter((t) => [...haystack].some((h) => h.startsWith(t) || t.startsWith(h))).length
    const overlap = terms.length ? hits / terms.length : 0
    return {
      ...clause,
      vector_score: Number((0.42 + overlap * 0.4).toFixed(4)),
      fts_score: Number((overlap * 0.1).toFixed(4)),
    }
  })
    .sort((a, b) => b.vector_score - a.vector_score)
    .slice(0, limit)
}

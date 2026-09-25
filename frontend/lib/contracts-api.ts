import { DEMO_CLAUSES, VENDORS } from "@/lib/mock-data"
import type {
  ContractClauseRecord,
  ContractsResponse,
  IngestRequest,
  IngestTaskState,
  RetrievalSource,
} from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
const TIMEOUT_MS = 10_000

export interface ContractsResult {
  clauses: ContractClauseRecord[]
  source: RetrievalSource
  error?: string
}

export async function fetchContracts(vendorCode: string, signal?: AbortSignal): Promise<ContractsResult> {
  if (!API_URL) return demoContracts(vendorCode, "NEXT_PUBLIC_API_URL is not set")
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  try {
    const res = await fetch(`${API_URL}/api/contracts?vendor_code=${encodeURIComponent(vendorCode)}`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as ContractsResponse
    return { clauses: body.clauses, source: "live" }
  } catch (err) {
    if (signal?.aborted) throw err
    return demoContracts(vendorCode, err instanceof Error ? err.message : String(err))
  }
}

function demoContracts(vendorCode: string, error: string): ContractsResult {
  const vendor = VENDORS.find((v) => v.code === vendorCode)
  return {
    source: "demo",
    error,
    clauses: DEMO_CLAUSES.map((c, i) => ({
      id: i + 1,
      document_name: c.document_name,
      section_title: c.section_title,
      clause_type: c.clause_type,
      content: c.content,
      page_number: 1,
      embedded: true,
      created_at: null,
      vendor_code: vendorCode,
      vendor_name: vendor?.name ?? vendorCode,
    })),
  }
}

/** Queues one clause for embedding and storage; resolves to the worker task id. */
export async function queueClause(req: IngestRequest): Promise<string> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set")
  const res = await fetch(`${API_URL}/api/ingest/async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Queueing failed: HTTP ${res.status}`)
  return ((await res.json()) as { task_id: string }).task_id
}

export async function fetchTask(taskId: string): Promise<IngestTaskState> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set")
  const res = await fetch(`${API_URL}/api/tasks/${encodeURIComponent(taskId)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Task lookup failed: HTTP ${res.status}`)
  return (await res.json()) as IngestTaskState
}

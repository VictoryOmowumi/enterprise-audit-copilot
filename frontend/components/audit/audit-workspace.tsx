"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { CommandHeader } from "@/components/audit/command-header"
import { InvestigationConsole } from "@/components/audit/investigation-console"
import { ReconciliationPanel } from "@/components/audit/reconciliation-panel"
import { ShipmentFeed } from "@/components/audit/shipment-feed"
import { fetchShipments, retrieveClauses, type ShipmentsResult } from "@/lib/api"
import { damageLabel, formatDuration, summarize, transitVarianceMinutes } from "@/lib/audit"
import { DEFAULT_VENDOR_CODE, QUICK_PROMPTS, VENDORS } from "@/lib/mock-data"
import { assessPenalty, governingClause } from "@/lib/penalty"
import { data } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { BreachKind, ContractClause, RetrievalResult, Shipment } from "@/lib/types"

const RESULT_LIMIT = 3

function promptFor(s: Shipment | null | undefined): string {
  return s?.breachKinds[0] ? QUICK_PROMPTS[s.breachKinds[0]] : QUICK_PROMPTS.DELAY
}

/** Default citation: the clause governing the shipment's breach, else the top hit. */
function defaultCitation(clauses: ContractClause[], s: Shipment | null | undefined) {
  const kind = s?.breachKinds[0]
  return (kind ? governingClause(kind, clauses) : clauses[0])?.id ?? null
}

type GoverningClauses = { vendorCode: string; byKind: Record<BreachKind, ContractClause | null> }

const BREACH_KINDS = Object.keys(QUICK_PROMPTS) as BreachKind[]

const NO_SHIPMENTS: Shipment[] = []

export function AuditWorkspace({ initialShipmentId = null }: { initialShipmentId?: string | null }) {
  const [vendorCode, setVendorCode] = useState(DEFAULT_VENDOR_CODE)
  const vendor = VENDORS.find((v) => v.code === vendorCode) ?? VENDORS[0]

  // Shipments are keyed by vendor so a stale response never shows under a newly chosen vendor.
  const [feed, setFeed] = useState<(ShipmentsResult & { vendorCode: string }) | null>(null)
  const feedReady = feed?.vendorCode === vendorCode
  const shipments = feedReady ? feed.shipments : NO_SHIPMENTS

  // One retrieval per breach kind, so portfolio exposure is priced from the contract.
  const [governing, setGoverning] = useState<GoverningClauses | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all(
      BREACH_KINDS.map((kind) =>
        retrieveClauses({ query: QUICK_PROMPTS[kind], vendor_code: vendorCode, limit: RESULT_LIMIT }, controller.signal).then(
          (res) => [kind, governingClause(kind, res.response.clauses)] as const
        )
      )
    )
      .then((pairs) =>
        setGoverning({ vendorCode, byKind: Object.fromEntries(pairs) as GoverningClauses["byKind"] })
      )
      .catch(() => {})
    return () => controller.abort()
  }, [vendorCode])

  const kpis = useMemo(
    () =>
      summarize(shipments, (s) => {
        const kind = s.breachKinds[0]
        if (!kind) return 0
        if (governing?.vendorCode !== vendorCode) return null
        return assessPenalty(s, governing.byKind[kind]).liability
      }),
    [shipments, governing, vendorCode]
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = shipments.find((s) => s.id === selectedId) ?? null

  const [query, setQuery] = useState(() => promptFor(null))
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<RetrievalResult | null>(null)
  const [citedId, setCitedId] = useState<ContractClause["id"] | null>(null)
  const inflight = useRef<AbortController | null>(null)

  const runRetrieval = useCallback(async (q: string, vendor_code: string, forShipment: Shipment | null) => {
    inflight.current?.abort()
    const controller = new AbortController()
    inflight.current = controller
    setLoading(true)
    try {
      const res = await retrieveClauses({ query: q, vendor_code, limit: RESULT_LIMIT }, controller.signal)
      setResult(res)
      setCitedId(defaultCitation(res.response.clauses, forShipment))
      setLoading(false)
    } catch {
      // Superseded by a newer request; that request owns the loading state.
    }
  }, [])

  // Load the vendor's shipments, then open the first one as the active case.
  useEffect(() => {
    const controller = new AbortController()
    fetchShipments(vendorCode, controller.signal)
      .then((res) => {
        setFeed({ ...res, vendorCode })
        const first = res.shipments.find((s) => s.id === initialShipmentId) ?? res.shipments[0] ?? null
        setSelectedId(first?.id ?? null)
        const q = promptFor(first)
        setQuery(q)
        void runRetrieval(q, vendorCode, first)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [vendorCode, runRetrieval, initialShipmentId])

  function selectShipment(s: Shipment) {
    if (s.id === selectedId) return
    setSelectedId(s.id)
    const q = promptFor(s)
    setQuery(q)
    void runRetrieval(q, vendorCode, s)
  }

  function changeVendor(code: string) {
    if (code === vendorCode) return
    setVendorCode(code)
    setSelectedId(null)
  }

  const clauses = result?.response.clauses ?? []
  const citedClause = clauses.find((c) => c.id === citedId) ?? null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-5">
      <ShipmentFeed shipments={shipments} loading={!feedReady} selectedId={selectedId} onSelect={selectShipment} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 pt-1">
        <CommandHeader
          shipment={selected}
          loading={!feedReady}
          vendors={VENDORS}
          vendorCode={vendorCode}
          onVendorChange={changeVendor}
          kpis={kpis}
          pipelineStatus={result?.source === "demo" || feed?.source === "demo" ? "degraded" : "ready"}
        />
        {selected && <CaseStats shipment={selected} />}
        <div className="flex min-h-0 flex-1 gap-5">
          <InvestigationConsole
            query={query}
            onQueryChange={setQuery}
            onSubmit={(q) => void runRetrieval(q, vendorCode, selected)}
            loading={loading}
            result={result}
            citedClauseId={citedId}
            onCite={setCitedId}
          />
          <ReconciliationPanel shipment={selected} vendor={vendor} clause={citedClause} />
        </div>
      </main>
    </div>
  )
}

function CaseStats({ shipment: s }: { shipment: Shipment }) {
  const variance = transitVarianceMinutes(s)
  const usage = Math.round((s.transitMinutes / (s.slaLimitHours * 60)) * 100)
  const excursion = s.coldChain && s.coldChain.excursionMinutes > 0

  const stats: { label: string; value: string; unit?: string; tone?: "danger" }[] = [
    { label: "Transit time", value: formatDuration(s.transitMinutes) },
    { label: "SLA threshold", value: String(s.slaLimitHours), unit: "h" },
    {
      label: "Variance",
      value: `${variance > 0 ? "+" : "−"}${formatDuration(variance)}`,
      tone: variance > 0 ? "danger" : undefined,
    },
    { label: "SLA consumed", value: String(usage), unit: "%", tone: usage > 100 ? "danger" : undefined },
  ]
  if (s.coldChain) {
    stats.push({
      label: "Peak temperature",
      value: s.coldChain.maxTempC.toFixed(1),
      unit: "°C",
      tone: excursion ? "danger" : undefined,
    })
  }
  if (s.damage) {
    stats.push({ label: "Damage", value: damageLabel(s.damage), tone: "danger" })
  }

  return (
    <dl className="flex shrink-0 flex-wrap gap-x-16 gap-y-4 mt-2 ml-2">
      {stats.map((st) => (
        <div key={st.label} className="flex flex-col gap-1">
          <dt className="text-xs text-ink-3">{st.label}</dt>
          <dd className={cn(data, "text-2xl font-light tracking-tight", st.tone === "danger" ? "text-danger" : "text-ink")}>
            {st.value}
            {st.unit && <span className="ml-0.5 text-base text-ink-3">{st.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { LegalDocument01Icon } from "@hugeicons/core-free-icons"

import { ClauseMarkdown, clauseBody, clauseTypeStyle } from "@/components/audit/clause-card"
import { UploadDialog } from "@/components/contracts/upload-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchContracts, type ContractsResult } from "@/lib/contracts-api"
import { DEFAULT_VENDOR_CODE, VENDORS } from "@/lib/mock-data"
import { data, surface } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { ContractClauseRecord } from "@/lib/types"

interface ContractDocument {
  name: string
  clauses: ContractClauseRecord[]
  embedded: number
}

export function ContractsView() {
  const vendor = VENDORS.find((v) => v.code === DEFAULT_VENDOR_CODE) ?? VENDORS[0]
  const [result, setResult] = useState<ContractsResult | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchContracts(vendor.code, controller.signal)
      .then(setResult)
      .catch(() => {})
    return () => controller.abort()
  }, [vendor.code, reloadKey])

  const documents = useMemo<ContractDocument[]>(() => {
    const byName = new Map<string, ContractClauseRecord[]>()
    for (const c of result?.clauses ?? []) byName.set(c.document_name, [...(byName.get(c.document_name) ?? []), c])
    return [...byName].map(([name, clauses]) => ({ name, clauses, embedded: clauses.filter((c) => c.embedded).length }))
  }, [result])

  const active = documents.find((d) => d.name === selectedDoc) ?? documents[0] ?? null
  const clauses = result?.clauses ?? []
  const embedded = clauses.filter((c) => c.embedded).length
  const types = new Set(clauses.map((c) => c.clause_type)).size
  const loading = result === null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 pt-1">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-ink">Contracts</h1>
          <p className="mt-1 text-sm text-ink-3">
            {vendor.name} ·{" "}
            {loading ? (
              "loading clauses…"
            ) : result.source === "live" ? (
              "live clause store"
            ) : (
              <span className="text-warn" title={result.error}>
                demo clauses (API offline, uploads disabled)
              </span>
            )}
          </p>
        </div>
        <UploadDialog
          vendor={vendor}
          existingDocuments={new Map(documents.map((d) => [d.name, d.clauses.length]))}
          disabled={loading || result.source !== "live"}
          onClosed={() => setReloadKey((k) => k + 1)}
        />
      </header>

      <dl className="mt-2 ml-2 flex shrink-0 flex-wrap gap-x-16 gap-y-4">
        {[
          { label: "Documents", value: String(documents.length) },
          { label: "Clauses", value: String(clauses.length) },
          { label: "Embedded", value: `${embedded}/${clauses.length}`, warn: embedded < clauses.length },
          { label: "Clause types", value: String(types) },
        ].map((st) => (
          <div key={st.label} className="flex flex-col gap-1">
            <dt className="text-xs text-ink-3">{st.label}</dt>
            <dd className={cn(data, "text-2xl font-light tracking-tight", st.warn ? "text-warn" : "text-ink")}>
              {loading ? <Skeleton className="h-7 w-14 bg-track" /> : st.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex min-h-0 flex-1 gap-5">
        <section className={cn(surface, "flex min-h-0 w-80 shrink-0 flex-col p-3")}>
          <h2 className="px-3 pt-2 pb-3 font-heading text-lg font-medium tracking-tight text-ink">Documents</h2>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-1">
              {loading
                ? Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-track/70" />)
                : documents.length === 0
                  ? <p className="px-3 py-10 text-center text-sm text-ink-3">No contracts yet. Upload one to get started.</p>
                  : documents.map((d) => (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() => setSelectedDoc(d.name)}
                        aria-pressed={d.name === active?.name}
                        className={cn(
                          "flex items-start gap-3 rounded-xl p-3 text-left transition-colors",
                          d.name === active?.name ? "bg-active-soft" : "hover:bg-surface-2"
                        )}
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <HugeiconsIcon icon={LegalDocument01Icon} size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{d.name}</span>
                          <span className={cn(data, "text-xs text-ink-3")}>
                            {d.clauses.length} clauses
                            {d.embedded < d.clauses.length && (
                              <span className="text-warn"> · {d.clauses.length - d.embedded} awaiting embedding</span>
                            )}
                          </span>
                        </span>
                      </button>
                    ))}
            </div>
          </ScrollArea>
        </section>

        <section className={cn(surface, "flex min-h-0 min-w-0 flex-1 flex-col")}>
          <div className="flex shrink-0 items-baseline justify-between gap-4 px-6 pt-5 pb-4">
            <h2 className="truncate font-heading text-lg font-medium tracking-tight text-ink">
              {active?.name ?? "Clauses"}
            </h2>
            {active && <span className={cn(data, "shrink-0 text-xs text-ink-3")}>{active.clauses.length} clauses</span>}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 px-6 pb-6">
              {loading
                ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-track/60" />)
                : active?.clauses.map((c) => <StoredClause key={c.id} clause={c} />)}
            </div>
          </ScrollArea>
        </section>
      </div>
    </div>
  )
}

function StoredClause({ clause }: { clause: ContractClauseRecord }) {
  const type = clauseTypeStyle(clause.clause_type)
  return (
    <article className="rounded-2xl border border-line bg-surface-2 p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{clause.section_title}</h3>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", type.className)}>{type.label}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium",
            clause.embedded ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
          )}
          title={clause.embedded ? "Searchable by meaning and keywords" : "Keyword search only until backfill_embeddings.py runs"}
        >
          {clause.embedded ? "Embedded" : "Embedding pending"}
        </span>
      </header>
      <div className="mt-3">
        <ClauseMarkdown source={clauseBody(clause)} />
      </div>
    </article>
  )
}

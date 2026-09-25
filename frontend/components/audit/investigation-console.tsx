"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  Clock01Icon,
  PackageRemoveIcon,
  Search01Icon,
  TemperatureIcon,
} from "@hugeicons/core-free-icons"

import { ClauseCard, ClauseCardSkeleton } from "@/components/audit/clause-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { QUICK_PROMPTS } from "@/lib/mock-data"
import { data, surface } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { BreachKind, ContractClause, RetrievalResult } from "@/lib/types"

const PROMPT_ICONS: Record<BreachKind, typeof Clock01Icon> = {
  DELAY: Clock01Icon,
  COLD_CHAIN: TemperatureIcon,
  DAMAGE: PackageRemoveIcon,
}

interface InvestigationConsoleProps {
  query: string
  onQueryChange: (q: string) => void
  onSubmit: (q: string) => void
  loading: boolean
  result: RetrievalResult | null
  citedClauseId: ContractClause["id"] | null
  onCite: (id: ContractClause["id"]) => void
}

export function InvestigationConsole({
  query,
  onQueryChange,
  onSubmit,
  loading,
  result,
  citedClauseId,
  onCite,
}: InvestigationConsoleProps) {
  const clauses = result?.response.clauses ?? []

  return (
    <section className={cn(surface, "flex min-h-0 min-w-0 flex-1 flex-col")}>
      <div className="shrink-0 px-6 pt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-medium tracking-tight text-ink">Contract evidence</h2>
          {result && !loading && (
            <span className={cn(data, "text-xs text-ink-3")}>
              {result.response.matched_clauses_count} matches · {result.latencyMs} ms ·{" "}
              {result.source === "live" ? (
                <span className="text-ok">live retrieval</span>
              ) : (
                <span className="text-warn" title={result.error}>
                  demo clauses (API offline)
                </span>
              )}
            </span>
          )}
        </div>

        <form
          className="mt-4 flex h-12 items-center gap-3 rounded-full bg-surface-2 pr-1.5 pl-5 ring-active/35 focus-within:bg-surface focus-within:ring-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (query.trim()) onSubmit(query.trim())
          }}
        >
          <HugeiconsIcon icon={Search01Icon} size={18} className="shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Ask about the contract for this case..."
            aria-label="Investigation query"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            aria-label="Retrieve clauses"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-surface transition-opacity hover:bg-ink/85 disabled:opacity-40"
          >
            <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(QUICK_PROMPTS) as BreachKind[]).map((kind) => {
            const active = query === QUICK_PROMPTS[kind]
            return (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  onQueryChange(QUICK_PROMPTS[kind])
                  onSubmit(QUICK_PROMPTS[kind])
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                  active ? "bg-brand-soft text-brand-ink ring-1 ring-brand/30" : "text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink-3/50"
                )}
              >
                <HugeiconsIcon icon={PROMPT_ICONS[kind]} size={13} />
                {QUICK_PROMPTS[kind]}
              </button>
            )
          })}
        </div>
      </div>

      <ScrollArea className="mt-5 min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-6 pb-6">
          {loading ? (
            <>
              <ClauseCardSkeleton />
              <ClauseCardSkeleton />
              <ClauseCardSkeleton />
            </>
          ) : clauses.length > 0 ? (
            clauses.map((c) => (
              <ClauseCard key={c.id} clause={c} cited={c.id === citedClauseId} onCite={() => onCite(c.id)} />
            ))
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">
              {result ? "No clauses matched this query for the selected vendor." : "Ask a question to pull contract evidence."}
            </p>
          )}
        </div>
      </ScrollArea>
    </section>
  )
}

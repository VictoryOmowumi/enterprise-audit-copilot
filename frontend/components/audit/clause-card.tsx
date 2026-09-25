"use client"

import { Fragment } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Skeleton } from "@/components/ui/skeleton"
import { data } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { ContractClause } from "@/lib/types"

const TYPE_STYLES: Record<string, { label: string; className: string }> = {
  SLA_PENALTY: { label: "SLA penalty", className: "bg-brand-soft text-brand-ink" },
  TEMPERATURE_CONTROL: { label: "Temperature control", className: "bg-info-soft text-info" },
  DAMAGE_LIABILITY: { label: "Damage liability", className: "bg-danger-soft text-danger" },
  DELIVERY_TIMELINE: { label: "Delivery timeline", className: "bg-track text-ink-2" },
}

/** Pill label and colors for a clause type; unknown types get a readable label ("HAZMAT_COMPLIANCE" → "Hazmat compliance"). */
export function clauseTypeStyle(type: string): { label: string; className: string } {
  if (TYPE_STYLES[type]) return TYPE_STYLES[type]
  const words = type.toLowerCase().replace(/_/g, " ")
  return { label: words.charAt(0).toUpperCase() + words.slice(1), className: "bg-track text-ink-2" }
}

interface ClauseCardProps {
  clause: ContractClause
  cited: boolean
  onCite: () => void
}

export function ClauseCard({ clause, cited, onCite }: ClauseCardProps) {
  const type = clauseTypeStyle(clause.clause_type)

  return (
    <article
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        cited ? "border-active/30 bg-active-soft" : "border-line bg-surface-2"
      )}
    >
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">{clause.section_title}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", type.className)}>{type.label}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-3">{clause.document_name}</p>
        </div>
        <Relevance score={clause.vector_score} fts={clause.fts_score} />
        <button
          type="button"
          onClick={onCite}
          aria-pressed={cited}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
            cited ? "bg-active text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:ring-ink-3/50"
          )}
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
          {cited ? "Cited" : "Cite"}
        </button>
      </header>
      <div className="mt-4">
        <ClauseMarkdown source={clauseBody(clause)} />
      </div>
    </article>
  )
}

function Relevance({ score, fts }: { score: number; fts: number }) {
  return (
    <div className="flex w-24 shrink-0 flex-col gap-1.5" title={`vector ${score.toFixed(4)} · fts ${fts.toFixed(4)}`}>
      <div className="flex items-baseline justify-between text-[11px] text-ink-3">
        Match
        <span className={cn(data, "text-xs font-medium text-ink")}>{score.toFixed(4)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(score, 1) * 100}%` }} />
      </div>
    </div>
  )
}

export function ClauseCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-5">
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-64 bg-track" />
          <Skeleton className="h-3 w-40 bg-track/70" />
        </div>
        <Skeleton className="h-6 w-24 bg-track" />
        <Skeleton className="h-8 w-16 rounded-full bg-track" />
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        <Skeleton className="h-3 w-full bg-track/70" />
        <Skeleton className="h-3 w-[90%] bg-track/70" />
        <Skeleton className="h-3 w-[65%] bg-track/70" />
      </div>
    </div>
  )
}

/**
 * Minimal renderer for the clause subset of Markdown (paragraphs, "- " lists,
 * "#" headings, **bold**). Renders React nodes — no raw HTML injection.
 */
export function ClauseMarkdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n\s*\n/)
  return (
    <div className="flex flex-col gap-3 font-data text-sm leading-relaxed text-ink-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
        if (lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="flex flex-col gap-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand/60" />
                  <span>{renderInline(l.replace(/^[-*]\s+/, ""))}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (/^#{1,6}\s/.test(lines[0])) {
          return (
            <p key={i} className="font-medium text-ink">
              {renderInline(lines.join(" ").replace(/^#{1,6}\s+/, ""))}
            </p>
          )
        }
        return <p key={i}>{renderInline(lines.join(" "))}</p>
      })}
    </div>
  )
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  )
}

/** Plain-text form of a clause, for citation in the notice letter. */
export function clausePlainText(source: string): string {
  return source
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim()
}

/** Clause content without a leading line that repeats the section title (ingested chunks include it). */
export function clauseBody(clause: Pick<ContractClause, "content" | "section_title">): string {
  const [first, ...rest] = clause.content.trimStart().split("\n")
  const heading = first.replace(/^#{1,6}\s+/, "").trim()
  return heading === clause.section_title.trim() ? rest.join("\n").trim() : clause.content
}

"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { LegalDocument01Icon } from "@hugeicons/core-free-icons"

import { BreachNoticeDialog } from "@/components/audit/breach-notice-dialog"
import { computeLiability, formatUSD } from "@/lib/audit"
import { assessPenalty, type PenaltyRule } from "@/lib/penalty"
import { data, surface } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { ContractClause, Shipment, Vendor } from "@/lib/types"

interface ReconciliationPanelProps {
  shipment: Shipment | null
  vendor: Vendor
  clause: ContractClause | null
}

export function ReconciliationPanel({ shipment, vendor, clause }: ReconciliationPanelProps) {
  return (
    <aside className={cn(surface, "flex min-h-0 w-85 shrink-0 flex-col p-6")}>
      <h2 className="font-heading text-lg font-medium tracking-tight text-ink">Reconciliation</h2>
      {shipment ? (
        // Keyed so a manual rate override resets when the shipment or citation changes.
        <Ledger key={`${shipment.id}:${clause?.id ?? "none"}`} shipment={shipment} vendor={vendor} clause={clause} />
      ) : (
        <p className="py-16 text-center text-sm text-ink-3">Select a shipment to reconcile.</p>
      )}
    </aside>
  )
}

const RULE_LABEL: Record<PenaltyRule, string> = {
  DELAY_TIER: "Delay tier",
  TEMP_EXCURSION: "Temperature excursion",
  DAMAGE_AT_COST: "Damage at cost",
  FLAT: "Flat rate",
  NONE: "No rate found",
}

function Ledger({ shipment: s, vendor, clause }: { shipment: Shipment; vendor: Vendor; clause: ContractClause | null }) {
  const breached = s.status === "BREACH"
  const assessment = assessPenalty(s, clause)
  const [override, setOverride] = useState<number | null>(null)

  const rate = breached ? (override ?? assessment.ratePct) : 0
  const liability = !breached ? 0 : override !== null ? computeLiability(s.consignmentValue, override) : assessment.liability
  const basis = !breached
    ? "No breach recorded, so nothing has accrued."
    : override !== null
      ? `Manual override of ${override}%. The clause gives ${assessment.ratePct}%.`
      : assessment.basis
  const [whole, cents] = formatUSD(liability).split(".")

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mt-5">
        <p className="text-xs text-ink-3">Accrued liability</p>
        <p className={cn(data, "mt-1 text-4xl font-light tracking-tight", liability > 0 ? "text-ink" : "text-ink-3")}>
          {whole}
          <span className="text-xl text-ink-3">.{cents}</span>
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-surface-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-ink-3">
            <HugeiconsIcon icon={LegalDocument01Icon} size={14} />
            How it was calculated
          </span>
          {breached && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                override !== null
                  ? "bg-warn-soft text-warn"
                  : assessment.rule === "NONE"
                    ? "bg-track text-ink-2"
                    : "bg-active-soft text-active-ink"
              )}
            >
              {override !== null ? "Manual" : RULE_LABEL[assessment.rule]}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-snug text-ink">{basis}</p>
        <p className="mt-2 truncate text-xs text-ink-3">
          {clause ? `${clause.section_title} · ${clause.document_name}` : "No clause cited"}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 text-sm">
        <Line label="Consignment value" value={formatUSD(s.consignmentValue)} />
        <div className="flex items-center justify-between">
          <label htmlFor="penalty-rate" className="text-ink-2">
            Penalty rate
          </label>
          <div className="flex h-8 items-center rounded-full bg-surface-2 px-3 ring-active/35 focus-within:bg-surface focus-within:ring-2">
            <input
              id="penalty-rate"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={rate}
              disabled={!breached}
              onChange={(e) => setOverride(clampPct(e.target.valueAsNumber))}
              className={cn(
                data,
                "w-14 bg-transparent text-right text-ink outline-none disabled:text-ink-3 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              )}
            />
            <span className="pl-0.5 text-ink-3">%</span>
          </div>
        </div>
        {override !== null && (
          <button type="button" onClick={() => setOverride(null)} className="self-end text-xs text-active hover:underline">
            Reset to clause rate ({assessment.ratePct}%)
          </button>
        )}
        <div className="h-px bg-line" />
        <p className={cn(data, "text-xs text-ink-3")}>
          {formatUSD(s.consignmentValue)} × {rate}% = {formatUSD(liability)}
        </p>
      </div>

      <div className="mt-auto pt-6">
        <BreachNoticeDialog
          shipment={s}
          vendor={vendor}
          clause={clause}
          penaltyRatePct={rate}
          liability={liability}
          basis={basis}
          disabled={!breached}
        />
      </div>
    </div>
  )
}

function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-2">{label}</span>
      <span className={cn(data, "text-ink")}>{value}</span>
    </div>
  )
}

import type { DamageReport, Shipment } from "@/lib/types"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

export function formatUSD(value: number): string {
  return usd.format(value)
}

/** 3130 -> "52h 10m" */
export function formatDuration(minutes: number): string {
  const m = Math.abs(Math.round(minutes))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + "Z"
}

/** "14/220 cartons", "14 cartons", or "Damage reported" depending on what the record states. */
export function damageLabel(d: DamageReport): string {
  if (d.cartonsDamaged === null) return "Damage reported"
  return d.cartonsTotal === null ? `${d.cartonsDamaged} cartons` : `${d.cartonsDamaged}/${d.cartonsTotal} cartons`
}

/** Positive when the shipment exceeded its SLA threshold. */
export function transitVarianceMinutes(s: Shipment): number {
  return s.transitMinutes - s.slaLimitHours * 60
}

export function computeLiability(consignmentValue: number, penaltyRatePct: number): number {
  return Math.round(consignmentValue * penaltyRatePct) / 100
}

/**
 * Portfolio KPIs. `liabilityOf` returns null while a shipment's governing
 * clause is still loading, in which case exposure is null too.
 */
export function summarize(shipments: Shipment[], liabilityOf: (s: Shipment) => number | null) {
  const breached = shipments.filter((s) => s.status === "BREACH")
  let exposure: number | null = 0
  for (const s of breached) {
    const l = liabilityOf(s)
    if (l === null) {
      exposure = null
      break
    }
    exposure += l
  }
  return { total: shipments.length, breached: breached.length, exposure }
}

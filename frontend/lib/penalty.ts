import { formatDuration, transitVarianceMinutes } from "@/lib/audit"
import type { BreachKind, ClauseType, ContractClause, Shipment } from "@/lib/types"

export type PenaltyRule = "DELAY_TIER" | "TEMP_EXCURSION" | "DAMAGE_AT_COST" | "FLAT" | "NONE"

export interface PenaltyAssessment {
  /** Percentage of consignment value owed. 0 when the clause does not apply. */
  ratePct: number
  liability: number
  rule: PenaltyRule
  /** Plain-language reason, shown beside the figure and usable in the notice. */
  basis: string
}

/** Clause type that governs each breach kind. */
export const CLAUSE_TYPE_FOR: Record<BreachKind, ClauseType> = {
  DELAY: "SLA_PENALTY",
  COLD_CHAIN: "TEMPERATURE_CONTROL",
  DAMAGE: "DAMAGE_LIABILITY",
}

const NUM = String.raw`(\d+(?:\.\d+)?)`

/**
 * Reads the penalty terms written in a contract clause and applies them to a
 * shipment's telemetry. Rules are tried from most to least specific; a clause
 * that states no computable rate yields rule "NONE" and a zero rate.
 */
export function assessPenalty(shipment: Shipment, clause: ContractClause | null): PenaltyAssessment {
  if (!clause) return none(shipment, "No clause cited. Cite a clause to compute the rate.")

  const text = clause.content.replace(/\*\*/g, "").replace(/\s+/g, " ")

  return (
    delayTier(shipment, text) ??
    tempExcursion(shipment, text) ??
    damageAtCost(shipment, text) ??
    flatRate(shipment, text) ??
    none(shipment, "The cited clause states no penalty rate. Enter one manually.")
  )
}

function result(s: Shipment, rule: PenaltyRule, ratePct: number, basis: string): PenaltyAssessment {
  // Liability uses the exact rate (at-cost shares are fractional); the rate is rounded for display only.
  const liability = Math.round(s.consignmentValue * ratePct) / 100
  return { rule, ratePct: Math.round(ratePct * 100) / 100, liability, basis }
}

function none(s: Shipment, basis: string): PenaltyAssessment {
  return result(s, "NONE", 0, basis)
}

/** "Delays between 12 and 24 hours incur … 5%" / "Delays exceeding 24 hours incur … 15%" */
function delayTier(s: Shipment, text: string): PenaltyAssessment | null {
  const tiers: { from: number; to: number; pct: number }[] = []
  for (const sentence of text.split(/(?<=[.;])\s+|\s-\s/)) {
    const pct = sentence.match(new RegExp(`${NUM}\\s*%`))
    if (!pct) continue
    const between = sentence.match(new RegExp(`between ${NUM} and ${NUM} hours`, "i"))
    const over = sentence.match(new RegExp(`(?:exceeding|more than|over|beyond|in excess of) ${NUM} hours`, "i"))
    if (between) tiers.push({ from: +between[1], to: +between[2], pct: +pct[1] })
    else if (over) tiers.push({ from: +over[1], to: Infinity, pct: +pct[1] })
  }
  if (tiers.length === 0) return null

  const variance = transitVarianceMinutes(s)
  if (variance <= 0) return result(s, "DELAY_TIER", 0, "Delivered within the SLA threshold, so no delay penalty applies.")

  const hours = variance / 60
  const tier = tiers
    .filter((t) => hours > t.from && hours <= t.to)
    .sort((a, b) => b.pct - a.pct)[0]
  const late = formatDuration(variance)
  if (!tier) {
    const first = Math.min(...tiers.map((t) => t.from))
    return result(s, "DELAY_TIER", 0, `${late} late is below the ${first}h penalty tier.`)
  }
  const range = tier.to === Infinity ? `over ${tier.from}h` : `${tier.from}–${tier.to}h`
  return result(s, "DELAY_TIER", tier.pct, `${late} late falls in the ${range} tier (${tier.pct}%).`)
}

/** "Any excursion exceeding 10°C for longer than 30 continuous minutes … 100%" */
function tempExcursion(s: Shipment, text: string): PenaltyAssessment | null {
  const cond = text.match(
    new RegExp(`exceed(?:ing|s)? ${NUM}\\s*°\\s*C for (?:longer|more) than ${NUM} (?:continuous )?minutes`, "i")
  )
  const pct = text.match(new RegExp(`${NUM}\\s*% of (?:the )?(?:consignment|shipment|batch)`, "i"))
  if (!cond || !pct) return null

  const [limitC, limitMin] = [+cond[1], +cond[2]]
  const cc = s.coldChain
  if (!cc) return result(s, "TEMP_EXCURSION", 0, "Shipment has no cold chain telemetry.")
  if (cc.maxTempC > limitC && cc.excursionMinutes > limitMin) {
    return result(
      s,
      "TEMP_EXCURSION",
      +pct[1],
      `Peak ${cc.maxTempC.toFixed(1)}°C for ${cc.excursionMinutes} min exceeds ${limitC}°C for over ${limitMin} min (${pct[1]}%).`
    )
  }
  return result(
    s,
    "TEMP_EXCURSION",
    0,
    `Peak ${cc.maxTempC.toFixed(1)}°C for ${cc.excursionMinutes} min is within the ${limitC}°C / ${limitMin} min limit.`
  )
}

/** "… exceeding 2% of unit count … Reimbursement will be processed at cost value" */
function damageAtCost(s: Shipment, text: string): PenaltyAssessment | null {
  if (!/\bat cost\b/i.test(text)) return null

  const threshold = text.match(new RegExp(`exceeding ${NUM}\\s*% of (?:the )?unit count`, "i"))
  const dmg = s.damage
  if (!dmg) return result(s, "DAMAGE_AT_COST", 0, "No damage recorded on this shipment.")
  if (dmg.cartonsDamaged === null || dmg.cartonsTotal === null) {
    const counted = dmg.cartonsDamaged === null ? "Damage is reported" : `${dmg.cartonsDamaged} cartons are damaged`
    return result(
      s,
      "DAMAGE_AT_COST",
      0,
      `${counted}, but the record has no total unit count to price the cost share. Enter the rate manually.`
    )
  }

  const share = (dmg.cartonsDamaged / dmg.cartonsTotal) * 100
  const ratio = `${dmg.cartonsDamaged}/${dmg.cartonsTotal}`
  if (threshold && share <= +threshold[1]) {
    return result(s, "DAMAGE_AT_COST", 0, `${ratio} damaged (${share.toFixed(2)}%) is within the ${threshold[1]}% tolerance.`)
  }
  return result(
    s,
    "DAMAGE_AT_COST",
    share,
    `Cost value of ${ratio} damaged cartons (${share.toFixed(2)}%)${threshold ? `, above the ${threshold[1]}% tolerance` : ""}.`
  )
}

/** "… a penalty equal to 5% of the declared consignment value" */
function flatRate(s: Shipment, text: string): PenaltyAssessment | null {
  const pct = text.match(
    new RegExp(`${NUM}\\s*% of (?:the )?(?:total )?(?:declared )?(?:consignment|shipment)(?:'s)?(?: declared)? value`, "i")
  )
  if (!pct) return null
  return result(s, "FLAT", +pct[1], `Flat ${pct[1]}% of declared value per the cited clause.`)
}

const STATES_TERMS = /\d\s*%|\bat cost\b/i

/**
 * The clause governing a breach kind: among results of the matching type, the
 * first that states penalty terms, else the first of that type, else the top result.
 */
export function governingClause(kind: BreachKind, clauses: ContractClause[]): ContractClause | null {
  const ofType = clauses.filter((c) => c.clause_type === CLAUSE_TYPE_FOR[kind])
  return ofType.find((c) => STATES_TERMS.test(c.content)) ?? ofType[0] ?? clauses[0] ?? null
}

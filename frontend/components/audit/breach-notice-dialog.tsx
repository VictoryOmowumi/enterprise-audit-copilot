"use client"

import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Legal01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { clauseBody, clausePlainText } from "@/components/audit/clause-card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDuration, formatUSD, transitVarianceMinutes } from "@/lib/audit"
import type { ContractClause, Shipment, Vendor } from "@/lib/types"

interface BreachNoticeDialogProps {
  shipment: Shipment
  vendor: Vendor
  clause: ContractClause | null
  penaltyRatePct: number
  liability: number
  /** Plain-language reason for the rate, from the penalty assessment. */
  basis: string
  disabled?: boolean
}

export function BreachNoticeDialog(props: BreachNoticeDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={props.disabled}
        render={
          <Button className="h-12 w-full rounded-full bg-ink text-sm font-medium text-surface hover:bg-ink/85 disabled:bg-track disabled:text-ink-3" />
        }
      >
        <HugeiconsIcon icon={Legal01Icon} size={16} data-icon="inline-start" />
        Generate Formal SLA Breach Notice
      </DialogTrigger>
      <NoticeContent {...props} />
    </Dialog>
  )
}

function NoticeContent({ shipment, vendor, clause, penaltyRatePct, liability, basis }: BreachNoticeDialogProps) {
  const [copied, setCopied] = useState(false)
  const letter = useMemo(
    () => draftNotice({ shipment, vendor, clause, penaltyRatePct, liability, basis, issuedAt: new Date() }),
    [shipment, vendor, clause, penaltyRatePct, liability, basis]
  )

  async function copy() {
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <DialogContent className="gap-5 rounded-3xl bg-surface p-7 sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-medium tracking-tight text-ink">
          Breach notice · {shipment.id}
        </DialogTitle>
        <DialogDescription className="text-sm text-ink-3">
          Pre-drafted from telemetry and the cited contract provision. Review before sending to {vendor.name}.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="h-[55vh] rounded-2xl bg-surface-2">
        <pre className="p-6 font-data text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{letter}</pre>
      </ScrollArea>
      <DialogFooter>
        <Button
          onClick={copy}
          className="h-10 rounded-full bg-ink px-5 text-sm text-surface hover:bg-ink/85"
        >
          <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={14} data-icon="inline-start" />
          {copied ? "Copied" : "Copy to Clipboard"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function draftNotice({
  shipment: s,
  vendor,
  clause,
  penaltyRatePct,
  liability,
  basis,
  issuedAt,
}: BreachNoticeDialogProps & { issuedAt: Date }): string {
  const date = issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const ref = `AUD-${s.id}-${issuedAt.toISOString().slice(0, 10).replaceAll("-", "")}`
  const section = clause?.section_title ?? "the applicable service level provisions"
  const document = clause?.document_name ?? "the Master Services Agreement"
  const variance = transitVarianceMinutes(s)
  const demand =
    liability > 0
      ? `Pursuant to ${section}, we request that the accrued liability of ${formatUSD(liability)} be credited against your next scheduled invoice.`
      : `No monetary penalty accrues under ${section} for this breach. This notice is issued to place the breach on record.`

  const findings: string[] = []
  findings.push(
    variance > 0
      ? `Transit time recorded at ${formatDuration(s.transitMinutes)} against a contracted threshold of ${s.slaLimitHours}h (variance +${formatDuration(variance)}).`
      : `Transit time recorded at ${formatDuration(s.transitMinutes)}, within the contracted threshold of ${s.slaLimitHours}h.`
  )
  if (s.coldChain && s.coldChain.excursionMinutes > 0) {
    findings.push(
      `Cold chain excursion: maximum temperature of ${s.coldChain.maxTempC.toFixed(1)}°C sustained for ${s.coldChain.excursionMinutes} minutes, exceeding the ${s.coldChain.thresholdC.toFixed(1)}°C limit.`
    )
  }
  if (s.damage) {
    findings.push(
      [
        s.damage.cartonsDamaged === null
          ? "Goods received damaged"
          : s.damage.cartonsTotal === null
            ? `${s.damage.cartonsDamaged} cartons received damaged`
            : `${s.damage.cartonsDamaged} of ${s.damage.cartonsTotal} cartons received damaged`,
        s.damage.podPhotos ? `, annotated on POD and supported by ${s.damage.podPhotos} timestamped photographs.` : ", as recorded on the Proof of Delivery.",
      ].join("")
    )
  }
  if (s.notes) findings.push(`Operational record: "${s.notes}"`)

  const cited = clause
    ? clausePlainText(clauseBody(clause))
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n")
    : "    [No clause cited — select a retrieved clause before issuing.]"

  return `FORMAL NOTICE OF SERVICE LEVEL BREACH

Ref:   ${ref}
Date:  ${date}

To:    ${vendor.name} (${vendor.code})
Attn:  Contract & Claims Management

Re:    Shipment ${s.id} — ${s.origin} → ${s.destination}
       Dispatched ${s.dispatchedAt.replace("T", " ").replace(":00Z", " UTC")}

Dear Sir or Madam,

We write to give formal notice that the above shipment failed to meet the service levels agreed under ${document}, specifically ${section}.

FINDINGS
${findings.map((f) => `  • ${f}`).join("\n")}

CITED PROVISION — ${section}
${cited}

FINANCIAL RECONCILIATION
  Declared consignment value:   ${formatUSD(s.consignmentValue)}
  Applicable penalty rate:      ${penaltyRatePct.toFixed(2)}%
  Accrued liability:            ${formatUSD(liability)}
  Basis:                        ${basis}

${demand} Please acknowledge receipt of this notice within five (5) business days. Any contest of these findings must be accompanied by complete, unbroken telemetry for the shipment in question.

This notice is issued without prejudice to any further rights or remedies available under the agreement.

Yours faithfully,

SLA Audit & Reconciliation
Enterprise Audit Copilot
`
}

"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowRight02Icon, Building03Icon } from "@hugeicons/core-free-icons"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatUSD } from "@/lib/audit"
import { data, surface } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { Shipment, ShipmentStatus, Vendor } from "@/lib/types"

export type PipelineStatus = "ready" | "degraded"

interface CommandHeaderProps {
  shipment: Shipment | null
  loading: boolean
  vendors: Vendor[]
  vendorCode: string
  onVendorChange: (code: string) => void
  kpis: { total: number; breached: number; exposure: number | null }
  pipelineStatus: PipelineStatus
}

const STATUS_PILL: Record<ShipmentStatus, { label: string; className: string }> = {
  BREACH: { label: "SLA breach", className: "bg-active-soft text-active-ink" },
  AT_RISK: { label: "At risk", className: "bg-warn-soft text-warn" },
  COMPLIANT: { label: "On time", className: "bg-ok-soft text-ok" },
}

const updatedFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
})

export function CommandHeader({
  shipment,
  loading,
  vendors,
  vendorCode,
  onVendorChange,
  kpis,
  pipelineStatus,
}: CommandHeaderProps) {
  const vendor = vendors.find((v) => v.code === vendorCode) ?? vendors[0]
  const ready = pipelineStatus === "ready"

  return (
    <header className="flex shrink-0 items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl font-medium tracking-tight text-ink">
            {shipment?.id ?? (loading ? "Loading shipments…" : "No shipment selected")}
          </h1>
          {shipment && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_PILL[shipment.status].className)}>
              {STATUS_PILL[shipment.status].label}
            </span>
          )}
        </div>
        {shipment && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
            {shipment.origin}
            <HugeiconsIcon icon={ArrowRight02Icon} size={13} />
            {shipment.destination}
            <span className="mx-1">·</span>
            Dispatched <span className={data}>{updatedFmt.format(new Date(shipment.dispatchedAt))} UTC</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className={cn(surface, "flex h-10 items-center gap-4 rounded-full px-4 text-xs text-ink-2")}>
          <span className="flex items-center gap-2" title="Supabase pgvector retrieval status">
            <span className="relative flex size-2">
              <span
                className={cn(
                  "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                  ready ? "bg-ok" : "bg-warn"
                )}
              />
              <span className={cn("relative inline-flex size-2 rounded-full", ready ? "bg-ok" : "bg-warn")} />
            </span>
            {ready ? "pgvector ready" : "Demo mode"}
          </span>
          <span className="h-4 w-px bg-track" />
          <Kpi label="Audited" value={String(kpis.total)} />
          <Kpi label="Breached" value={String(kpis.breached)} accent={kpis.breached > 0} />
          <Kpi label="Exposure" value={kpis.exposure === null ? "pricing…" : formatUSD(kpis.exposure)} />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              surface,
              "flex h-10 items-center gap-2 rounded-full pr-3 pl-1.5 text-xs text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-active/50"
            )}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-brand">
              <HugeiconsIcon icon={Building03Icon} size={15} />
            </span>
            <span className="max-w-44 truncate font-medium">{vendor.name}</span>
            <HugeiconsIcon icon={ArrowDown01Icon} size={15} className="text-ink-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-72 bg-surface">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Contracted carrier</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={vendorCode} onValueChange={(v) => onVendorChange(String(v))}>
                {vendors.map((v) => (
                  <DropdownMenuRadioItem key={v.code} value={v.code}>
                    <HugeiconsIcon icon={Building03Icon} size={15} className="text-ink-3" />
                    <span className="flex flex-col">
                      <span className="text-ink">{v.name}</span>
                      <span className={cn(data, "text-[11px] text-ink-3")}>{v.code}</span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      {label}
      <span className={cn(data, "text-sm font-medium", accent ? "text-danger" : "text-ink")}>{value}</span>
    </span>
  )
}

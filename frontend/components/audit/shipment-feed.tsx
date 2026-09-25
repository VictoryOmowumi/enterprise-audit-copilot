"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Clock01Icon,
  PackageRemoveIcon,
  Search01Icon,
  TemperatureIcon,
} from "@hugeicons/core-free-icons"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { damageLabel, formatDuration, transitVarianceMinutes } from "@/lib/audit"
import { data, surface } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { Shipment, ShipmentStatus } from "@/lib/types"

type Filter = "ALL" | ShipmentStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "BREACH", label: "Breach" },
  { value: "AT_RISK", label: "At risk" },
  { value: "COMPLIANT", label: "On time" },
]

interface ShipmentFeedProps {
  shipments: Shipment[]
  loading: boolean
  selectedId: string | null
  onSelect: (shipment: Shipment) => void
}

export function ShipmentFeed({ shipments, loading, selectedId, onSelect }: ShipmentFeedProps) {
  const [filter, setFilter] = useState<Filter>("ALL")
  const [search, setSearch] = useState("")

  const needle = search.trim().toLowerCase()
  const visible = shipments.filter(
    (s) =>
      (filter === "ALL" || s.status === filter) &&
      (!needle || `${s.id} ${s.origin} ${s.destination}`.toLowerCase().includes(needle))
  )

  return (
    <section className="flex min-h-0 w-[35%] max-w-100 min-w-80 shrink-0 flex-col gap-3">
      <label className={cn(surface, "flex h-11 shrink-0 items-center gap-2.5 rounded-full px-4")}>
        <HugeiconsIcon icon={Search01Icon} size={17} className="text-ink-3" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shipment or lane..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
      </label>

      <div className="flex shrink-0 items-center gap-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              filter === f.value ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface hover:text-ink"
            )}
          >
            {f.label}
          </button>
        ))}
        <span className={cn(data, "ml-auto text-xs text-ink-3")}>{visible.length} shipments</span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-1 pr-3.5 pb-3">
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <ShipmentCardSkeleton key={i} />)
          ) : visible.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-3">No shipments match.</p>
          ) : (
            visible.map((s) => (
              <ShipmentCard key={s.id} shipment={s} selected={s.id === selectedId} onSelect={() => onSelect(s)} />
            ))
          )}
        </div>
      </ScrollArea>
    </section>
  )
}

const STATUS: Record<ShipmentStatus, { label: string; pill: string; track: string }> = {
  BREACH: { label: "Breach", pill: "bg-danger-soft text-danger", track: "bg-brand" },
  AT_RISK: { label: "At risk", pill: "bg-warn-soft text-warn", track: "bg-warn" },
  COMPLIANT: { label: "On time", pill: "bg-ok-soft text-ok", track: "bg-track" },
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })

function ShipmentCard({
  shipment: s,
  selected,
  onSelect,
}: {
  shipment: Shipment
  selected: boolean
  onSelect: () => void
}) {
  const variance = transitVarianceMinutes(s)
  const late = variance > 0
  const usage = Math.min(s.transitMinutes / (s.slaLimitHours * 60), 1)
  const status = STATUS[s.status]
  const dispatched = new Date(s.dispatchedAt)
  const arrived = new Date(dispatched.getTime() + s.transitMinutes * 60_000)
  const excursion = s.coldChain && s.coldChain.excursionMinutes > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-2xl p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-active/50",
        selected
          ? cn(surface, "ring-1 ring-active/40")
          : "bg-surface/55 hover:bg-surface/90"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tracking-tight text-ink">{s.id}</span>
          <span className="text-xs text-ink-3">{s.slaLimitHours}h contract threshold</span>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", status.pill)}>{status.label}</span>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm font-semibold text-ink">
        <span className="truncate">{s.origin}</span>
        <span className="truncate text-right">{s.destination}</span>
      </div>

      <div className="relative mt-2.5 flex h-2 items-center">
        <div className="absolute inset-x-0 h-px bg-track" />
        <span className={cn("relative size-1.5 rounded-full", selected ? "bg-active" : status.track)} />
        <div
          className={cn("relative h-0.5", selected ? "bg-active/80" : status.track)}
          style={{ width: `calc(${usage * 100}% - 18px)` }}
        />
        <span className={cn("relative h-2 w-4 rounded-full", selected ? "bg-active" : status.track, "brightness-95")} />
        <span className="absolute right-0 size-1.5 rounded-full bg-track" />
      </div>

      <div className={cn(data, "mt-1.5 flex justify-between text-[11px] text-ink-3")}>
        <span>{dateFmt.format(dispatched)}</span>
        <span>{dateFmt.format(arrived)}</span>
      </div>

      <div className={cn(data, "mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2")}>
        <span className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Clock01Icon} size={14} className="text-ink-3" />
          {formatDuration(s.transitMinutes)}
        </span>
        <span className={cn("flex items-center gap-1.5", late ? "text-danger" : "text-ink-2")}>
          <HugeiconsIcon icon={Alert02Icon} size={14} className={late ? "text-danger" : "text-ink-3"} />
          {late ? `+${formatDuration(variance)} late` : `${formatDuration(variance)} spare`}
        </span>
        {s.coldChain && (
          <span className={cn("flex items-center gap-1.5", excursion ? "text-danger" : "text-ink-2")}>
            <HugeiconsIcon icon={TemperatureIcon} size={14} className={excursion ? "text-danger" : "text-ink-3"} />
            {excursion
              ? `${s.coldChain.maxTempC.toFixed(1)}°C · ${s.coldChain.excursionMinutes} min`
              : `${s.coldChain.maxTempC.toFixed(1)}°C max`}
          </span>
        )}
        {s.damage && (
          <span className="flex items-center gap-1.5 text-danger">
            <HugeiconsIcon icon={PackageRemoveIcon} size={14} className="text-danger" />
            {damageLabel(s.damage)} damaged
          </span>
        )}
      </div>
    </button>
  )
}

function ShipmentCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface/55 p-4">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-28 bg-track" />
        <Skeleton className="h-4 w-14 rounded-full bg-track" />
      </div>
      <Skeleton className="mt-2 h-3 w-24 bg-track/70" />
      <div className="mt-5 flex justify-between">
        <Skeleton className="h-4 w-24 bg-track" />
        <Skeleton className="h-4 w-20 bg-track" />
      </div>
      <Skeleton className="mt-3 h-1 w-full bg-track/70" />
      <Skeleton className="mt-4 h-3 w-40 bg-track/70" />
    </div>
  )
}

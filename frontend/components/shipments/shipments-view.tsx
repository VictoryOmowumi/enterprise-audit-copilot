"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowRight02Icon, ArrowUp01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { Skeleton } from "@/components/ui/skeleton"
import { fetchShipments, type ShipmentsResult } from "@/lib/api"
import { formatDuration, formatUSD, transitVarianceMinutes } from "@/lib/audit"
import { DEFAULT_VENDOR_CODE, VENDORS } from "@/lib/mock-data"
import { data, surface } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { Shipment, ShipmentStatus } from "@/lib/types"

type Filter = "ALL" | ShipmentStatus
type SortKey = "dispatched" | "variance" | "value"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "BREACH", label: "Breach" },
  { value: "AT_RISK", label: "At risk" },
  { value: "COMPLIANT", label: "On time" },
]

const STATUS: Record<ShipmentStatus, { label: string; className: string }> = {
  BREACH: { label: "Breach", className: "bg-danger-soft text-danger" },
  AT_RISK: { label: "At risk", className: "bg-warn-soft text-warn" },
  COMPLIANT: { label: "On time", className: "bg-ok-soft text-ok" },
}

const SORT_VALUE: Record<SortKey, (s: Shipment) => number> = {
  dispatched: (s) => Date.parse(s.dispatchedAt),
  variance: transitVarianceMinutes,
  value: (s) => s.consignmentValue,
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

export function ShipmentsView() {
  const vendor = VENDORS.find((v) => v.code === DEFAULT_VENDOR_CODE) ?? VENDORS[0]
  const router = useRouter()

  const [result, setResult] = useState<ShipmentsResult | null>(null)
  const [filter, setFilter] = useState<Filter>("ALL")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "dispatched", desc: true })

  useEffect(() => {
    const controller = new AbortController()
    fetchShipments(vendor.code, controller.signal)
      .then(setResult)
      .catch(() => {})
    return () => controller.abort()
  }, [vendor.code])

  const all = useMemo(() => result?.shipments ?? [], [result])
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const pick = SORT_VALUE[sort.key]
    return all
      .filter((s) => filter === "ALL" || s.status === filter)
      .filter((s) => !needle || `${s.id} ${s.origin} ${s.destination} ${s.notes ?? ""}`.toLowerCase().includes(needle))
      .sort((a, b) => (sort.desc ? pick(b) - pick(a) : pick(a) - pick(b)))
  }, [all, filter, search, sort])

  const open = (s: Shipment) => router.push(`/?shipment=${encodeURIComponent(s.id)}`)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 pt-1">
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-ink">Shipments</h1>
          <p className="mt-1 text-sm text-ink-3">
            {vendor.name} ·{" "}
            {result === null ? (
              "loading records…"
            ) : result.source === "live" ? (
              "live operational records"
            ) : (
              <span className="text-warn" title={result.error}>
                demo records (API offline)
              </span>
            )}
          </p>
        </div>
      </header>

      <Summary shipments={all} loading={result === null} />

      <section className={cn(surface, "flex min-h-0 flex-1 flex-col")}>
        <div className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-5 pb-4">
          <label className="flex h-10 w-72 items-center gap-2.5 rounded-full bg-surface-2 px-4 ring-active/35 focus-within:bg-surface focus-within:ring-2">
            <HugeiconsIcon icon={Search01Icon} size={16} className="text-ink-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, lane or notes…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
            />
          </label>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors",
                  filter === f.value ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className={cn(data, "ml-auto text-xs text-ink-3")}>
            {rows.length} of {all.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="text-left text-xs text-ink-3">
                <Th sortKey="dispatched" sort={sort} onSort={setSort}>
                  Shipment
                </Th>
                <Th>Lane</Th>
                <Th align="right">SLA</Th>
                <Th align="right">Transit</Th>
                <Th sortKey="variance" sort={sort} onSort={setSort} align="right">
                  Variance
                </Th>
                <Th>Status</Th>
                <Th sortKey="value" sort={sort} onSort={setSort} align="right">
                  Declared value
                </Th>
                <Th>Record note</Th>
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-ink-3">
                    No shipments match.
                  </td>
                </tr>
              ) : (
                rows.map((s) => <Row key={s.id} shipment={s} onOpen={() => open(s)} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Row({ shipment: s, onOpen }: { shipment: Shipment; onOpen: () => void }) {
  const variance = transitVarianceMinutes(s)
  const late = variance > 0
  const status = STATUS[s.status]

  return (
    <tr onClick={onOpen} className="group cursor-pointer">
      <Td className="rounded-l-xl">
        <Link
          href={`/?shipment=${encodeURIComponent(s.id)}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-ink outline-none group-hover:text-active focus-visible:underline"
        >
          {s.id}
        </Link>
        <div className={cn(data, "text-xs text-ink-3")}>{dateFmt.format(new Date(s.dispatchedAt))}</div>
      </Td>
      <Td>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="truncate">{s.origin}</span>
          <HugeiconsIcon icon={ArrowRight02Icon} size={12} className="shrink-0 text-ink-3" />
          <span className="truncate">{s.destination}</span>
        </span>
      </Td>
      <Td align="right" className={cn(data, "text-ink-2")}>
        {s.slaLimitHours}h
      </Td>
      <Td align="right" className={cn(data, "text-ink")}>
        {formatDuration(s.transitMinutes)}
        {s.inTransit && <div className="text-[11px] text-warn">in transit</div>}
      </Td>
      <Td align="right" className={cn(data, late ? "text-danger" : "text-ink-3")}>
        {late ? "+" : "−"}
        {formatDuration(variance)}
      </Td>
      <Td>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", status.className)}>{status.label}</span>
      </Td>
      <Td align="right" className={cn(data, "text-ink")}>
        {formatUSD(s.consignmentValue)}
      </Td>
      <Td className="max-w-72 rounded-r-xl">
        <span className="line-clamp-2 text-xs text-ink-2" title={s.notes ?? undefined}>
          {s.notes ?? <span className="text-ink-3">—</span>}
        </span>
      </Td>
    </tr>
  )
}

function Th({
  children,
  align = "left",
  sortKey,
  sort,
  onSort,
}: {
  children: React.ReactNode
  align?: "left" | "right"
  sortKey?: SortKey
  sort?: { key: SortKey; desc: boolean }
  onSort?: (s: { key: SortKey; desc: boolean }) => void
}) {
  const active = sortKey !== undefined && sort?.key === sortKey
  return (
    <th
      className={cn("border-b border-line px-3 pb-2.5 font-normal whitespace-nowrap", align === "right" && "text-right")}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}
    >
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort({ key: sortKey, desc: active ? !sort?.desc : true })}
          className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
        >
          {children}
          {active && <HugeiconsIcon icon={sort?.desc ? ArrowDown01Icon : ArrowUp01Icon} size={12} />}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

function Td({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode
  align?: "left" | "right"
  className?: string
}) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 py-3 align-middle transition-colors group-hover:bg-surface-2",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </td>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }, (_, i) => (
        <td key={i} className="border-b border-line px-3 py-4">
          <Skeleton className={cn("h-3.5 bg-track", i === 1 || i === 7 ? "w-40" : "w-16")} />
        </td>
      ))}
    </tr>
  )
}

function Summary({ shipments, loading }: { shipments: Shipment[]; loading: boolean }) {
  const delivered = shipments.filter((s) => !s.inTransit)
  const onTime = delivered.filter((s) => transitVarianceMinutes(s) <= 0).length
  const late = shipments.map(transitVarianceMinutes).filter((v) => v > 0)

  const stats = [
    { label: "Shipments", value: String(shipments.length) },
    { label: "Breached", value: String(shipments.filter((s) => s.status === "BREACH").length), danger: true },
    { label: "On-time rate", value: delivered.length ? String(Math.round((onTime / delivered.length) * 100)) : "—", unit: "%" },
    { label: "Avg. delay when late", value: late.length ? formatDuration(late.reduce((a, b) => a + b, 0) / late.length) : "—" },
    { label: "Declared value", value: formatUSD(shipments.reduce((a, s) => a + s.consignmentValue, 0)) },
  ]

  return (
    <dl className="mt-2 ml-2 flex shrink-0 flex-wrap gap-x-16 gap-y-4">
      {stats.map((st) => (
        <div key={st.label} className="flex flex-col gap-1">
          <dt className="text-xs text-ink-3">{st.label}</dt>
          <dd className={cn(data, "text-2xl font-light tracking-tight", st.danger && Number(st.value) > 0 ? "text-danger" : "text-ink")}>
            {loading ? <Skeleton className="h-7 w-16 bg-track" /> : st.value}
            {!loading && st.unit && st.value !== "—" && <span className="ml-0.5 text-base text-ink-3">{st.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

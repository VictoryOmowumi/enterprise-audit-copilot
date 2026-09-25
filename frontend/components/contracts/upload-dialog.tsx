"use client"

import { useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, Upload04Icon } from "@hugeicons/core-free-icons"

import { clauseTypeStyle } from "@/components/audit/clause-card"
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
import { parseContract, type ParsedSection } from "@/lib/contract-parse"
import { fetchTask, queueClause } from "@/lib/contracts-api"
import { cn } from "@/lib/utils"
import type { ClauseType, IngestTaskState, Vendor } from "@/lib/types"

const CLAUSE_TYPES: ClauseType[] = ["SLA_PENALTY", "TEMPERATURE_CONTROL", "DAMAGE_LIABILITY", "DELIVERY_TIMELINE", "GENERAL"]
const POLL_MS = 1500

interface UploadDialogProps {
  vendor: Vendor
  /** Existing clause counts per document name, to warn before duplicating. */
  existingDocuments: Map<string, number>
  disabled?: boolean
  /** Called when the dialog closes, so the caller can refresh its clause list. */
  onClosed: () => void
}

export function UploadDialog({ vendor, existingDocuments, disabled, onClosed }: UploadDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onClosed()
      }}
    >
      <DialogTrigger
        disabled={disabled}
        render={
          <Button className="h-10 rounded-full bg-ink px-5 text-sm font-medium text-surface hover:bg-ink/85 disabled:bg-track disabled:text-ink-3" />
        }
      >
        <HugeiconsIcon icon={Upload04Icon} size={16} data-icon="inline-start" />
        Upload contract
      </DialogTrigger>
      <DialogContent className="gap-5 rounded-3xl bg-surface p-7 sm:max-w-2xl">
        {/* Popup content unmounts on close, so each opening starts a fresh upload. */}
        <UploadFlow vendor={vendor} existingDocuments={existingDocuments} />
      </DialogContent>
    </Dialog>
  )
}

interface Row extends ParsedSection {
  include: boolean
  taskId?: string
  state?: IngestTaskState | { status: "error"; error: string }
}

function UploadFlow({ vendor, existingDocuments }: Pick<UploadDialogProps, "vendor" | "existingDocuments">) {
  const [documentName, setDocumentName] = useState("")
  const [text, setText] = useState("")
  const [rows, setRows] = useState<Row[] | null>(null)
  const [phase, setPhase] = useState<"compose" | "review" | "ingesting">("compose")

  const selected = rows?.filter((r) => r.include) ?? []
  const existing = existingDocuments.get(documentName.trim()) ?? 0

  async function readFile(file: File) {
    setText(await file.text())
    if (!documentName) setDocumentName(file.name)
  }

  function review() {
    const name = documentName.trim() || "uploaded_contract.md"
    setDocumentName(name)
    setRows(parseContract(text, name).map((s) => ({ ...s, include: true })))
    setPhase("review")
  }

  async function ingest() {
    if (!rows) return
    setPhase("ingesting")
    const queued = await Promise.all(
      rows.map(async (r): Promise<Row> => {
        if (!r.include) return r
        try {
          const taskId = await queueClause({
            vendor_code: vendor.code,
            section_title: r.title,
            clause_type: r.clauseType,
            content: r.content,
            document_name: documentName.trim(),
          })
          return { ...r, taskId, state: { status: "queued" } }
        } catch (err) {
          return { ...r, state: { status: "error", error: err instanceof Error ? err.message : String(err) } }
        }
      })
    )
    setRows(queued)
  }

  // Poll queued tasks until every one has completed or failed.
  const pending = useMemo(
    () => rows?.filter((r) => r.taskId && (r.state?.status === "queued" || r.state?.status === "processing")) ?? [],
    [rows]
  )
  useEffect(() => {
    if (phase !== "ingesting" || pending.length === 0) return
    const timer = setTimeout(async () => {
      const updates = await Promise.all(
        pending.map(async (r) => {
          try {
            return [r.taskId!, await fetchTask(r.taskId!)] as const
          } catch {
            return [r.taskId!, r.state as IngestTaskState] as const
          }
        })
      )
      const byId = new Map(updates)
      setRows((prev) => prev?.map((r) => (r.taskId && byId.has(r.taskId) ? { ...r, state: byId.get(r.taskId) } : r)) ?? prev)
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [phase, pending])

  // Finished once every included row has a terminal state (rows get states only after queueing).
  const finished = phase === "ingesting" && pending.length === 0 && selected.some((r) => r.state)
  const stored = rows?.filter((r) => r.state?.status === "completed").length ?? 0
  const failed = rows?.filter((r) => r.state?.status === "failed" || r.state?.status === "error").length ?? 0

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-medium tracking-tight text-ink">Upload contract</DialogTitle>
        <DialogDescription className="text-sm text-ink-3">
          Sections are split on “## ” headings, then embedded and stored for {vendor.name}.
        </DialogDescription>
      </DialogHeader>

      {phase === "compose" ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs text-ink-3">
            Document name
            <input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="apex_logistics_sla_2027.md"
              className="h-10 rounded-full bg-surface-2 px-4 text-sm text-ink outline-none ring-active/35 placeholder:text-ink-3 focus:bg-surface focus:ring-2"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface-2 px-4 py-5 text-sm text-ink-2 hover:border-ink-3">
            <HugeiconsIcon icon={Upload04Icon} size={16} />
            Choose a .md or .txt file
            <input
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void readFile(file)
              }}
            />
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"…or paste the contract text\n\n## Section 1: Delivery Timelines\nApex Logistics agrees to…"}
            rows={8}
            className="resize-none rounded-2xl bg-surface-2 p-4 font-data text-[13px] leading-relaxed text-ink outline-none ring-active/35 placeholder:text-ink-3 focus:bg-surface focus:ring-2"
          />
          {existing > 0 && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
              “{documentName.trim()}” already has {existing} stored clauses. Uploading again adds duplicates.
            </p>
          )}
        </div>
      ) : (
        <ScrollArea className="max-h-[50vh] rounded-2xl bg-surface-2">
          <ul className="flex flex-col divide-y divide-line">
            {rows?.length === 0 && <li className="p-6 text-center text-sm text-ink-3">No sections with content were found.</li>}
            {rows?.map((r, i) => (
              <li key={i} className={cn("flex items-center gap-3 px-4 py-3", !r.include && "opacity-45")}>
                {phase === "review" && (
                  <input
                    type="checkbox"
                    checked={r.include}
                    aria-label={`Include ${r.title}`}
                    onChange={(e) => setRows((prev) => prev!.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                    className="size-4 accent-(--active)"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                  <p className="font-data text-xs text-ink-3">{r.content.length.toLocaleString()} characters</p>
                </div>
                {phase === "review" ? (
                  <select
                    value={r.clauseType}
                    onChange={(e) =>
                      setRows((prev) => prev!.map((x, j) => (j === i ? { ...x, clauseType: e.target.value as ClauseType } : x)))
                    }
                    className="h-8 rounded-full bg-surface px-3 text-xs text-ink outline-none ring-1 ring-line focus:ring-active/50"
                  >
                    {CLAUSE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {clauseTypeStyle(t).label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TaskChip row={r} />
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      <DialogFooter className="items-center">
        {finished && (
          <p className="mr-auto flex items-center gap-1.5 text-sm text-ink-2">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-ok" />
            {stored} stored{failed > 0 && `, ${failed} failed`}
          </p>
        )}
        {phase === "compose" && (
          <Button onClick={review} disabled={!text.trim()} className="h-10 rounded-full bg-ink px-5 text-sm text-surface hover:bg-ink/85">
            Review sections
          </Button>
        )}
        {phase === "review" && (
          <>
            <Button variant="ghost" onClick={() => setPhase("compose")} className="h-10 rounded-full px-4 text-sm text-ink-2">
              Back
            </Button>
            <Button
              onClick={ingest}
              disabled={selected.length === 0}
              className="h-10 rounded-full bg-ink px-5 text-sm text-surface hover:bg-ink/85"
            >
              Ingest {selected.length} {selected.length === 1 ? "clause" : "clauses"}
            </Button>
          </>
        )}
        {phase === "ingesting" && !finished && <p className="text-sm text-ink-3">Embedding and storing… you can close this; ingestion continues.</p>}
      </DialogFooter>
    </>
  )
}

function TaskChip({ row }: { row: Row }) {
  if (!row.include) return <span className="text-xs text-ink-3">Skipped</span>
  const s = row.state
  const [label, className] =
    s?.status === "completed"
      ? s.embedded
        ? ["Stored", "bg-ok-soft text-ok"]
        : ["Stored · embedding pending", "bg-warn-soft text-warn"]
      : s?.status === "failed" || s?.status === "error"
        ? ["Failed", "bg-danger-soft text-danger"]
        : s?.status === "processing"
          ? ["Embedding…", "bg-active-soft text-active-ink"]
          : ["Queued", "bg-track text-ink-2"]
  const error = s?.status === "failed" || s?.status === "error" ? s.error : undefined
  return (
    <span title={error} className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium", className)}>
      {label}
    </span>
  )
}

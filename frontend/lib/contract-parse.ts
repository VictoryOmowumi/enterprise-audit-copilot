import type { ClauseType } from "@/lib/types"

export interface ParsedSection {
  title: string
  clauseType: ClauseType
  /** Stored as "title\nbody", matching backend app/pipeline.py so retrieval sees the same text. */
  content: string
}

/**
 * Splits a Markdown contract into clause sections on "## " headings, mirroring
 * `parse_markdown_clauses` in backend app/pipeline.py. Plain text with no
 * headings becomes a single section titled after the document.
 */
export function parseContract(text: string, documentName: string): ParsedSection[] {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  if (!normalized) return []

  const blocks = /^## /m.test(normalized) ? normalized.split(/\n(?=## )/) : [normalized]
  const sections: ParsedSection[] = []

  for (const block of blocks) {
    const lines = block.trim().split("\n")
    const hasHeading = /^#{1,6}\s/.test(lines[0])
    const title = hasHeading ? lines[0].replace(/^#{1,6}\s+/, "").trim() : stripExtension(documentName)
    const body = (hasHeading ? lines.slice(1) : lines).join("\n").trim()
    if (!body) continue
    sections.push({ title, clauseType: classifyClause(title), content: `${title}\n${body}` })
  }
  return sections
}

/** Title keyword rules from backend app/pipeline.py. */
export function classifyClause(title: string): ClauseType {
  const t = title.toLowerCase()
  if (t.includes("penalty") || t.includes("delayed")) return "SLA_PENALTY"
  if (t.includes("damage") || t.includes("integrity")) return "DAMAGE_LIABILITY"
  if (t.includes("temperature") || t.includes("cold chain")) return "TEMPERATURE_CONTROL"
  if (t.includes("timeline")) return "DELIVERY_TIMELINE"
  return "GENERAL"
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "")
}

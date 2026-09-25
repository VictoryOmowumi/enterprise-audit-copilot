import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"

import { navItem } from "@/lib/nav"
import { surface } from "@/lib/styles"
import { cn } from "@/lib/utils"

/** Placeholder for routes that exist in navigation but aren't built yet. */
export function ComingSoon({ href }: { href: string }) {
  const item = navItem(href)

  return (
    <section className={cn(surface, "flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center")}>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <HugeiconsIcon icon={item.icon} size={26} strokeWidth={1.6} />
      </span>
      <span className="rounded-full bg-active-soft px-2.5 py-0.5 text-xs font-medium text-active-ink">Coming soon</span>
      <h1 className="font-heading text-3xl font-medium tracking-tight text-ink">{item.label}</h1>
      <p className="max-w-md text-sm leading-relaxed text-ink-2">{item.description}</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-ink/85"
      >
        Back to SLA reconciliation
      </Link>
    </section>
  )
}

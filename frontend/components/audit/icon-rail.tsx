"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"

import { ThemeToggle } from "@/components/theme-toggle"
import { PRIMARY_NAV, UTILITY_NAV, type NavItem } from "@/lib/nav"
import { cn } from "@/lib/utils"

export function IconRail() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="flex w-14 shrink-0 flex-col items-center py-3">
      <Link href="/" aria-label="Audit Copilot home">
        <Logo />
      </Link>
      <div className="mt-10 flex flex-col items-center gap-3">
        {PRIMARY_NAV.map((item) => (
          <RailLink key={item.href} item={item} active={pathname === item.href} />
        ))}
      </div>
      <div className="mt-auto flex flex-col items-center gap-3">
        <ThemeToggle />
        {UTILITY_NAV.map((item) => (
          <RailLink key={item.href} item={item} active={pathname === item.href} />
        ))}
      </div>
    </nav>
  )
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-11 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-active/50",
        active ? "bg-ink text-surface shadow-lg shadow-black/15" : "text-ink-3 hover:bg-surface hover:text-ink"
      )}
    >
      <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.6} />
    </Link>
  )
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M3 3h20v20" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 9h14v14" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
      <path d="M3 15h8v8" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity=".45" />
    </svg>
  )
}

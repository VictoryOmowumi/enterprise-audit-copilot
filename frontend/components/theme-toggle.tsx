"use client"

import { useSyncExternalStore } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

import { THEME_STORAGE_KEY } from "@/lib/theme"

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains("dark")

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light")
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="flex size-11 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-ink"
    >
      <HugeiconsIcon icon={dark ? Sun03Icon : Moon02Icon} size={20} strokeWidth={1.6} />
    </button>
  )
}

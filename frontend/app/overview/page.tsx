import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Overview" }

export default function OverviewPage() {
  return <ComingSoon href="/overview" />
}

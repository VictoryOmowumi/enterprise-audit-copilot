import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Claims" }

export default function ClaimsPage() {
  return <ComingSoon href="/claims" />
}

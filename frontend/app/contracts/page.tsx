import type { Metadata } from "next"

import { ContractsView } from "@/components/contracts/contracts-view"

export const metadata: Metadata = { title: "Contracts" }

export default function ContractsPage() {
  return <ContractsView />
}

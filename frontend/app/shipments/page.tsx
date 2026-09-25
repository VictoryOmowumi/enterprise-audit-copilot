import type { Metadata } from "next"

import { ShipmentsView } from "@/components/shipments/shipments-view"

export const metadata: Metadata = { title: "Shipments" }

export default function ShipmentsPage() {
  return <ShipmentsView />
}

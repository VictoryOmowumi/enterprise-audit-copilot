import { AuditWorkspace } from "@/components/audit/audit-workspace"

export default async function Home({ searchParams }: PageProps<"/">) {
  const { shipment } = await searchParams
  return <AuditWorkspace initialShipmentId={typeof shipment === "string" ? shipment : null} />
}

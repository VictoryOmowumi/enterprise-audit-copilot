import {
  Calculator01Icon,
  Calendar03Icon,
  DashboardSquare01Icon,
  DeliveryTruck01Icon,
  Invoice01Icon,
  LegalDocument01Icon,
  Notification03Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"

export interface NavItem {
  href: string
  label: string
  icon: typeof Calculator01Icon
  /** Shown on the placeholder page until the route is built. */
  description: string
}

export const PRIMARY_NAV: NavItem[] = [
  {
    href: "/overview",
    label: "Overview",
    icon: DashboardSquare01Icon,
    description: "Portfolio health across vendors: on-time rate, breach trends and penalty exposure over time.",
  },
  {
    href: "/",
    label: "SLA reconciliation",
    icon: Calculator01Icon,
    description: "Investigate breaches against contract clauses and price the liability.",
  },
  {
    href: "/shipments",
    label: "Shipments",
    icon: DeliveryTruck01Icon,
    description: "Browse and filter every audited shipment with its full telemetry and carrier record.",
  },
  {
    href: "/contracts",
    label: "Contracts",
    icon: LegalDocument01Icon,
    description: "Upload vendor contracts and follow each clause through ingestion and embedding.",
  },
  {
    href: "/claims",
    label: "Claims",
    icon: Invoice01Icon,
    description: "Track issued breach notices and credits from notice through to settlement.",
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: Calendar03Icon,
    description: "Upcoming dispatches and the SLA deadlines they are running against.",
  },
]

export const UTILITY_NAV: NavItem[] = [
  {
    href: "/notifications",
    label: "Notifications",
    icon: Notification03Icon,
    description: "Alerts for new breaches, at-risk shipments and ingestion jobs.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings02Icon,
    description: "Vendors, API connection and workspace preferences.",
  },
]

export function navItem(href: string): NavItem {
  const item = [...PRIMARY_NAV, ...UTILITY_NAV].find((i) => i.href === href)
  if (!item) throw new Error(`No nav item for ${href}`)
  return item
}

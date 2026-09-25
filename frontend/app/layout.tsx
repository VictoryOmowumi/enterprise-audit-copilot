import type { Metadata } from "next";
import "./globals.css";
import { IconRail } from "@/components/audit/icon-rail";
import { TooltipProvider } from "@/components/ui/tooltip"
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: { template: "%s · Audit Copilot", default: "SLA Reconciliation · Audit Copilot" },
  description: "Enterprise SLA audit and logistics reconciliation workspace",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The init script sets the theme class before hydration.
    <html lang="en" className="h-full font-sans antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* Browser extensions often inject attributes on <body>; this ignores those differences only on this element. */}
      <body className="flex h-full flex-col overflow-hidden bg-canvas text-ink" suppressHydrationWarning>
        <TooltipProvider>
          <div className="flex h-screen gap-5 overflow-hidden p-3">
            <IconRail />
            <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}

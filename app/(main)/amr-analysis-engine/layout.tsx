"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Database, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"

const NAV = [
  {
    name: "Resistance Predictor",
    href: "/amr-analysis-engine/resistance-predictor",
    icon: ShieldAlert,
  },
  {
    name: "Gene Library",
    href: "/amr-analysis-engine/gene-database",
    icon: Database,
  },
]

/**
 * Secondary navigation for the AMR engine, rendered inside the bench itself.
 * The title bar, rail, tabs and status bar all come from the persistent shell.
 */
export default function AMRLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav
        aria-label="AMR engine"
        className="flex h-8 shrink-0 items-stretch gap-4 border-b border-border px-3"
      >
        {NAV.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-1.5 text-sm",
                "transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              <item.icon className="size-3.5" />
              {item.name}
              {/* Underline rides the header's bottom hairline. */}
              <span
                className={cn(
                  "absolute inset-x-0 -bottom-px h-px transition-colors duration-150",
                  isActive ? "bg-brand" : "bg-transparent",
                )}
              />
            </Link>
          )
        })}
      </nav>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

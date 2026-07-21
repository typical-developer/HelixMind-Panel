"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { cn } from "@/lib/utils";

export default function AMRLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Resistance Predictor",
      href: "/amr-analysis-engine/resistance-predictor",
    },
    { name: "Gene Database", href: "/amr-analysis-engine/gene-database" },
  ];

  return (
    <div className="pt-16">
      {/* Secondary tab navigation — the sidebar + page header are provided by
          the persistent shell in app/(main)/layout.tsx. */}
      <div className="relative">
        {/* Top Navigation / Tabs */}
        <div className="fixed top-10 left-16 right-0 bg-background/80 backdrop-blur-lg border-b border-border flex items-center gap-6 px-8 pt-6 z-39">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "py-6 text-sm font-medium relative transition-all duration-300 ease-in-out",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.name}
                {isActive && (
                  <span className={cn(
                    "absolute left-0 -bottom-px h-[2px] w-full bg-primary rounded-full animate-in duration-300",
                    item.href === "/amr-analysis-engine/resistance-predictor" ?  "slide-in-from-right" : "slide-in-from-left"
                  )} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Page Content */}
        <div className="w-full pt-25 animate-in fade-in duration-500">{children}</div>
      </div>
    </div>
  );
}
import Link from "next/link"
import { Compass } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4 bg-chrome px-6 text-center text-foreground">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex size-10 items-center justify-center rounded-lg border border-border bg-raised">
        <Compass className="size-4 text-muted-foreground" />
      </div>

      <div className="relative max-w-md space-y-1.5">
        <h1 className="text-base font-medium">This page isn&apos;t part of the lab</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The address you followed doesn&apos;t match any analysis. Head back to the
          Overview, or press{" "}
          <span className="font-mono text-foreground/80">Ctrl+K</span> once inside to
          search everything.
        </p>
      </div>

      <Button asChild size="sm" className="relative h-8">
        <Link href="/dashboard">Go to Overview</Link>
      </Button>
    </div>
  )
}

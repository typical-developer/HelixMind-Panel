"use client"

import type React from "react"

/**
 * Next.js re-mounts a `template` on every navigation (unlike `layout`, which
 * persists). Wrapping the routed content here replays a lightweight fade + rise
 * on each route change, so navigating between pages feels animated instead of
 * snapping. The animation is opacity/transform only (compositor-friendly) and
 * is neutralised for users with `prefers-reduced-motion` via globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>
}

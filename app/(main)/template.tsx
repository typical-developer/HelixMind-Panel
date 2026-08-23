"use client"

import type React from "react"

/**
 * Next.js re-mounts a `template` on every navigation (unlike `layout`, which
 * persists), so wrapping the routed content here replays a short fade-and-rise
 * on each route change while the workbench chrome around it stays put. The
 * animation is opacity/transform only, and is neutralised for users with
 * `prefers-reduced-motion` via globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in h-full min-h-0">{children}</div>
}

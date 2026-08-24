"use client"

import * as React from "react"
import { Copy, Dna, ScanLine } from "lucide-react"

import { cn } from "@/lib/utils"
import { copyToClipboard } from "@/lib/download"
import { useLabSnapshot, PREVIEW_BASES } from "@/lib/lab-snapshot"
import {
  Chip,
  EmptyState,
  Pane,
  PaneHeader,
  ToolbarButton,
  useWorkbench,
} from "@/components/workbench"

/** Width of the position gutter (`w-16`) plus its right padding. */
const GUTTER_PX = 64 + 14
/** Trailing padding after the last base. */
const TRAIL_PX = 16
/** Row lengths stay on a round multiple so position numbers read cleanly. */
const STEP = 10
const MIN_BASES = 10
const FALLBACK_BASES = 60

/** Per-base tint. Low-chroma by design — see the token notes in globals.css. */
const BASE_CLASS: Record<string, string> = {
  A: "text-[var(--base-a)]",
  T: "text-[var(--base-t)]",
  G: "text-[var(--base-g)]",
  C: "text-[var(--base-c)]",
  N: "text-muted-foreground",
}

/**
 * Sequence readout for the sequence most recently scanned.
 *
 * This used to render a 300-base literal — `ATGCTAGCTAGC…` repeating — with a
 * hard-coded "hotspot 15–25" that corresponded to nothing. It now reads the
 * scanner's last result, and the highlighted positions are the variants the
 * scanner actually called.
 *
 * How many bases sit on a row is measured from the pane rather than fixed. It
 * used to be a hard-coded 60, which is why the readout left a band of dead
 * space down its right-hand side on any pane wider than those 60 glyphs — and
 * why it clipped on any pane narrower.
 */
export function DNAViewer() {
  const { scan } = useLabSnapshot()
  const { openTab } = useWorkbench()
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const probeRef = React.useRef<HTMLSpanElement>(null)
  const [basesPerRow, setBasesPerRow] = React.useState(FALLBACK_BASES)

  const sequence = scan?.preview ?? ""

  /* Measure the real advance of one base cell (glyph + the 1px gap between
     cells) off a hidden probe, then fit as many whole cells as the pane allows.
     Measuring beats hard-coding a character width: the mono face, the zoom
     level and the tracking can all change it. */
  React.useLayoutEffect(() => {
    const scroller = scrollRef.current
    const probe = probeRef.current
    if (!scroller || !probe) return

    const fit = () => {
      const sample = probe.getBoundingClientRect().width
      if (!sample) return
      const cell = sample / 20 + 1 // 20 probe glyphs, plus the gap-px per cell
      const usable = scroller.clientWidth - GUTTER_PX - TRAIL_PX
      const raw = Math.floor(usable / cell)
      const snapped = Math.max(MIN_BASES, Math.floor(raw / STEP) * STEP)
      setBasesPerRow((prev) => (prev === snapped ? prev : snapped))
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [sequence])

  /** Called positions, 0-based, for O(1) lookup while rendering rows. */
  const variantPositions = React.useMemo(() => {
    const set = new Set<number>()
    for (const mutation of scan?.mutations ?? []) set.add(mutation.position - 1)
    return set
  }, [scan])

  const rows = React.useMemo(() => {
    const out: Array<{ start: number; bases: string[] }> = []
    for (let i = 0; i < sequence.length; i += basesPerRow) {
      out.push({ start: i, bases: sequence.slice(i, i + basesPerRow).split("") })
    }
    return out
  }, [basesPerRow, sequence])

  if (!scan) {
    return (
      <Pane className="min-h-0">
        <PaneHeader icon={Dna} title="Sequence viewer" />
        <EmptyState
          icon={ScanLine}
          title="No sequence loaded"
          description="Scan a FASTA file in the DNA Scanner and the sequence appears here, with any called variants highlighted."
          action={
            <button
              type="button"
              onClick={() => openTab("/dna-scanner")}
              className="cursor-pointer rounded-sm border border-border px-2 py-1 text-xs text-foreground/85 transition-colors hover:bg-[var(--wb-active)] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              Open the DNA Scanner
            </button>
          }
        />
      </Pane>
    )
  }

  const truncated = scan.length > sequence.length

  return (
    <Pane className="min-h-0">
      <PaneHeader
        icon={Dna}
        title="Sequence viewer"
        subtitle={`${scan.header} · ${scan.length.toLocaleString()} bp · GC ${scan.gcContent.toFixed(1)}%`}
        actions={
          <>
            {scan.mutationCount > 0 && (
              <Chip tone="warning">
                {scan.mutationCount.toLocaleString()} variant
                {scan.mutationCount === 1 ? "" : "s"}
              </Chip>
            )}
            <ToolbarButton
              icon={Copy}
              label="Copy the shown sequence"
              onClick={() =>
                copyToClipboard(sequence, `Copied ${sequence.length} bases`)
              }
            />
          </>
        }
      />

      <div
        ref={scrollRef}
        className="seq-scroll min-h-0 flex-1 overflow-auto bg-[var(--wb-inset)] py-2.5 font-mono text-xs leading-[1.6] tracking-normal"
      >
        {/* Off-screen probe used only to measure a base cell's advance. */}
        <span
          ref={probeRef}
          aria-hidden
          className="pointer-events-none absolute -top-[9999px] left-0 tracking-wider whitespace-pre"
        >
          AAAAAAAAAAAAAAAAAAAA
        </span>

        {rows.map((row) => (
          <div key={row.start} className="flex hover:bg-[var(--wb-hover)]">
            <span className="gutter-num sticky left-0 w-16 shrink-0 bg-[var(--wb-inset)] pr-3.5">
              {row.start + 1}
            </span>
            <span className="flex gap-px pr-4 tracking-wider whitespace-nowrap">
              {row.bases.map((base, i) => {
                const index = row.start + i
                const variant = variantPositions.has(index)
                return (
                  <span
                    key={index}
                    title={variant ? `Variant at position ${index + 1}` : undefined}
                    className={cn(
                      "transition-colors duration-100",
                      BASE_CLASS[base] ?? "text-foreground/70",
                      // A called variant is a single base, so it gets a ring
                      // rather than the wash a range would take.
                      variant &&
                        "rounded-xs bg-destructive/25 font-semibold text-foreground ring-1 ring-destructive/50",
                    )}
                  >
                    {base}
                  </span>
                )
              })}
            </span>
          </div>
        ))}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
        {(["A", "T", "G", "C"] as const).map((base) => (
          <span key={base} className="flex items-center gap-1.5">
            <span className={cn("font-mono font-semibold", BASE_CLASS[base])}>
              {base}
            </span>
            {base === "A"
              ? "adenine"
              : base === "T"
                ? "thymine"
                : base === "G"
                  ? "guanine"
                  : "cytosine"}
          </span>
        ))}
        {truncated && (
          <span className="ml-auto text-muted-foreground/70">
            showing the first {PREVIEW_BASES.toLocaleString()} bases
          </span>
        )}
      </footer>
    </Pane>
  )
}

"use client"

import * as React from "react"
import { Check, Copy, Dna } from "lucide-react"

import { cn } from "@/lib/utils"
import { Pane, PaneHeader, ToolbarButton, Chip } from "@/components/workbench"

const DNA_SEQUENCE =
  "ATGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGC"

const HIGHLIGHT_START = 15
const HIGHLIGHT_END = 25

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
 * Sequence readout: a position gutter down the left, rows of bases coloured by
 * nucleotide, and a highlighted variant hotspot.
 *
 * How many bases sit on a row is measured from the pane rather than fixed. It
 * used to be a hard-coded 60, which is why the readout left a band of dead
 * space down its right-hand side on any pane wider than those 60 glyphs — and
 * why it clipped on any pane narrower.
 */
export function DNAViewer() {
  const [copied, setCopied] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const probeRef = React.useRef<HTMLSpanElement>(null)
  const [basesPerRow, setBasesPerRow] = React.useState(FALLBACK_BASES)

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
  }, [])

  const rows = React.useMemo(() => {
    const out: Array<{ start: number; bases: string[] }> = []
    for (let i = 0; i < DNA_SEQUENCE.length; i += basesPerRow) {
      out.push({ start: i, bases: DNA_SEQUENCE.slice(i, i + basesPerRow).split("") })
    }
    return out
  }, [basesPerRow])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(DNA_SEQUENCE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Pane className="min-h-0">
      <PaneHeader
        icon={Dna}
        title="Sequence viewer"
        subtitle={`${DNA_SEQUENCE.length} bp · reference strand`}
        actions={
          <>
            <Chip tone="info">
              hotspot {HIGHLIGHT_START}–{HIGHLIGHT_END}
            </Chip>
            <ToolbarButton
              icon={copied ? Check : Copy}
              label={copied ? "Copied" : "Copy sequence"}
              onClick={copyToClipboard}
              className={cn(copied && "text-success")}
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
                const highlighted = index >= HIGHLIGHT_START && index < HIGHLIGHT_END
                return (
                  <span
                    key={index}
                    className={cn(
                      "transition-colors duration-100",
                      BASE_CLASS[base] ?? "text-foreground/70",
                      // The hotspot marks a run of bases, so a light wash and a
                      // brighter glyph is enough — a ring on every base in the
                      // run turned it into a striped block.
                      highlighted && "bg-brand/20 font-semibold text-foreground",
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
            <span className="text-muted-foreground/70">
              {(
                ((DNA_SEQUENCE.split(base).length - 1) / DNA_SEQUENCE.length) *
                100
              ).toFixed(1)}
              %
            </span>
          </span>
        ))}
        <span className="ml-auto">
          Bases {HIGHLIGHT_START}–{HIGHLIGHT_END} flagged as a variant hotspot
        </span>
      </footer>
    </Pane>
  )
}

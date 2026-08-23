"use client"

import { useMemo, useState } from "react"
import { Check, Copy, Dna } from "lucide-react"

import { cn } from "@/lib/utils"
import { Pane, PaneHeader, ToolbarButton, Chip } from "@/components/workbench"

const DNA_SEQUENCE =
  "ATGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGC"

const HIGHLIGHT_START = 15
const HIGHLIGHT_END = 25
const BASES_PER_ROW = 60

/** Per-base tint. Low-chroma by design — see the token notes in globals.css. */
const BASE_CLASS: Record<string, string> = {
  A: "text-[var(--base-a)]",
  T: "text-[var(--base-t)]",
  G: "text-[var(--base-g)]",
  C: "text-[var(--base-c)]",
  N: "text-muted-foreground",
}

/**
 * Sequence readout: a position gutter down the left, fixed-width rows of bases
 * coloured by nucleotide, and a highlighted variant hotspot.
 */
export function DNAViewer() {
  const [copied, setCopied] = useState(false)

  const rows = useMemo(() => {
    const out: Array<{ start: number; bases: string[] }> = []
    for (let i = 0; i < DNA_SEQUENCE.length; i += BASES_PER_ROW) {
      out.push({ start: i, bases: DNA_SEQUENCE.slice(i, i + BASES_PER_ROW).split("") })
    }
    return out
  }, [])

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
            <Chip tone="info">hotspot {HIGHLIGHT_START}–{HIGHLIGHT_END}</Chip>
            <ToolbarButton
              icon={copied ? Check : Copy}
              label={copied ? "Copied" : "Copy sequence"}
              onClick={copyToClipboard}
              className={cn(copied && "text-success")}
            />
          </>
        }
      />

      <div className="seq-scroll min-h-0 flex-1 overflow-auto bg-[var(--wb-inset)] py-2.5 font-mono text-xs leading-[1.6] tracking-normal">
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

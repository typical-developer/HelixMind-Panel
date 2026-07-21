"use client"

import { useState } from "react"
import { Copy, Check, Dna } from "lucide-react"
import { cn } from "@/lib/utils"

const DNA_SEQUENCE =
  "ATGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGC"

export function DNAViewer() {
  const [copied, setCopied] = useState(false)
  const highlightStart = 15
  const highlightEnd = 25

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
    <div className="glass p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
            <Dna className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">DNA Sequence Viewer</h3>
            <p className="text-xs text-muted-foreground">
              {DNA_SEQUENCE.length} base pairs · reference strand
            </p>
          </div>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-black/40 p-5 font-mono text-sm">
        <div className="seq-scroll max-h-[280px] overflow-y-auto">
          <div className="flex flex-wrap gap-x-1 gap-y-1.5 leading-none">
            {DNA_SEQUENCE.split("").map((base, idx) => {
              const highlighted = idx >= highlightStart && idx < highlightEnd
              return (
                <span
                  key={idx}
                  className={cn(
                    "transition-colors",
                    highlighted
                      ? "rounded bg-white/10 px-0.5 font-bold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {base}
                </span>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-white/40" />
          Highlighted region — bases {highlightStart}–{highlightEnd} (variant hotspot)
        </div>
      </div>
    </div>
  )
}

"use client"

import { Activity } from "lucide-react"

import { cn } from "@/lib/utils"
import { Chip, Pane, PaneHeader } from "@/components/workbench"

export interface Mutation {
  generation: number
  position: number
  change: string
  impact: "High Risk" | "Neutral" | "Low Risk"
}

const SAMPLE_MUTATIONS: Mutation[] = [
  { generation: 1, position: 42, change: "A→T", impact: "High Risk" },
  { generation: 2, position: 156, change: "G→C", impact: "Neutral" },
  { generation: 3, position: 89, change: "C→G", impact: "Low Risk" },
  { generation: 4, position: 203, change: "T→A", impact: "High Risk" },
  { generation: 5, position: 127, change: "A→G", impact: "Neutral" },
]

const IMPACT_TONE = {
  "High Risk": "danger",
  Neutral: "neutral",
  "Low Risk": "success",
} as const

const HEADERS = ["Gen", "Position", "Change", "Impact"] as const

/** Detected variants, rendered as a dense data grid rather than a card table. */
export function MutationTable() {
  const highRisk = SAMPLE_MUTATIONS.filter((m) => m.impact === "High Risk").length

  return (
    <Pane className="min-h-0">
      <PaneHeader
        icon={Activity}
        title="Mutation log"
        subtitle={`${SAMPLE_MUTATIONS.length} variants`}
        actions={
          highRisk > 0 ? <Chip tone="danger">{highRisk} high risk</Chip> : null
        }
      />

      <div className="seq-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="px-3 py-1.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_MUTATIONS.map((mutation, idx) => (
              <tr
                key={idx}
                className="row-hover border-b border-border/50 last:border-0"
              >
                <td className="px-3 py-1.5 font-mono text-muted-foreground">
                  #{mutation.generation}
                </td>
                <td className="px-3 py-1.5 font-mono text-foreground">
                  {mutation.position}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 font-mono font-medium",
                    mutation.impact === "High Risk"
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  {mutation.change}
                </td>
                <td className="px-3 py-1.5">
                  <Chip tone={IMPACT_TONE[mutation.impact]}>{mutation.impact}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Pane>
  )
}

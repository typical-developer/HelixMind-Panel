"use client"

import { Activity } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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

const getImpactVariant = (impact: Mutation["impact"]) => {
  switch (impact) {
    case "High Risk":
      return "failure"
    case "Neutral":
      return "neutral"
    case "Low Risk":
      return "success"
    default:
      return "default"
  }
}

export function MutationTable() {
  return (
    <div className="glass p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">Mutation Log</h3>
          <p className="text-xs text-muted-foreground">
            {SAMPLE_MUTATIONS.length} detected variants across generations
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Generation", "Position", "Change", "Impact"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
                className="border-b border-border/40 transition-colors last:border-0 hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  #{mutation.generation}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-foreground">
                  {mutation.position}
                </td>
                <td className="px-4 py-3 font-mono font-medium text-foreground">
                  {mutation.change}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getImpactVariant(mutation.impact)}>
                    {mutation.impact}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

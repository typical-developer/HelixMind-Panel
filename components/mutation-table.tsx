"use client"

import { Activity, ScanLine } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLabSnapshot, PREVIEW_MUTATIONS } from "@/lib/lab-snapshot"
import {
  Chip,
  DataTable,
  EmptyState,
  Pane,
  PaneHeader,
  Th,
  useWorkbench,
} from "@/components/workbench"

const HEADERS = ["Position", "Change", "Class"] as const

/**
 * Variants called by the most recent scan.
 *
 * The five rows here used to be a `SAMPLE_MUTATIONS` literal — generations 1–5
 * at positions 42, 156, 89, 203 and 127, each with a hand-assigned "High Risk"
 * or "Neutral" label that no rule produced. The rows are real calls now, and
 * the classification is the one the caller actually makes: whether the
 * substitution is a transition or a transversion.
 */
export function MutationTable() {
  const { scan } = useLabSnapshot()
  const { openTab } = useWorkbench()

  if (!scan) {
    return (
      <Pane className="min-h-0">
        <PaneHeader icon={Activity} title="Mutation log" />
        <EmptyState
          icon={ScanLine}
          title="No variants called"
          description="Scan a target against a reference in the DNA Scanner and the calls appear here."
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

  if (scan.mutationCount === 0) {
    return (
      <Pane className="min-h-0">
        <PaneHeader
          icon={Activity}
          title="Mutation log"
          subtitle={scan.header}
        />
        <EmptyState
          icon={Activity}
          title="No differences found"
          description={
            scan.referenceHeader
              ? `${scan.header} matches ${scan.referenceHeader} at every compared position.`
              : "No reference was supplied on the last scan, so no calls were made."
          }
        />
      </Pane>
    )
  }

  const transversions = scan.mutations.filter(
    (m) => m.substitution === "transversion",
  ).length

  return (
    <Pane className="min-h-0">
      <PaneHeader
        icon={Activity}
        title="Mutation log"
        subtitle={`${scan.mutationCount.toLocaleString()} variant${
          scan.mutationCount === 1 ? "" : "s"
        }${scan.referenceHeader ? ` vs ${scan.referenceHeader}` : ""}`}
        actions={
          transversions > 0 ? (
            <Chip tone="warning">{transversions} transversion</Chip>
          ) : null
        }
      />

      <DataTable minWidth="22rem">
        <thead>
          <tr>
            {HEADERS.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
            {scan.mutations.map((mutation) => (
              <tr
                key={mutation.position}
                className="row-hover border-b border-border/50 last:border-0"
              >
                <td className="px-3 py-2 font-mono text-foreground tabular">
                  {mutation.position.toLocaleString()}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-mono font-medium",
                    mutation.substitution === "transversion"
                      ? "text-warning"
                      : "text-foreground",
                  )}
                >
                  {mutation.refBase}→{mutation.varBase}
                </td>
                <td className="px-3 py-2">
                  <Chip
                    tone={
                      mutation.substitution === "transversion"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {mutation.substitution}
                  </Chip>
                </td>
              </tr>
            ))}
        </tbody>
      </DataTable>

      {scan.mutationCount > scan.mutations.length && (
        <footer className="shrink-0 border-t border-border px-3 py-2 text-xs text-muted-foreground/70">
          Showing the first {PREVIEW_MUTATIONS} of{" "}
          {scan.mutationCount.toLocaleString()}. The DNA Scanner lists them all.
        </footer>
      )}
    </Pane>
  )
}

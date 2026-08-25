"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Check,
  Dna,
  DownloadIcon,
  FlaskConical,
  Info,
  Microscope,
  Sparkles,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { linkActivityRun, recordActivity } from "@/lib/activity-store"
import { archiveRun } from "@/lib/run-archive"
import { LastRunLink } from "@/components/last-run"
import { savePredictionSnapshot } from "@/lib/lab-snapshot"
import { downloadJSON, fileStamp } from "@/lib/download"
import {
  AMR_BY_GENE,
  AMR_DATA_VERSION,
  AMR_ORGANISMS,
  AMR_RECORDS,
} from "@/lib/amr-records"
import {
  SYNERGY_RULES,
  predictResistance,
  type PredictionResult,
  type ResistanceCall,
} from "@/lib/amr-model"
import {
  BulletItem,
  BulletList,
  Chip,
  ViewLayout,
  ViewScroll,
  EmptyState,
  Pane,
  PaneHeader,
  Rule,
  ToolbarButton,
  useLogStream,
  useAlerts,
  useRunStatus,
  useWorkbench,
  useStatusItems,
  useViewContext,
  type WorkbenchAlert,
} from "@/components/workbench"

/**
 * The markers this view offers.
 *
 * There used to be a private `amrDatabase` here holding seven genes, while
 * `lib/amr-records.ts` — whose own docstring called itself the single source
 * of truth — held a different five. Two of the seven were absent from the
 * library entirely, so `vanA` could be scored here and then found nowhere in
 * the Gene Library or the command palette. Both tables are merged into the
 * library now, and this list is derived from it.
 */
const DETECTED_GENES = AMR_RECORDS.map((record) => record.gene)

export default function ResistancePredictorPage() {
  const searchParams = useSearchParams()
  const [selectedOrganism, setSelectedOrganism] = useState("E. coli")
  const [selectedGenes, setSelectedGenes] = useState<string[]>([])

  /**
   * Arrive with markers already picked.
   *
   * The Gene Library listed nine resistance markers and this view scored them,
   * and there was no way to get from one to the other — you read a gene in the
   * library, then came here and hunted for it in a checklist. A row in the
   * library now links straight through with the gene selected.
   */
  const seededGenes = searchParams.get("genes")
  useEffect(() => {
    if (!seededGenes) return
    const genes = seededGenes
      .split(",")
      .map((g) => g.trim())
      .filter((g) => AMR_BY_GENE.has(g))
    if (genes.length === 0) return
    setSelectedGenes(genes)
    // Pick an organism the markers are actually reported in, so the advisory
    // does not fire on a selection the link itself created.
    const first = AMR_BY_GENE.get(genes[0])
    if (first) setSelectedOrganism(first.organism)
  }, [seededGenes])
  const [results, setResults] = useState<PredictionResult | null>(null)
  const [error, setError] = useState("")
  const { setPanelTab } = useWorkbench()

  /** High-confidence calls — what the Overview counts as a threat. */
  const highCount = useMemo(
    () =>
      results?.calls.filter((call) => call.confidence.level === "High").length ?? 0,
    [results],
  )

  const organisms = AMR_ORGANISMS

  const toggleGene = (label: string) => {
    setSelectedGenes((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    )
  }

  const analyzeResistance = () => {
    if (!selectedGenes.length) {
      setError("Select at least one marker to analyse")
      toast({
        variant: "warning",
        title: "No markers selected",
        description: "Pick at least one detected gene before running the analysis.",
      })
      return
    }

    setError("")
    const startedAt = Date.now()

    // Scoring lives in lib/amr-model.ts so it can be tested without rendering
    // anything. It was previously inline, untyped (`report: any`) and wrapped
    // in a try/catch around code that cannot throw, behind a `loading` flag
    // that was set and cleared within the same synchronous tick.
    const result = predictResistance(selectedGenes, selectedOrganism)
    setResults(result)

    savePredictionSnapshot({
      organism: result.organism,
      calls: result.calls.map((call) => ({
        drugClass: call.drugClass,
        score: call.confidence.score,
        genes: call.genes,
        isSynergistic: call.isSynergistic,
      })),
    })

    const high = result.calls.filter((c) => c.confidence.level === "High")

    const event = recordActivity({
      kind: "prediction.completed",
      engine: "amr",
      label: `Resistance profile · ${result.organism}`,
      detail: `${result.selectedGenes.length} marker${result.selectedGenes.length === 1 ? "" : "s"} · ${result.calls.length} drug class${result.calls.length === 1 ? "" : "es"}`,
      href: "/amr-analysis-engine/resistance-predictor",
      severity: high.length > 0 ? "danger" : "success",
    })

    // Two events, one run. The threat is worth its own line in the log and its
    // own notification, but it is the same analysis — so both are linked to the
    // same archived record below, and either one opens it.
    const threat =
      high.length > 0
        ? recordActivity({
            kind: "threat.detected",
            engine: "amr",
            label: `${high.length} high-confidence resistance call${high.length === 1 ? "" : "s"}`,
            detail: high.map((c) => c.drugClass).join(", "),
            href: "/amr-analysis-engine/resistance-predictor",
            severity: "danger",
            value: high.length,
          })
        : null

    // A resistance profile is the most consequential thing this panel
    // produces, and it was the least durable: `savePredictionSnapshot` above
    // keeps only the *latest* one, so running a second isolate overwrote the
    // first with no record that it had ever been scored.
    void archiveRun({
      engine: "amr",
      label: `Resistance profile · ${result.organism}`,
      detail: `${result.selectedGenes.length} marker${result.selectedGenes.length === 1 ? "" : "s"} · ${result.calls.length} drug class${result.calls.length === 1 ? "" : "es"}`,
      startedAt,
      endedAt: Date.now(),
      outcome: "completed",
      href: "/amr-analysis-engine/resistance-predictor",
      inputs: {
        organism: result.organism,
        markers: result.selectedGenes,
      },
      params: {
        organism: selectedOrganism,
        // Which reference table scored this. Without it the record says what
        // was found but not what it was compared against.
        referenceData: AMR_DATA_VERSION,
      },
      summary: {
        markers: result.selectedGenes.length,
        drugClasses: result.calls.length,
        highConfidence: high.length,
      },
      payload: {
        organism: result.organism,
        selectedGenes: result.selectedGenes,
        calls: result.calls,
        note: "Rule-based marker scoring for research use. Not a susceptibility report — see the About dialog.",
      },
    }).then((runId) => {
      // Linked after the write, not before it: a browser with no
      // IndexedDB archives nothing, and an event pointing at a run
      // that was never filed is worse than one pointing at its engine.
      if (!runId) return
      linkActivityRun(event.id, runId)
      if (threat) linkActivityRun(threat.id, runId)
    })

    toast({
      variant: high.length > 0 ? "warning" : "success",
      title: "Analysis complete",
      description:
        high.length > 0
          ? `${high.length} high-confidence call${high.length === 1 ? "" : "s"}: ${high.map((c) => c.drugClass).join(", ")}.`
          : `${result.calls.length} drug class${result.calls.length === 1 ? "" : "es"} implicated, none at high confidence.`,
    })
  }

  const exportReport = () => {
    if (!results) return

    downloadJSON(
      {
        metadata: {
          organism: results.organism,
          timestamp: results.timestamp,
          disclaimer: "Research tool only. Not for clinical use.",
          modelType: "Rule-based (synergy-aware)",
          // An exported report outlives the session that made it, and the one
          // question its reader will have is what it was scored against.
          referenceData: AMR_DATA_VERSION,
          note: "The selected organism is recorded and used only to flag unexpected markers; it does not affect scoring.",
        },
        detectedResistance: results.calls,
        genesAnalyzed: results.selectedGenes,
        unknownGenes: results.unknownGenes,
        unexpectedForOrganism: results.unexpectedForOrganism,
      },
      {
        filename: `amr-report-${fileStamp()}.json`,
        engine: "amr",
        description: `${results.calls.length} drug class${results.calls.length === 1 ? "" : "es"} for ${results.organism}.`,
      },
    )
  }

  const getConfidenceTone = (score: number) => {
    if (score >= 0.9) return "danger" as const
    if (score >= 0.7) return "warning" as const
    return "neutral" as const
  }

  /* ---- Bench integration ------------------------------------------------ */

  useAlerts(
    "amr-engine",
    useMemo<WorkbenchAlert[]>(() => {
      const list: WorkbenchAlert[] = []
      if (error) {
        list.push({ source: "amr-engine", severity: "error", message: error })
      }
      if (results) {
        for (const call of results.calls) {
          if (call.confidence.level === "High") {
            list.push({
              source: "amr-engine",
              severity: "warning",
              message: `High-confidence resistance predicted for ${call.drugClass} (${call.genes.join(", ")})`,
              at: results.organism,
            })
          }
        }
        // The organism picker had no effect of any kind before this: markers
        // that are not reported in the chosen organism scored identically to
        // ones that are. It still does not change the score — see
        // docs/BUG-REPORT.md — but it no longer passes in silence.
        for (const gene of results.unexpectedForOrganism) {
          list.push({
            source: "amr-engine",
            severity: "info",
            message: `${gene} is not normally reported in ${results.organism}. Scoring is unaffected.`,
            at: results.organism,
          })
        }
        for (const gene of results.unknownGenes) {
          list.push({
            source: "amr-engine",
            severity: "warning",
            message: `${gene} is not in the gene library and was skipped.`,
          })
        }
      }
      return list
    }, [error, results]),
  )

  useLogStream(
    "amr-engine",
    useMemo(
      () =>
        results
          ? [
              `analysed ${results.selectedGenes.length} marker(s) for ${results.organism}`,
              `${results.calls.length} drug class(es) implicated`,
              ...results.calls.map(
                (call) =>
                  `${call.drugClass}: ${call.confidence.level} (${Math.round(call.confidence.score * 100)}%)${call.isSynergistic ? " · synergy applied" : ""}`,
              ),
            ]
          : [],
      [results],
    ),
  )

  useRunStatus(
    useMemo(
      () =>
        results
          ? {
              label: "Resistance analysis",
              source: "amr-engine",
              state: "done" as const,
              detail: `${results.calls.length} drug class${results.calls.length === 1 ? "" : "es"} for ${results.organism}`,
            }
          : null,
      [results],
    ),
  )

  useStatusItems(
    useMemo(
      () => [
        {
          id: "organism",
          label: selectedOrganism,
          title:
            "Organism selected for the report. It flags unexpected markers but does not change scoring.",
        },
        {
          id: "genes",
          label: `${selectedGenes.length} marker${selectedGenes.length === 1 ? "" : "s"}`,
          title: "Resistance markers selected in the inspector",
          tone: selectedGenes.length ? ("info" as const) : ("default" as const),
        },
        ...(highCount > 0
          ? [
              {
                id: "high",
                label: `${highCount} high`,
                title: "High-confidence resistance calls — open the console's Alerts tab",
                tone: "danger" as const,
                onClick: () => setPanelTab("alerts"),
              },
            ]
          : []),
      ],
      [selectedOrganism, selectedGenes.length, highCount, setPanelTab],
    ),
  )

  useViewContext(
    `${selectedOrganism} · ${selectedGenes.length} marker${
      selectedGenes.length === 1 ? "" : "s"
    } selected${results ? ` · last run ${results.timestamp}` : ""}`,
  )

  return (
    <ViewLayout
      inspectorId="amr-predictor"
      defaultInspectorSize={30}
      inspector={
        <PredictorInspector
          organisms={organisms}
          selectedOrganism={selectedOrganism}
          setSelectedOrganism={setSelectedOrganism}
          selectedGenes={selectedGenes}
          toggleGene={toggleGene}
          error={error}
          onAnalyze={analyzeResistance}
        />
      }
    >
      {results ? (
        <ViewScroll>
          {/* A resistance profile is the payoff of the whole view, and it used
              to replace the empty state in a single frame. Staggered so the
              panes land in reading order — the calls first, then the notes
              beneath them. */}
          <div className="animate-stagger flex flex-col gap-3 p-3">
            <Pane>
              <PaneHeader
                icon={Sparkles}
                title="Analysis results"
                subtitle={new Date(results.timestamp).toLocaleString()}
                actions={
                  <ToolbarButton
                    icon={DownloadIcon}
                    label="Export report as JSON"
                    onClick={exportReport}
                  />
                }
              />

              {/*
                The caveat, where the numbers are.

                It was already in the inspector's "Tool limitations" pane — a
                column the operator can collapse, and does. A percentage next to
                a drug class reads as a susceptibility result unless something
                on the same surface says otherwise, and the literature is
                emphatic that marker presence is not phenotype: databases
                disagree with each other on the same isolates, and concordance
                shifts with the breakpoint standard used. See
                docs/DOMAIN-RESEARCH.md §3.

                Deliberately a hairline strip of muted text rather than a tinted
                warning box. It has to be present on every reading, which means
                it has to be quiet enough to live there.
              */}
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border px-3 py-1.5 text-xs text-muted-foreground/80">
                <span>
                  Marker presence, scored from published estimates — not a
                  susceptibility report.
                </span>
                <span className="font-mono text-muted-foreground/60">
                  {AMR_DATA_VERSION}
                </span>
              </p>

              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[
                  ["Organism", results.organism],
                  ["Markers", results.selectedGenes.length],
                  ["Drug classes", results.calls.length],
                ].map(([label, value]) => (
                  <div key={label as string} className="px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-sm text-foreground">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <Accordion type="multiple" className="divide-y divide-border">
                {results.calls.map((item: ResistanceCall, idx: number) => (
                  <AccordionItem
                    key={idx}
                    value={`item-${idx}`}
                    className="border-b-0 px-3"
                  >
                    <AccordionTrigger className="cursor-pointer py-2.5 hover:no-underline">
                      <div className="flex w-full items-center justify-between gap-3 pr-2">
                        <div className="min-w-0 text-left">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                            {item.drugClass}
                            {item.isSynergistic && <Chip tone="info">synergy</Chip>}
                          </p>
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.genes.length} marker
                            {item.genes.length !== 1 ? "s" : ""} detected
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {/* Confidence bar makes the score comparable at a
                              glance across rows. */}
                          <div className="hidden h-1 w-16 overflow-hidden rounded-full bg-[var(--wb-active)] sm:block">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                item.confidence.score >= 0.9
                                  ? "bg-destructive"
                                  : item.confidence.score >= 0.7
                                    ? "bg-warning"
                                    : "bg-muted-foreground/60",
                              )}
                              style={{ width: `${item.confidence.score * 100}%` }}
                            />
                          </div>
                          <Chip tone={getConfidenceTone(item.confidence.score)}>
                            {item.confidence.level} ·{" "}
                            {Math.round(item.confidence.score * 100)}%
                          </Chip>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-1 pb-3 font-mono text-xs text-muted-foreground">
                      <p>
                        <span className="text-foreground/70">genes:</span>{" "}
                        {item.genes.join(", ")}
                      </p>
                      <p>
                        <span className="text-foreground/70">drugs:</span>{" "}
                        {item.antibiotics.join(", ")}
                      </p>
                      <p>
                        <span className="text-foreground/70">mechanisms:</span>{" "}
                        {item.mechanisms.join(", ")}
                      </p>
                      {item.synergyNote && (
                        <p className="text-info">{item.synergyNote}</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Pane>
          </div>
        </ViewScroll>
      ) : (
        <EmptyState
          icon={FlaskConical}
          title="No analysis yet"
          description="Pick an organism and one or more detected genes in the inspector, then run the analysis to see the predicted resistance profile."
          action={<LastRunLink engine="amr" />}
        />
      )}
    </ViewLayout>
  )
}

/* ============================================================================
   Inspector
   ========================================================================= */

function PredictorInspector({
  organisms,
  selectedOrganism,
  setSelectedOrganism,
  selectedGenes,
  toggleGene,
  error,
  onAnalyze,
}: {
  organisms: string[]
  selectedOrganism: string
  setSelectedOrganism: (v: string) => void
  selectedGenes: string[]
  toggleGene: (g: string) => void
  error: string
  onAnalyze: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="seq-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Pane>
          <PaneHeader icon={Microscope} title="Organism" />
          <div className="p-3">
            <Select onValueChange={setSelectedOrganism} value={selectedOrganism}>
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder="Select an organism" />
              </SelectTrigger>
              <SelectContent>
                {organisms.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Pane>

        <Pane>
          <PaneHeader
            icon={Dna}
            title="Detected genes"
            subtitle={`${selectedGenes.length} selected`}
          />
          <div className="p-1.5">
            {DETECTED_GENES.map((label) => {
              const active = selectedGenes.includes(label)
              const entry = AMR_BY_GENE.get(label)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleGene(label)}
                  className={cn(
                    "row-hover flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left",
                    "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                    active && "bg-[var(--wb-active)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-xs border transition-colors duration-100",
                      active
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border",
                    )}
                  >
                    {active && <Check className="size-2.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-mono text-sm",
                        active ? "text-foreground" : "text-foreground/80",
                      )}
                    >
                      {label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground/75">
                      {entry?.drugClass}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground/70 tabular">
                    {Math.round((entry?.confidence ?? 0) * 100)}%
                  </span>
                </button>
              )
            })}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" /> {error}
            </p>
          )}
        </Pane>

        <Pane>
          <PaneHeader icon={Info} title="Tool limitations" />
          <div className="space-y-2 p-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              Markers are scored from published impact estimates. Clinical
              resistance is determined by susceptibility testing — this is not a
              diagnostic tool.
            </p>
            <Rule label="Notes" />
            <BulletList>
              <BulletItem>
                Confidence is literature-based; individual isolates vary
              </BulletItem>
              <BulletItem>
                The organism is recorded and used to flag unexpected markers, but
                does not change the score
              </BulletItem>
              {SYNERGY_RULES.map((rule) => (
                <BulletItem key={rule.drugClass + rule.genes.join()}>
                  <span className="font-mono text-foreground/70">
                    {rule.genes.join(" + ")}
                  </span>{" "}
                  raises {rule.drugClass} to{" "}
                  {Math.round(rule.boostedConfidence * 100)}%
                </BulletItem>
              ))}
            </BulletList>
          </div>
        </Pane>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Button
          onClick={onAnalyze}
          disabled={selectedGenes.length === 0}
          className="h-8 w-full"
        >
          <FlaskConical className="size-3.5" />
          Analyse resistance profile
        </Button>
      </div>
    </div>
  )
}

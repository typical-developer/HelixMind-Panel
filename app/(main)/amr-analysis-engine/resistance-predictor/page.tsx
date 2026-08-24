"use client"

import React, { useMemo, useState } from "react"
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
import {
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
  useStatusItems,
  useViewContext,
  type WorkbenchAlert,
} from "@/components/workbench"

const amrDatabase = {
  "blaCTX-M": { antibiotic: "Ceftriaxone", drugClass: "Cephalosporins", mechanism: "ESBL", impact: 0.95 },
  "blaOXA-48": { antibiotic: "Meropenem", drugClass: "Carbapenems", mechanism: "Carbapenemase", impact: 0.98 },
  mecA: { antibiotic: "Oxacillin", drugClass: "Beta-lactams", mechanism: "PBP2a", impact: 0.99 },
  vanA: { antibiotic: "Vancomycin", drugClass: "Glycopeptides", mechanism: "Cell wall remodeling", impact: 0.99 },
  gyrA: { antibiotic: "Ciprofloxacin", drugClass: "Fluoroquinolones", mechanism: "DNA Gyrase mutation", impact: 0.4 },
  parC: { antibiotic: "Ciprofloxacin", drugClass: "Fluoroquinolones", mechanism: "Topoisomerase IV mutation", impact: 0.4 },
  tetM: { antibiotic: "Tetracycline", drugClass: "Tetracyclines", mechanism: "Ribosomal protection", impact: 0.7 },
}

const DETECTED_GENES = ["blaCTX-M", "blaOXA-48", "gyrA", "mecA", "parC", "tetM", "vanA"]

export default function ResistancePredictorPage() {
  const [selectedOrganism, setSelectedOrganism] = useState("E. coli")
  const [selectedGenes, setSelectedGenes] = useState<string[]>([])
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const organisms = ["E. coli", "K. pneumoniae", "S. aureus", "Enterococcus faecium"]

  const synergyRules = [
    {
      genesRequired: ["gyrA", "parC"],
      result: { drugClass: "Fluoroquinolones", boostedImpact: 0.9, note: "Dual mutations in gyrA and parC confer high-level resistance." },
    },
  ]

  const toggleGene = (label: string) => {
    setSelectedGenes((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    )
  }

  const analyzeResistance = () => {
    if (!selectedGenes.length) {
      setError("Please select at least one gene")
      return
    }

    setLoading(true)
    setError("")

    try {
      const report: any = {}

      selectedGenes.forEach((geneName) => {
        const entry = amrDatabase[geneName as keyof typeof amrDatabase]
        if (!entry) return

        const drugClass = entry.drugClass

        if (!report[drugClass]) {
          report[drugClass] = { class: drugClass, maxImpact: 0, detectedMarkers: [], mechanisms: [] }
        }

        report[drugClass].detectedMarkers.push(geneName)
        report[drugClass].mechanisms.push(entry.mechanism)

        if (entry.impact > report[drugClass].maxImpact) {
          report[drugClass].maxImpact = entry.impact
        }
      })

      synergyRules.forEach((rule) => {
        const hasAll = rule.genesRequired.every((g) => selectedGenes.includes(g))
        if (hasAll && report[rule.result.drugClass]) {
          report[rule.result.drugClass].maxImpact = rule.result.boostedImpact
          report[rule.result.drugClass].isSynergistic = true
        }
      })

      const resistanceProfile = Object.values(report).map((item: any) => ({
        antibiotic: item.class,
        confidence: {
          level: item.maxImpact >= 0.9 ? "High" : item.maxImpact >= 0.7 ? "Medium" : "Low",
          score: item.maxImpact,
        },
        genes: item.detectedMarkers,
        mechanisms: item.mechanisms,
        isSynergistic: item.isSynergistic || false,
      }))

      setResults({
        organism: selectedOrganism,
        selectedGenes,
        resistanceProfile,
        timestamp: new Date().toLocaleString(),
      })
    } catch (err: any) {
      setError("Error analyzing resistance profile: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    if (!results) return

    const report = {
      metadata: {
        organism: results.organism,
        timestamp: results.timestamp,
        disclaimer: "Research tool only. Not for clinical use.",
        modelType: "Rule-based (Synergy-aware)",
      },
      detectedResistance: results.resistanceProfile,
      genesAnalyzed: results.selectedGenes,
    }

    const element = document.createElement("a")
    element.setAttribute(
      "href",
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2))
    )
    element.setAttribute("download", `amr_report_${Date.now()}.json`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
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
        for (const item of results.resistanceProfile) {
          if (item.confidence.score >= 0.9) {
            list.push({
              source: "amr-engine",
              severity: "warning",
              message: `High-confidence resistance predicted for ${item.antibiotic} (${item.genes.join(", ")})`,
              at: results.organism,
            })
          }
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
              `${results.resistanceProfile.length} drug class(es) implicated`,
              ...results.resistanceProfile.map(
                (i: any) =>
                  `${i.antibiotic}: ${i.confidence.level} (${Math.round(i.confidence.score * 100)}%)${i.isSynergistic ? " · synergy applied" : ""}`,
              ),
            ]
          : [],
      [results],
    ),
  )

  useStatusItems(
    useMemo(
      () => [
        { id: "organism", label: selectedOrganism },
        {
          id: "genes",
          label: `${selectedGenes.length} marker${selectedGenes.length === 1 ? "" : "s"}`,
          tone: selectedGenes.length ? ("info" as const) : ("default" as const),
        },
      ],
      [selectedOrganism, selectedGenes.length],
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
          loading={loading}
          onAnalyze={analyzeResistance}
        />
      }
    >
      {results ? (
        <ViewScroll>
          <div className="flex flex-col gap-3 p-3">
            <Pane>
              <PaneHeader
                icon={Sparkles}
                title="Analysis results"
                subtitle={results.timestamp}
                actions={
                  <ToolbarButton
                    icon={DownloadIcon}
                    label="Export report as JSON"
                    onClick={exportReport}
                  />
                }
              />

              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[
                  ["Organism", results.organism],
                  ["Markers", results.selectedGenes.length],
                  ["Drug classes", results.resistanceProfile.length],
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
                {results.resistanceProfile.map((item: any, idx: number) => (
                  <AccordionItem
                    key={idx}
                    value={`item-${idx}`}
                    className="border-b-0 px-3"
                  >
                    <AccordionTrigger className="cursor-pointer py-2.5 hover:no-underline">
                      <div className="flex w-full items-center justify-between gap-3 pr-2">
                        <div className="min-w-0 text-left">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                            {item.antibiotic}
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
                        <span className="text-foreground/70">mechanisms:</span>{" "}
                        {item.mechanisms.join(", ")}
                      </p>
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
  loading,
  onAnalyze,
}: {
  organisms: string[]
  selectedOrganism: string
  setSelectedOrganism: (v: string) => void
  selectedGenes: string[]
  toggleGene: (g: string) => void
  error: string
  loading: boolean
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
              const entry = amrDatabase[label as keyof typeof amrDatabase]
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
                    {Math.round((entry?.impact ?? 0) * 100)}%
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
            <ul className="list-disc space-y-1 pl-4">
              <li>Impact scoring is literature-based; individual variation occurs</li>
              <li>Synergy rules apply only for specific marker combinations</li>
            </ul>
          </div>
        </Pane>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Button
          onClick={onAnalyze}
          disabled={loading || selectedGenes.length === 0}
          className="h-8 w-full"
        >
          <FlaskConical className="size-3.5" />
          {loading ? "Analyzing…" : "Analyze resistance profile"}
        </Button>
      </div>
    </div>
  )
}

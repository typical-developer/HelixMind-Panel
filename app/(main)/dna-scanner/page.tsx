"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  DownloadIcon,
  FileText,
  Info,
  Loader2,
  Play,
  ScanLine,
  Upload,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { recordActivity } from "@/lib/activity-store"
import { archiveRun } from "@/lib/run-archive"
import { LastRunLink } from "@/components/last-run"
import { saveScanSnapshot } from "@/lib/lab-snapshot"
import { copyToClipboard, downloadCSV, downloadJSON, fileStamp } from "@/lib/download"
import { formatBytes } from "@/lib/storage"
import {
  FASTA_EXTENSIONS,
  callMutations,
  parseFasta,
  qualityWarnings,
  sequenceStats,
  validateFastaFile,
  type CalledMutation,
  type FastaSequence,
  type QualityWarning,
  type SequenceStats,
} from "@/lib/fasta"
import {
  Chip,
  ViewLayout,
  ViewScroll,
  EmptyState,
  InspectorScroll,
  Pane,
  PaneHeader,
  RowIcon,
  Rule,
  StatTile,
  ToolbarButton,
  WBSelect,
  useLogStream,
  useAlerts,
  useRunStatus,
  useStatusItems,
  useViewContext,
  type WorkbenchAlert,
} from "@/components/workbench"

interface Analysis {
  stats: SequenceStats
  mutations: CalledMutation[]
  warnings: QualityWarning[]
}

/**
 * Ceilings on what a scan contributes to the run archive.
 *
 * Generous enough that a routine bacterial isolate is archived whole, small
 * enough that one large scan cannot evict every other run. The counts the
 * archive reports are the *real* ones — only the stored detail is bounded, and
 * the run detail view says so rather than quietly showing a subset.
 */
const ARCHIVE_BASES = 20_000
const ARCHIVE_MUTATIONS = 5_000

/**
 * Yield so the spinner paints before a long synchronous pass.
 *
 * Races a frame against a timer rather than awaiting `requestAnimationFrame`
 * alone: rAF does not fire at all while the tab is in the background, so a
 * scan started and then left in another tab would wait on a callback that
 * never came and sit on "Analysing…" forever. The timer guarantees the pass
 * still runs; the frame keeps it paint-accurate when the tab is visible.
 */
const YIELD_TIMEOUT = 50

const nextFrame = () =>
  new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(done)
    window.setTimeout(done, YIELD_TIMEOUT)
  })

export default function DNAScanner() {
  const [activeTab, setActiveTab] = useState<"stats" | "mutations" | "sequence">(
    "stats",
  )

  const [fastaFile, setFastaFile] = useState<File | undefined>(undefined)
  const [referenceFile, setReferenceFile] = useState<File | undefined>(undefined)

  const [targets, setTargets] = useState<FastaSequence[]>([])
  const [reference, setReference] = useState<FastaSequence | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string>("")

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [hasScanned, setHasScanned] = useState(false)
  /**
   * What the scanner is doing right now.
   *
   * The whole scan used to be synchronous with no state at all: pressing "Run
   * DNA scan" on the 3 MB genome in `test-files/` froze the tab for as long as
   * it took, with the button still reading "Run DNA scan" and nothing on
   * screen changing. The view is registered as `runnable` in the workbench
   * registry, so it also never published the run status the Runs sidebar and
   * status bar exist to show.
   */
  const [phase, setPhase] = useState<"idle" | "reading" | "analysing">("idle")

  const fastaInputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  /** Guards against an out-of-order analysis overwriting a newer one. */
  const analysisToken = useRef(0)

  const activeSequence = useMemo(
    () => targets.find((s) => s.id === selectedTargetId),
    [targets, selectedTargetId],
  )

  /* ---- Inputs ----------------------------------------------------------- */

  /** Shared by the file picker and the drop target. */
  const assignFile = useCallback((id: string, file: File) => {
    const check = validateFastaFile(file)
    if (!check.ok) {
      // Every upload path used to accept anything and read it as text, so a
      // PDF produced an empty sequence list and a results pane that just said
      // "select a target sequence".
      toast({
        variant: "destructive",
        title: "That file can't be scanned",
        description: check.error,
      })
      return
    }

    if (id === "fasta_file") setFastaFile(file)
    if (id === "reference_file") setReferenceFile(file)
    toast({
      variant: "success",
      title: id === "fasta_file" ? "Target loaded" : "Reference loaded",
      description: `${file.name} · ${formatBytes(file.size)}`,
    })
  }, [])

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      assignFile(event.target.id, file)
      // Let the same file be chosen again after a rejection.
      event.target.value = ""
    },
    [assignFile],
  )

  /* ---- Analysis --------------------------------------------------------- */

  const analyse = useCallback(
    (target: FastaSequence, ref: FastaSequence | null): Analysis => {
      const stats = sequenceStats(target.sequence)
      const mutations = ref ? callMutations(target.sequence, ref.sequence) : []
      return { stats, mutations, warnings: qualityWarnings(stats, target, ref) }
    },
    [],
  )

  const publishResult = useCallback(
    (target: FastaSequence, ref: FastaSequence | null, result: Analysis) => {
      saveScanSnapshot({
        header: target.header,
        referenceHeader: ref?.header,
        length: target.sequence.length,
        gcContent: result.stats.gcContent,
        preview: target.sequence,
        mutationCount: result.mutations.length,
        mutations: result.mutations.map((m) => ({
          position: m.position,
          refBase: m.refBase,
          varBase: m.varBase,
          substitution: m.substitution,
        })),
      })
    },
    [],
  )

  const handleRunScan = useCallback(async () => {
    if (!fastaFile || phase !== "idle") return

    const token = ++analysisToken.current
    const startedAt = Date.now()
    setPhase("reading")

    try {
      const fastaText = await fastaFile.text()
      const parsedTargets = parseFasta(fastaText)

      if (parsedTargets.length === 0) {
        setPhase("idle")
        toast({
          variant: "destructive",
          title: "No sequences found",
          description: `${fastaFile.name} contains no FASTA records. Check that each sequence begins with a '>' header line.`,
        })
        return
      }

      let parsedReference: FastaSequence | null = null
      if (referenceFile) {
        const refText = await referenceFile.text()
        parsedReference = parseFasta(refText)[0] ?? null
        if (!parsedReference) {
          toast({
            variant: "warning",
            title: "Reference unreadable",
            description: `No FASTA records in ${referenceFile.name} — the scan will run without mutation calling.`,
          })
        }
      }

      if (token !== analysisToken.current) return

      setPhase("analysing")
      setTargets(parsedTargets)
      setReference(parsedReference)
      setSelectedTargetId(parsedTargets[0].id)
      // Let the status bar and the button paint before the heavy pass.
      await nextFrame()

      const result = analyse(parsedTargets[0], parsedReference)
      if (token !== analysisToken.current) return

      setAnalysis(result)
      setHasScanned(true)
      setPhase("idle")
      publishResult(parsedTargets[0], parsedReference, result)

      recordActivity({
        kind: "scan.completed",
        engine: "scanner",
        label: `${fastaFile.name} scanned`,
        detail: `${parsedTargets.length} sequence${
          parsedTargets.length === 1 ? "" : "s"
        }${parsedReference ? ` · ${result.mutations.length} variant${result.mutations.length === 1 ? "" : "s"}` : ""}`,
        href: "/dna-scanner",
        severity: result.mutations.length > 0 ? "warning" : "success",
        value: parsedTargets.length,
      })

      // The result itself, kept so it can be reopened after you have moved on.
      // Deliberately fire-and-forget: filing the record is not on the critical
      // path of showing it, and `archiveRun` never rejects.
      void archiveRun({
        engine: "scanner",
        label: `${fastaFile.name} scanned`,
        detail: `${parsedTargets.length} sequence${
          parsedTargets.length === 1 ? "" : "s"
        }${parsedReference ? ` · ${result.mutations.length} variant${result.mutations.length === 1 ? "" : "s"}` : ""}`,
        startedAt,
        endedAt: Date.now(),
        outcome: "completed",
        href: "/dna-scanner",
        inputs: {
          file: fastaFile.name,
          header: parsedTargets[0].header,
          length: parsedTargets[0].sequence.length,
          sequenceCount: parsedTargets.length,
          referenceFile: referenceFile?.name ?? null,
          referenceHeader: parsedReference?.header ?? null,
        },
        params: { calledAgainstReference: Boolean(parsedReference) },
        summary: {
          sequences: parsedTargets.length,
          length: parsedTargets[0].sequence.length,
          gcContent: Number(result.stats.gcContent.toFixed(2)),
          variants: result.mutations.length,
          warnings: result.warnings.length,
        },
        payload: {
          stats: result.stats,
          // Both lists are bounded. A whole genome is the operator's own file
          // and can be re-read; what the panel owes them is what it *derived*,
          // and a 32MB strand in the archive would evict every other run to
          // store something they already have on disk.
          mutations: result.mutations.slice(0, ARCHIVE_MUTATIONS),
          mutationCount: result.mutations.length,
          warnings: result.warnings,
          preview: parsedTargets[0].sequence.slice(0, ARCHIVE_BASES),
          previewOf: parsedTargets[0].sequence.length,
          referenceHeader: parsedReference?.header ?? null,
          sequences: parsedTargets.map((s) => ({
            header: s.header,
            length: s.sequence.length,
          })),
        },
      })
    } catch (error) {
      // `File.text()` rejects on a file that has been moved or revoked since
      // it was picked, which nothing handled before.
      setPhase("idle")
      toast({
        variant: "destructive",
        title: "Scan failed",
        description:
          error instanceof Error ? error.message : "The file could not be read.",
      })
    }
  }, [analyse, fastaFile, phase, publishResult, referenceFile])

  /**
   * Re-analyse when the operator picks a different sequence from the file.
   *
   * Kept out of a `useMemo` on purpose: on a multi-megabase record the pass
   * takes long enough to drop frames, and a memo would run it during render
   * with nothing on screen to say why the view had stalled.
   */
  useEffect(() => {
    if (!hasScanned || !activeSequence) return
    // The scan handler already analysed whichever sequence it selected.
    if (analysis && analysis.stats.length === activeSequence.sequence.length) return

    let cancelled = false
    const token = ++analysisToken.current
    setPhase("analysing")

    void (async () => {
      await nextFrame()
      if (cancelled || token !== analysisToken.current) return
      const result = analyse(activeSequence, reference)
      if (cancelled || token !== analysisToken.current) return
      setAnalysis(result)
      setPhase("idle")
      publishResult(activeSequence, reference, result)
    })()

    return () => {
      cancelled = true
    }
    // `analysis` is deliberately omitted: it is what this effect writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSequence, analyse, hasScanned, publishResult, reference])

  const stats = analysis?.stats ?? null
  const mutations = useMemo(() => analysis?.mutations ?? [], [analysis])
  const warnings = useMemo(() => analysis?.warnings ?? [], [analysis])

  /* ---- Exports ---------------------------------------------------------- */

  const exportStats = () => {
    if (!stats || !activeSequence) return
    downloadJSON(
      {
        sequence: activeSequence.header,
        description: activeSequence.description,
        reference: reference?.header ?? null,
        statistics: stats,
        warnings: warnings.map((w) => w.message),
        generatedAt: new Date().toISOString(),
      },
      {
        filename: `${activeSequence.header}-stats-${fileStamp()}.json`,
        engine: "scanner",
        description: `Statistics for ${activeSequence.header}.`,
      },
    )
  }

  const exportMutations = () => {
    if (mutations.length === 0 || !activeSequence) return
    downloadCSV(
      ["Position", "Reference", "Variant", "Type", "Substitution"],
      mutations.map((m) => [
        m.position,
        m.refBase,
        m.varBase,
        m.type,
        m.substitution,
      ]),
      {
        filename: `${activeSequence.header}-variants-${fileStamp()}.csv`,
        engine: "scanner",
        description: `${mutations.length} variant${
          mutations.length === 1 ? "" : "s"
        } against ${reference?.header ?? "reference"}.`,
      },
    )
  }

  /* ---- Bench integration -----------------------------------------------
     What the scan flags goes to the console's Alerts tab, its progress to the
     run log, its headline figures to the status bar, and what it has loaded to
     the context bar. */

  useAlerts(
    "dna-scanner",
    useMemo<WorkbenchAlert[]>(
      () =>
        warnings.map((warning) => ({
          source: "dna-scanner",
          severity: warning.severity,
          message: warning.message,
          at: activeSequence?.header,
        })),
      [warnings, activeSequence],
    ),
  )

  const logLines = useMemo(() => {
    if (!hasScanned) return []
    const lines = [
      `parsed ${targets.length} target sequence(s) from ${fastaFile?.name ?? "input"}`,
    ]
    if (activeSequence) {
      lines.push(
        `analysing ${activeSequence.header} (${activeSequence.sequence.length.toLocaleString()} bp)`,
      )
    }
    if (reference) {
      lines.push(
        `reference loaded: ${reference.header} (${reference.sequence.length.toLocaleString()} bp)`,
      )
      lines.push(`called ${mutations.length} substitution(s) against reference`)
    } else {
      lines.push("no reference supplied — mutation calling skipped")
    }
    return lines
  }, [hasScanned, targets.length, fastaFile, reference, mutations.length, activeSequence])

  useLogStream("dna-scanner", logLines)

  useRunStatus(
    useMemo(() => {
      if (phase !== "idle") {
        return {
          label: "DNA scan",
          state: "running" as const,
          source: "dna-scanner",
          detail:
            phase === "reading"
              ? `reading ${fastaFile?.name ?? "input"}`
              : `analysing ${activeSequence?.header ?? "sequence"}`,
        }
      }
      // A finished scan has to report `done`, not disappear. Publishing null
      // straight from `running` looks to the provider exactly like a run whose
      // view unmounted mid-flight, so every successful scan was filed in the
      // history as "stopped" and raised a "runs end when you leave" warning.
      if (!hasScanned) return null
      return {
        label: "DNA scan",
        state: "done" as const,
        source: "dna-scanner",
        detail: activeSequence
          ? `${activeSequence.header} · ${mutations.length} variant${
              mutations.length === 1 ? "" : "s"
            }`
          : undefined,
      }
    }, [phase, fastaFile, activeSequence, hasScanned, mutations.length]),
  )

  useStatusItems(
    useMemo(
      () =>
        stats
          ? [
              {
                id: "len",
                label: `${stats.length.toLocaleString()} bp`,
                title: "Length of the selected sequence",
                onClick: () => setActiveTab("sequence"),
              },
              {
                id: "gc",
                label: `GC ${stats.gcContent.toFixed(1)}%`,
                title: "Guanine-cytosine content",
                onClick: () => setActiveTab("stats"),
              },
              {
                id: "mut",
                label: `${mutations.length} SNP`,
                title:
                  mutations.length > 0
                    ? "Substitutions called against the reference"
                    : "No differences from the reference",
                tone: mutations.length > 0 ? ("warning" as const) : ("default" as const),
                onClick: () => setActiveTab("mutations"),
              },
            ]
          : [],
      [stats, mutations.length],
    ),
  )

  useViewContext(
    activeSequence
      ? [
          activeSequence.header,
          reference ? `reference ${reference.header}` : "no reference loaded",
        ].join(" · ")
      : null,
  )

  const TABS = [
    { id: "stats" as const, label: "Statistics" },
    { id: "mutations" as const, label: "Mutations", count: mutations.length },
    { id: "sequence" as const, label: "Sequence" },
  ]

  return (
    <ViewLayout
      inspectorId="dna-scanner"
      defaultInspectorSize={30}
      inspector={
        <ScannerInspector
          fastaFile={fastaFile}
          referenceFile={referenceFile}
          onFileChange={handleFileChange}
          onFileDrop={assignFile}
          fastaInputRef={fastaInputRef}
          referenceInputRef={referenceInputRef}
          onRun={handleRunScan}
          phase={phase}
          targetSequences={targets}
          selectedTargetId={selectedTargetId}
          onSelectTarget={setSelectedTargetId}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Result toolbar — tabs on the left, exports on the right, mirroring
            the scan's readouts. */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="flex h-full min-h-0 flex-col gap-0"
        >
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
            <TabsList className="h-7 gap-0.5 bg-transparent p-0">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="h-7 gap-1.5 rounded-sm px-2.5 text-sm text-muted-foreground data-[state=active]:bg-[var(--wb-active)] data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {t.label}
                  {t.count ? <Chip tone="warning">{t.count}</Chip> : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="ml-auto flex items-center gap-0.5">
              <ToolbarButton
                icon={DownloadIcon}
                label="Export statistics as JSON"
                onClick={exportStats}
                disabled={!stats}
              />
              <ToolbarButton
                icon={FileText}
                label="Export mutations as CSV"
                onClick={exportMutations}
                disabled={mutations.length === 0}
              />
            </div>
          </div>

          {phase !== "idle" ? (
            <ScanProgress
              phase={phase}
              filename={fastaFile?.name}
              header={activeSequence?.header}
            />
          ) : !hasScanned ? (
            <EmptyState
              icon={ScanLine}
              title="No scan results yet"
              description="Upload a target sequence in the inspector and run a scan to see statistics, called mutations and the sequence buffer."
              action={<LastRunLink engine="scanner" />}
            />
          ) : (
            <div className="animate-fade-in min-h-0 flex-1">
              <TabsContent value="stats" className="h-full min-h-0">
                <ViewScroll className="p-3">
                  <StatsView stats={stats} warnings={warnings} />
                </ViewScroll>
              </TabsContent>

              <TabsContent value="mutations" className="h-full min-h-0">
                <MutationsView reference={reference} mutations={mutations} />
              </TabsContent>

              <TabsContent value="sequence" className="h-full min-h-0">
                <SequenceView sequence={activeSequence} />
              </TabsContent>
            </div>
          )}
        </Tabs>
      </div>
    </ViewLayout>
  )
}

/* ============================================================================
   Result views
   ========================================================================= */

/**
 * Shown while a scan is in flight.
 *
 * A megabase genome takes a second or two to parse and analyse, and the view
 * previously showed the previous result — or an empty state — throughout, so
 * there was no way to tell a slow scan from one that had not started.
 */
function ScanProgress({
  phase,
  filename,
  header,
}: {
  phase: "reading" | "analysing"
  filename?: string
  header?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {phase === "reading" ? "Reading the file" : "Analysing the sequence"}
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {phase === "reading"
            ? `Parsing ${filename ?? "the uploaded file"}.`
            : `Computing statistics and calling variants for ${header ?? "the selected sequence"}.`}
        </p>
      </div>
      <div className="h-0.5 w-48 overflow-hidden rounded-full bg-[var(--wb-active)]">
        <div className="animate-progress-sweep h-full w-full" />
      </div>
    </div>
  )
}

function StatsView({
  stats,
  warnings,
}: {
  stats: SequenceStats | null
  warnings: QualityWarning[]
}) {
  if (!stats) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a target sequence to see its statistics.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 @sm/bench:grid-cols-2 @4xl/bench:grid-cols-4">
        <StatTile label="Length (bp)" value={stats.length.toLocaleString()} />
        <StatTile label="GC content" value={`${stats.gcContent.toFixed(1)}%`} />
        <StatTile
          label="Ambiguous (N)"
          value={stats.nCount.toLocaleString()}
          tone={stats.nCount > 0 ? "warning" : "default"}
        />
        <StatTile label="Putative ORFs" value={stats.orfs.toLocaleString()} />
      </div>

      {/* GC content plotted against the 40–60% band most bacterial genomes sit
          in, so the number has somewhere to sit. */}
      <Pane>
        <PaneHeader title="GC distribution" subtitle="target vs typical range" />
        <div className="space-y-2 p-3">
          <div className="relative h-2 overflow-hidden rounded-full bg-[var(--wb-active)]">
            <div className="absolute inset-y-0 left-[40%] w-[20%] bg-[var(--alpha-200)]" />
            <div
              className="absolute inset-y-0 w-0.5 rounded-full bg-foreground/70"
              style={{ left: `${Math.min(100, Math.max(0, stats.gcContent))}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-xs text-muted-foreground tabular">
            <span>0%</span>
            <span className="text-foreground/80">{stats.gcContent.toFixed(1)}%</span>
            <span>100%</span>
          </div>
        </div>
      </Pane>

      {warnings.length > 0 && (
        <Pane className="animate-rise-in border-warning/30">
          <PaneHeader
            icon={AlertTriangle}
            title="Quality warnings"
            subtitle={`${warnings.length} issue${warnings.length !== 1 ? "s" : ""}`}
            className="text-warning"
          />
          <ul className="animate-stagger divide-y divide-border/60">
            {warnings.map((warning, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 px-3 py-2 text-sm",
                  warning.severity === "error"
                    ? "text-destructive/90"
                    : "text-warning/90",
                )}
              >
                <RowIcon icon={AlertTriangle} />
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </Pane>
      )}
    </div>
  )
}

function MutationsView({
  reference,
  mutations,
}: {
  reference: FastaSequence | null
  mutations: CalledMutation[]
}) {
  if (!reference) {
    return (
      <EmptyState
        icon={Upload}
        title="Reference missing"
        description="Upload a reference FASTA in the inspector to call mutations against it."
      />
    )
  }

  if (mutations.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="No mutations detected"
        description="The target sequence matches the reference at every compared position."
      />
    )
  }

  return (
    <div className="seq-scroll h-full min-h-0 overflow-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-border">
            {["Position", "Reference", "Variant", "Type", "Substitution"].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mutations.map((m) => (
            <tr
              key={m.position}
              className="row-hover border-b border-border/50 last:border-0"
            >
              <td className="px-3 py-2 font-mono text-foreground tabular">
                {m.position.toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-muted-foreground">
                {m.refBase}
              </td>
              <td className="px-3 py-2 font-mono font-semibold text-destructive">
                {m.varBase}
              </td>
              <td className="px-3 py-2">
                <Chip>{m.type}</Chip>
              </td>
              <td className="px-3 py-2">
                <Chip tone={m.substitution === "transversion" ? "warning" : "neutral"}>
                  {m.substitution}
                </Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SEQ_BASES_PER_ROW = 80
const SEQ_PREVIEW_BASES = 4000

function SequenceView({ sequence }: { sequence: FastaSequence | undefined }) {
  const rows = useMemo(() => {
    if (!sequence) return []
    const preview = sequence.sequence.slice(0, SEQ_PREVIEW_BASES)
    const out: Array<{ start: number; text: string }> = []
    for (let i = 0; i < preview.length; i += SEQ_BASES_PER_ROW) {
      out.push({ start: i, text: preview.slice(i, i + SEQ_BASES_PER_ROW) })
    }
    return out
  }, [sequence])

  if (!sequence) {
    return (
      <EmptyState
        icon={FileText}
        title="No sequence loaded"
        description="Upload a FASTA file to view its bases here."
      />
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-xs text-muted-foreground">
        <span className="truncate font-mono text-foreground/80">
          {sequence.header}
        </span>
        <span className="tabular">
          {sequence.sequence.length.toLocaleString()} bp
        </span>
        <div className="ml-auto">
          <ToolbarButton
            icon={Copy}
            label="Copy full sequence"
            onClick={() =>
              copyToClipboard(
                sequence.sequence,
                `Copied ${sequence.sequence.length.toLocaleString()} bases`,
              )
            }
          />
        </div>
      </div>

      <div className="seq-scroll min-h-0 flex-1 overflow-auto bg-[var(--wb-inset)] py-2 font-mono text-xs leading-5">
        {rows.map((row) => (
          <div key={row.start} className="flex transition-colors duration-100 hover:bg-[var(--wb-hover)]">
            <span className="gutter-num sticky left-0 w-20 shrink-0 bg-[var(--wb-inset)] pr-3">
              {row.start + 1}
            </span>
            <span className="pr-4 tracking-wider whitespace-pre text-foreground/80">
              {row.text}
            </span>
          </div>
        ))}
        {sequence.sequence.length > SEQ_PREVIEW_BASES && (
          <div className="flex">
            <span className="w-20 shrink-0" />
            <span className="px-1 text-muted-foreground/70">
              …{" "}
              {(sequence.sequence.length - SEQ_PREVIEW_BASES).toLocaleString()} more
              bases truncated for preview
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================================
   Inspector
   ========================================================================= */

function ScannerInspector({
  fastaFile,
  referenceFile,
  onFileChange,
  onFileDrop,
  fastaInputRef,
  referenceInputRef,
  onRun,
  phase,
  targetSequences,
  selectedTargetId,
  onSelectTarget,
}: {
  fastaFile?: File
  referenceFile?: File
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileDrop: (id: string, file: File) => void
  fastaInputRef: React.RefObject<HTMLInputElement | null>
  referenceInputRef: React.RefObject<HTMLInputElement | null>
  onRun: () => void
  phase: "idle" | "reading" | "analysing"
  targetSequences: FastaSequence[]
  selectedTargetId: string
  onSelectTarget: (id: string) => void
}) {
  const busy = phase !== "idle"

  return (
    <InspectorScroll>
      <Pane>
        <PaneHeader icon={Upload} title="Inputs" />
        <div className="space-y-3 p-3">
          <DropZone
            id="fasta_file"
            title="Target sequence"
            subtitle="FASTA — the sequence to analyse"
            required
            file={fastaFile}
            onChange={onFileChange}
            onFileDrop={onFileDrop}
            inputRef={fastaInputRef}
            disabled={busy}
          />
          <DropZone
            id="reference_file"
            title="Reference genome"
            subtitle="Needed for mutation calling"
            file={referenceFile}
            onChange={onFileChange}
            onFileDrop={onFileDrop}
            inputRef={referenceInputRef}
            disabled={busy}
          />

          <Button
            onClick={onRun}
            disabled={!fastaFile || busy}
            className="h-8 w-full"
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {phase === "reading" ? "Reading…" : "Analysing…"}
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                Run DNA scan
              </>
            )}
          </Button>

          {!fastaFile && (
            <p className="text-xs leading-relaxed text-muted-foreground/70">
              A target sequence is required. A reference is optional — without
              one the scanner reports statistics but calls no variants.
            </p>
          )}
        </div>
      </Pane>

      {targetSequences.length > 0 && (
        <Pane>
          <PaneHeader
            title="Target"
            subtitle={`${targetSequences.length} in file`}
          />
          <div className="p-3">
            <WBSelect
              value={selectedTargetId}
              onChange={(e) => onSelectTarget(e.target.value)}
              aria-label="Active target sequence"
              disabled={busy}
            >
              {targetSequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.header} · {s.sequence.length.toLocaleString()} bp
                </option>
              ))}
            </WBSelect>
          </div>
        </Pane>
      )}

      <Pane>
        <PaneHeader icon={Info} title="About this step" />
        <div className="space-y-2 p-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            The scanner parses FASTA records, reports per-sequence statistics
            and — given a reference — calls substitutions between the two.
          </p>
          <Rule label="Alignment" />
          <p>
            Comparison is position-to-position with no gap handling, so an
            insertion or deletion shifts every downstream call. Sequences of
            noticeably different lengths are flagged in the console.
          </p>
          <Rule label="Accepts" />
          <p className="font-mono text-foreground/70">
            {FASTA_EXTENSIONS.join("  ")}
          </p>
        </div>
      </Pane>
    </InspectorScroll>
  )
}

function DropZone({
  id,
  title,
  subtitle,
  required,
  file,
  onChange,
  onFileDrop,
  inputRef,
  disabled,
}: {
  id: string
  title: string
  subtitle: string
  required?: boolean
  file?: File
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileDrop: (id: string, file: File) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  disabled?: boolean
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <label
      htmlFor={disabled ? undefined : id}
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (disabled) return
        e.preventDefault()
        setDragging(false)
        const dropped = e.dataTransfer.files?.[0]
        if (dropped) onFileDrop(id, dropped)
      }}
      className={cn(
        "group flex flex-col gap-1.5 rounded-md border border-dashed border-border p-3 transition-colors duration-150",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-[var(--wb-border-strong)] hover:bg-[var(--wb-hover)]",
        dragging && "border-brand bg-brand/10",
      )}
    >
      <div className="flex items-center gap-2">
        <Upload
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            dragging ? "text-foreground" : "group-hover:-translate-y-0.5",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {title}
        </span>
        <Chip tone={required ? "danger" : "neutral"}>
          {required ? "required" : "optional"}
        </Chip>
      </div>
      <p className="text-xs text-muted-foreground/80">{subtitle}</p>

      <input
        type="file"
        name={id}
        id={id}
        className="hidden"
        accept={FASTA_EXTENSIONS.join(",")}
        onChange={onChange}
        ref={inputRef}
        disabled={disabled}
      />

      {file && (
        <div className="mt-1 flex items-center gap-1.5 rounded-sm border border-border bg-[var(--wb-raised)] px-2 py-1 text-xs">
          <FileText className="size-3 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-foreground/85">
            {file.name}
          </span>
          <span className="shrink-0 text-muted-foreground tabular">
            {formatBytes(file.size)}
          </span>
        </div>
      )}
    </label>
  )
}

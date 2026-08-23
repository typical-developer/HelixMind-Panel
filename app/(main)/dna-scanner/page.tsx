"use client"

import { useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  DownloadIcon,
  FileText,
  Info,
  Play,
  ScanLine,
  Upload,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Chip,
  ViewLayout,
  ViewScroll,
  EmptyState,
  Pane,
  PaneHeader,
  Rule,
  StatTile,
  ToolbarButton,
  WBSelect,
  useLogStream,
  useAlerts,
  useStatusItems,
  useViewContext,
  type WorkbenchAlert,
} from "@/components/workbench"

// --- Types ---
interface FastaSequence {
  id: string
  header: string
  sequence: string
}

interface Mutation {
  position: number
  refBase: string
  varBase: string
  type: "SNP" | "Indel"
}

interface SequenceStats {
  length: number
  gcContent: number
  nCount: number
  orfs: number
}

export default function DNAScanner() {
  const [copied, setCopied] = useState(false)

  const handleCopySequence = async () => {
    if (!activeSequence) return
    await navigator.clipboard.writeText(activeSequence.sequence)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const [activeTab, setActiveTab] = useState<"stats" | "mutations" | "sequence">("stats")

  const [fasta_file, set_fasta_file] = useState<File | undefined>(undefined)
  const [reference_file, set_reference_file] = useState<File | undefined>(undefined)

  const [targetSequences, setTargetSequences] = useState<FastaSequence[]>([])
  const [referenceSequence, setReferenceSequence] = useState<FastaSequence | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string>("")

  const [hasScanned, setHasScanned] = useState(false)

  const fastaInputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)

  // --- FASTA Parser ---
  const parseFasta = (content: string): FastaSequence[] => {
    const parts = content.split(">")
    const sequences: FastaSequence[] = []

    parts.forEach((part, index) => {
      if (!part.trim()) return
      const lines = part.split("\n")
      const header = lines[0].split(/\s+/)[0]
      const seq = lines.slice(1).join("").toUpperCase().replace(/[^ATGCN]/g, "")

      if (seq.length > 0) {
        sequences.push({
          id: `seq_${index}_${Date.now()}`,
          header: header || `Sequence_${index + 1}`,
          sequence: seq,
        })
      }
    })

    return sequences
  }

  /** Shared by the file picker and the drop target. */
  const assignFile = (id: string, file: File) => {
    if (id === "fasta_file") set_fasta_file(file)
    if (id === "reference_file") set_reference_file(file)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    assignFile(event.target.id, file)
  }

  const handleRunScan = async () => {
    if (!fasta_file) return

    const fastaText = await fasta_file.text()
    const parsedTargets = parseFasta(fastaText)
    setTargetSequences(parsedTargets)
    setSelectedTargetId(parsedTargets[0]?.id || "")

    if (reference_file) {
      const refText = await reference_file.text()
      const parsedRefs = parseFasta(refText)
      setReferenceSequence(parsedRefs[0] || null)
    }

    setHasScanned(true)
  }

  const activeSequence = useMemo(
    () => targetSequences.find((s) => s.id === selectedTargetId),
    [targetSequences, selectedTargetId],
  )

  const stats: SequenceStats | null = useMemo(() => {
    if (!activeSequence) return null
    const seq = activeSequence.sequence
    const len = seq.length
    const gc = (seq.match(/[GC]/g) || []).length
    const n = (seq.match(/N/g) || []).length
    const orfs = (seq.match(/ATG(?:.{3})+?(?:TAA|TAG|TGA)/g) || []).length

    return {
      length: len,
      gcContent: len > 0 ? (gc / len) * 100 : 0,
      nCount: n,
      orfs,
    }
  }, [activeSequence])

  const mutations: Mutation[] = useMemo(() => {
    if (!activeSequence || !referenceSequence) return []

    const target = activeSequence.sequence
    const ref = referenceSequence.sequence
    const detected: Mutation[] = []
    const limit = Math.min(target.length, ref.length)

    for (let i = 0; i < limit; i++) {
      if (target[i] !== ref[i] && target[i] !== "N" && ref[i] !== "N") {
        detected.push({ position: i + 1, refBase: ref[i], varBase: target[i], type: "SNP" })
      }
    }
    return detected
  }, [activeSequence, referenceSequence])

  const warnings = useMemo(() => {
    const list: string[] = []
    if (!stats) return list
    if (stats.length < 200) list.push("Sequence is surprisingly short (<200bp).")
    if (stats.nCount > stats.length * 0.1) list.push("High ambiguity detected (>10% 'N's).")
    if (stats.length === 0) list.push("Sequence is empty.")
    if (
      referenceSequence &&
      activeSequence &&
      Math.abs(referenceSequence.sequence.length - activeSequence.sequence.length) > 100
    )
      list.push("Large length discrepancy between Target and Reference. Naive alignment may be inaccurate.")

    return list
  }, [stats, referenceSequence, activeSequence])

  const exportStats = () => {
    if (!stats || !activeSequence) return
    const data = { header: activeSequence.header, ...stats, warnings }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeSequence.header.substring(0, 10)}_stats.json`
    a.click()
  }

  const exportMutations = () => {
    if (mutations.length === 0) return
    const csvContent =
      "Position,Ref,Var,Type\n" +
      mutations.map((m) => `${m.position},${m.refBase},${m.varBase},${m.type}`).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mutations_vs_ref.csv`
    a.click()
  }

  /* ---- Bench integration -----------------------------------------------
     What the scan flags goes to the console's Alerts tab, its progress to the
     run log, its headline figures to the status bar, and what it has loaded to
     the context bar. */

  useAlerts(
    "dna-scanner",
    useMemo<WorkbenchAlert[]>(
      () =>
        warnings.map((message) => ({
          source: "dna-scanner",
          severity: "warning",
          message,
          at: activeSequence?.header,
        })),
      [warnings, activeSequence],
    ),
  )

  const logLines = useMemo(() => {
    if (!hasScanned) return []
    const lines = [
      `parsed ${targetSequences.length} target sequence(s) from ${fasta_file?.name ?? "input"}`,
    ]
    if (referenceSequence) {
      lines.push(`reference loaded: ${referenceSequence.header} (${referenceSequence.sequence.length} bp)`)
      lines.push(`called ${mutations.length} substitution(s) against reference`)
    } else {
      lines.push("no reference supplied — mutation calling skipped")
    }
    return lines
  }, [hasScanned, targetSequences.length, fasta_file, referenceSequence, mutations.length])

  useLogStream("dna-scanner", logLines)

  useStatusItems(
    useMemo(
      () =>
        stats
          ? [
              { id: "len", label: `${stats.length.toLocaleString()} bp` },
              { id: "gc", label: `GC ${stats.gcContent.toFixed(1)}%` },
              {
                id: "mut",
                label: `${mutations.length} SNP`,
                tone: mutations.length > 0 ? ("warning" as const) : ("default" as const),
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
          referenceSequence
            ? `reference ${referenceSequence.header}`
            : "no reference loaded",
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
          fastaFile={fasta_file}
          referenceFile={reference_file}
          onFileChange={handleFileChange}
          onFileDrop={assignFile}
          fastaInputRef={fastaInputRef}
          referenceInputRef={referenceInputRef}
          onRun={handleRunScan}
          targetSequences={targetSequences}
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

          {!hasScanned ? (
            <EmptyState
              icon={ScanLine}
              title="No scan results yet"
              description="Upload a target sequence in the inspector and run a scan to see statistics, called mutations and the sequence buffer."
            />
          ) : (
            <div className="min-h-0 flex-1">
              <TabsContent value="stats" className="h-full min-h-0">
                <ViewScroll className="p-3">
                  <StatsView stats={stats} warnings={warnings} />
                </ViewScroll>
              </TabsContent>

              <TabsContent value="mutations" className="h-full min-h-0">
                <MutationsView
                  referenceSequence={referenceSequence}
                  mutations={mutations}
                />
              </TabsContent>

              <TabsContent value="sequence" className="h-full min-h-0">
                <SequenceView
                  sequence={activeSequence}
                  copied={copied}
                  onCopy={handleCopySequence}
                />
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

function StatsView({
  stats,
  warnings,
}: {
  stats: SequenceStats | null
  warnings: string[]
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
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Length (bp)" value={stats.length.toLocaleString()} />
        <StatTile label="GC content" value={`${stats.gcContent.toFixed(1)}%`} />
        <StatTile
          label="Ambiguous (N)"
          value={stats.nCount}
          tone={stats.nCount > 0 ? "warning" : "default"}
        />
        <StatTile label="Putative ORFs" value={stats.orfs} />
      </div>

      {/* GC content plotted against the 40–60% band most bacterial genomes sit
          in, so the number has somewhere to sit. */}
      <Pane>
        <PaneHeader title="GC distribution" subtitle="target vs typical range" />
        <div className="space-y-2 p-3">
          <div className="relative h-2 overflow-hidden rounded-full bg-[var(--wb-active)]">
            <div className="absolute inset-y-0 left-[40%] w-[20%] bg-[var(--alpha-200)]" />
            <div
              className="absolute inset-y-0 w-0.5 rounded-full bg-brand-bright"
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
        <Pane className="border-warning/30">
          <PaneHeader
            icon={AlertTriangle}
            title="Quality warnings"
            subtitle={`${warnings.length} issue${warnings.length !== 1 ? "s" : ""}`}
            className="text-warning"
          />
          <ul className="divide-y divide-border/60">
            {warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-2 px-3 py-2 text-sm text-warning/90"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Pane>
      )}
    </div>
  )
}

function MutationsView({
  referenceSequence,
  mutations,
}: {
  referenceSequence: FastaSequence | null
  mutations: Mutation[]
}) {
  if (!referenceSequence) {
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
        description="The target sequence matches the reference at 100% identity."
      />
    )
  }

  return (
    <div className="seq-scroll h-full min-h-0 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-border">
            {["Position", "Reference", "Mutation", "Type"].map((h) => (
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
          {mutations.map((m, idx) => (
            <tr key={idx} className="row-hover border-b border-border/50 last:border-0">
              <td className="px-3 py-1.5 font-mono text-foreground">{m.position}</td>
              <td className="px-3 py-1.5 font-mono text-muted-foreground">{m.refBase}</td>
              <td className="px-3 py-1.5 font-mono font-semibold text-destructive">
                {m.varBase}
              </td>
              <td className="px-3 py-1.5">
                <Chip>{m.type}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SEQ_BASES_PER_ROW = 80

function SequenceView({
  sequence,
  copied,
  onCopy,
}: {
  sequence: FastaSequence | undefined
  copied: boolean
  onCopy: () => void
}) {
  const rows = useMemo(() => {
    if (!sequence) return []
    const preview = sequence.sequence.slice(0, 4000)
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
        <span className="truncate font-mono text-foreground/80">{sequence.header}</span>
        <span className="tabular">{sequence.sequence.length.toLocaleString()} bp</span>
        <div className="ml-auto">
          <ToolbarButton
            icon={copied ? Check : Copy}
            label={copied ? "Copied" : "Copy full sequence"}
            onClick={onCopy}
            className={cn(copied && "text-success")}
          />
        </div>
      </div>

      <div className="seq-scroll min-h-0 flex-1 overflow-auto bg-[hsl(0_0%_2%)] py-2 font-mono text-xs leading-5">
        {rows.map((row) => (
          <div key={row.start} className="flex hover:bg-[var(--wb-hover)]">
            <span className="gutter-num sticky left-0 w-20 shrink-0 bg-[hsl(0_0%_2%)] pr-3">
              {row.start + 1}
            </span>
            <span className="pr-4 tracking-wider whitespace-pre text-foreground/80">
              {row.text}
            </span>
          </div>
        ))}
        {sequence.sequence.length > 4000 && (
          <div className="flex">
            <span className="w-20 shrink-0" />
            <span className="px-1 text-muted-foreground/70">
              … {(sequence.sequence.length - 4000).toLocaleString()} more bases
              truncated for preview
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
  targetSequences: FastaSequence[]
  selectedTargetId: string
  onSelectTarget: (id: string) => void
}) {
  return (
    <div className="seq-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <Pane>
        <PaneHeader icon={Upload} title="Inputs" />
        <div className="space-y-3 p-3">
          <DropZone
            id="fasta_file"
            title="Target sequence"
            subtitle="Multi-FASTA or GenBank"
            required
            file={fastaFile}
            onChange={onFileChange}
            onFileDrop={onFileDrop}
            inputRef={fastaInputRef}
          />
          <DropZone
            id="reference_file"
            title="Reference genome"
            subtitle="Needed for mutation calling"
            file={referenceFile}
            onChange={onFileChange}
            onFileDrop={onFileDrop}
            inputRef={referenceInputRef}
          />

          <Button onClick={onRun} disabled={!fastaFile} className="h-8 w-full">
            <Play className="size-3.5" />
            Run DNA scan
          </Button>
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
            >
              {targetSequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.header} · {s.sequence.length} bp
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
            The scanner turns raw genomic files into a standardised sequence
            object that the simulators can consume.
          </p>
          <Rule label="Pipeline" />
          <p className="font-mono text-foreground/70">
            Multi-FASTA / GenBank → validated JSON map
          </p>
        </div>
      </Pane>
    </div>
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
}: {
  id: string
  title: string
  subtitle: string
  required?: boolean
  file?: File
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileDrop: (id: string, file: File) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const dropped = e.dataTransfer.files?.[0]
        if (dropped) onFileDrop(id, dropped)
      }}
      className={cn(
        "group flex cursor-pointer flex-col gap-1.5 rounded-md border border-dashed border-border p-3 transition-colors duration-150",
        "hover:border-[var(--wb-border-strong)] hover:bg-[var(--wb-hover)]",
        dragging && "border-brand bg-brand/10",
      )}
    >
      <div className="flex items-center gap-2">
        <Upload
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            dragging ? "text-brand-bright" : "group-hover:-translate-y-0.5",
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
        onChange={onChange}
        ref={inputRef}
      />

      {/* Small FASTA files are common, so step the unit down rather than
          rounding a 400-byte sequence to "0 KB". */}
      {file && (
        <div className="mt-1 flex items-center gap-1.5 rounded-sm border border-border bg-[var(--wb-raised)] px-2 py-1 text-xs">
          <FileText className="size-3 shrink-0 text-brand-bright" />
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

/** Byte count in the largest unit that keeps a non-zero leading digit. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

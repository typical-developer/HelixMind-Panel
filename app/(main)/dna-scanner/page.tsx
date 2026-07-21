"use client";

import {
  Upload,
  FileText,
  Info,
  DownloadIcon,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  Play,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";

// shadcn
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// --- Types ---
interface FastaSequence {
  id: string;
  header: string;
  sequence: string;
}

interface Mutation {
  position: number;
  refBase: string;
  varBase: string;
  type: "SNP" | "Indel";
}

interface SequenceStats {
  length: number;
  gcContent: number;
  nCount: number;
  orfs: number;
}

export default function DNAScanner() {
  const [copied, setCopied] = useState(false);

  const handleCopySequence = async () => {
    if (!activeSequence) return;
    await navigator.clipboard.writeText(activeSequence.sequence);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const [activeTab, setActiveTab] = useState<"stats" | "mutations" | "sequence">("stats");

  const [fasta_file, set_fasta_file] = useState<File | undefined>(undefined);
  const [reference_file, set_reference_file] = useState<File | undefined>(undefined);

  const [targetSequences, setTargetSequences] = useState<FastaSequence[]>([]);
  const [referenceSequence, setReferenceSequence] = useState<FastaSequence | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  const [hasScanned, setHasScanned] = useState(false);

  const fastaInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  // --- FASTA Parser ---
  const parseFasta = (content: string): FastaSequence[] => {
    const parts = content.split(">");
    const sequences: FastaSequence[] = [];

    parts.forEach((part, index) => {
      if (!part.trim()) return;
      const lines = part.split("\n");
      const header = lines[0].split(/\s+/)[0];
      const seq = lines.slice(1).join("").toUpperCase().replace(/[^ATGCN]/g, "");

      if (seq.length > 0) {
        sequences.push({
          id: `seq_${index}_${Date.now()}`,
          header: header || `Sequence_${index + 1}`,
          sequence: seq,
        });
      }
    });

    return sequences;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (event.target.id === "fasta_file") set_fasta_file(file);
    if (event.target.id === "reference_file") set_reference_file(file);
  };

  const handleRunScan = async () => {
    if (!fasta_file) return;

    const fastaText = await fasta_file.text();
    const parsedTargets = parseFasta(fastaText);
    setTargetSequences(parsedTargets);
    setSelectedTargetId(parsedTargets[0]?.id || "");

    if (reference_file) {
      const refText = await reference_file.text();
      const parsedRefs = parseFasta(refText);
      setReferenceSequence(parsedRefs[0] || null);
    }

    setHasScanned(true);
  };

  const activeSequence = useMemo(
    () => targetSequences.find((s) => s.id === selectedTargetId),
    [targetSequences, selectedTargetId]
  );

  const stats: SequenceStats | null = useMemo(() => {
    if (!activeSequence) return null;
    const seq = activeSequence.sequence;
    const len = seq.length;
    const gc = (seq.match(/[GC]/g) || []).length;
    const n = (seq.match(/N/g) || []).length;
    const orfs = (seq.match(/ATG(?:.{3})+?(?:TAA|TAG|TGA)/g) || []).length;

    return {
      length: len,
      gcContent: len > 0 ? (gc / len) * 100 : 0,
      nCount: n,
      orfs,
    };
  }, [activeSequence]);

  const mutations: Mutation[] = useMemo(() => {
    if (!activeSequence || !referenceSequence) return [];

    const target = activeSequence.sequence;
    const ref = referenceSequence.sequence;
    const detected: Mutation[] = [];
    const limit = Math.min(target.length, ref.length);

    for (let i = 0; i < limit; i++) {
      if (target[i] !== ref[i] && target[i] !== "N" && ref[i] !== "N") {
        detected.push({ position: i + 1, refBase: ref[i], varBase: target[i], type: "SNP" });
      }
    }
    return detected;
  }, [activeSequence, referenceSequence]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (!stats) return list;
    if (stats.length < 200) list.push("Sequence is surprisingly short (<200bp).");
    if (stats.nCount > stats.length * 0.1) list.push("High ambiguity detected (>10% 'N's).");
    if (stats.length === 0) list.push("Sequence is empty.");
    if (
      referenceSequence &&
      activeSequence &&
      Math.abs(referenceSequence.sequence.length - activeSequence.sequence.length) > 100
    )
      list.push("Large length discrepancy between Target and Reference. Naive alignment may be inaccurate.");

    return list;
  }, [stats, referenceSequence, activeSequence]);

  const exportStats = () => {
    if (!stats || !activeSequence) return;
    const data = { header: activeSequence.header, ...stats, warnings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSequence.header.substring(0, 10)}_stats.json`;
    a.click();
  };

  const exportMutations = () => {
    if (mutations.length === 0) return;
    const csvContent =
      "Position,Ref,Var,Type\n" +
      mutations.map((m) => `${m.position},${m.refBase},${m.varBase},${m.type}`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mutations_vs_ref.csv`;
    a.click();
  };

  const TABS = [
    { id: "stats" as const, label: "Statistics" },
    { id: "mutations" as const, label: `Mutations${mutations.length ? ` (${mutations.length})` : ""}` },
    { id: "sequence" as const, label: "Sequence" },
  ];

  return (
    <div className="ml-16 pt-16">
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8 pb-12 space-y-6">
        {/* info */}
        <div className="glass flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            The scanner prepares raw genomic data for simulation by converting unstructured files into
            a standardized Sequence Object. Input: Multi-FASTA/GenBank ➔ Output: Validated JSON Map.
          </p>
        </div>

        {/* uploads */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DropZone
            id="fasta_file"
            title="Target Sequence"
            subtitle="Drop your FASTA or GenBank file, or click to browse"
            badge={<Badge variant="failure">Required</Badge>}
            file={fasta_file}
            onChange={handleFileChange}
            inputRef={fastaInputRef}
          />
          <DropZone
            id="reference_file"
            title="Reference Genome"
            subtitle="Required for mutation calling. Upload a WT or reference genome"
            badge={<Badge variant="neutral">Optional</Badge>}
            file={reference_file}
            onChange={handleFileChange}
            inputRef={referenceInputRef}
          />
        </div>

        {/* run button */}
        <Button onClick={handleRunScan} disabled={!fasta_file} className="h-12 w-full text-base font-semibold">
          <Play className="h-4 w-4" />
          Run DNA Scan
        </Button>

        {/* ================= Analysis Panel ================= */}
        <div className="glass p-6">
          {/* Tabs + Actions */}
          <div className="mb-6 flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex rounded-lg border border-border bg-card/50 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                    activeTab === t.id
                      ? "bg-white/[0.1] text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportStats} disabled={!stats}>
                <DownloadIcon className="h-4 w-4" />
                JSON Stats
              </Button>
              <Button variant="outline" size="sm" onClick={exportMutations} disabled={mutations.length === 0}>
                <DownloadIcon className="h-4 w-4" />
                CSV Mutations
              </Button>
            </div>
          </div>

          {!hasScanned ? (
            <EmptyState />
          ) : (
            <>
              {/* Statistics */}
              {activeTab === "stats" && stats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <StatTile label="Length (bp)" value={stats.length.toLocaleString()} />
                    <StatTile label="GC Content" value={`${stats.gcContent.toFixed(1)}%`} />
                    <StatTile label="Ambiguous (N)" value={stats.nCount} />
                    <StatTile label="Putative ORFs" value={stats.orfs} />
                  </div>

                  {warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        {warnings.length} quality warning{warnings.length !== 1 ? "s" : ""}
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-xs text-amber-200/80">
                        {warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Mutations */}
              {activeTab === "mutations" && (
                <>
                  {!referenceSequence ? (
                    <div className="rounded-lg border border-dashed border-border p-12 text-center">
                      <p className="text-base font-semibold">Reference missing</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Upload a reference FASTA to identify mutations.
                      </p>
                    </div>
                  ) : mutations.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-emerald-400">
                      <CheckCircle className="h-10 w-10" />
                      <p className="text-sm font-medium">No mutations detected (100% identity vs reference)</p>
                    </div>
                  ) : (
                    <div className="seq-scroll max-h-80 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b border-border">
                            {["Position", "Reference", "Mutation", "Type"].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mutations.map((m, idx) => (
                            <tr key={idx} className="border-b border-border/40 transition-colors last:border-0 hover:bg-white/[0.03]">
                              <td className="px-4 py-2 font-mono tabular-nums">{m.position}</td>
                              <td className="px-4 py-2 font-mono text-muted-foreground">{m.refBase}</td>
                              <td className="px-4 py-2 font-mono font-bold text-destructive">{m.varBase}</td>
                              <td className="px-4 py-2">
                                <Badge variant="neutral">{m.type}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Sequence Preview */}
              {activeTab === "sequence" && (
                <div className="relative">
                  <button
                    onClick={handleCopySequence}
                    className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-3 py-1 text-xs text-white transition hover:bg-black"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <div className="seq-scroll max-h-[320px] overflow-auto rounded-lg border border-border bg-black/50 p-4 font-mono text-sm leading-relaxed text-foreground/80">
                    {activeSequence ? (
                      <>
                        {activeSequence.sequence.slice(0, 1000)}
                        {activeSequence.sequence.length > 1000 && (
                          <span className="text-muted-foreground"> ... (truncated for preview)</span>
                        )}
                      </>
                    ) : (
                      <p className="opacity-60">No FASTA file uploaded.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// --- Dropzone ---
function DropZone({
  id,
  title,
  subtitle,
  badge,
  file,
  onChange,
  inputRef,
}: {
  id: string;
  title: string;
  subtitle: string;
  badge: React.ReactNode;
  file?: File;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label
      htmlFor={id}
      className="group glass card-hover flex cursor-pointer flex-col items-center justify-center border-2 border-dashed !border-border/80 p-8 text-center transition-colors hover:!border-white/25"
    >
      <div className="mb-4">{badge}</div>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-transform group-hover:scale-105">
        <Upload className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{subtitle}</p>
      <span className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm font-medium transition-colors group-hover:border-white/20">
        Browse files
      </span>
      <input type="file" name={id} id={id} className="hidden" onChange={onChange} ref={inputRef} />
      {file && (
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-foreground">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="max-w-[200px] truncate font-medium">{file.name}</span>
        </div>
      )}
    </label>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No scan results yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Upload a target sequence and run a scan to see statistics, mutations and a sequence preview.
      </p>
    </div>
  );
}

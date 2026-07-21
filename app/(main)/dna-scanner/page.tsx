"use client";

import {
  Upload,
  FileText,
  Info,
  DownloadIcon,
  CheckCircle,
} from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";

// shadcn
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

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

// --- Main Component ---
export default function DNAScanner() {
  const [copied, setCopied] = useState(false); // <-- added copied state

  const handleCopySequence = async () => {
    if (!activeSequence) return;
    await navigator.clipboard.writeText(activeSequence.sequence);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500); // reset after 1.5s
  };

  const [activeTab, setActiveTab] = useState<
    "stats" | "mutations" | "sequence"
  >("stats");

  // File uploads
  const [fasta_file, set_fasta_file] = useState<File | undefined>(undefined);
  const [reference_file, set_reference_file] = useState<File | undefined>(
    undefined
  );

  // Parsed sequences
  const [targetSequences, setTargetSequences] = useState<FastaSequence[]>([]);
  const [referenceSequence, setReferenceSequence] =
    useState<FastaSequence | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  // Recent scans
  const [recentScans, setRecentScans] = useState<
    { id: string; name: string; date: string }[]
  >([]);

  const { user } = useAuth();

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
      const seq = lines
        .slice(1)
        .join("")
        .toUpperCase()
        .replace(/[^ATGCN]/g, "");

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

  // --- File Handling ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (event.target.id === "fasta_file") set_fasta_file(file);
    if (event.target.id === "reference_file") set_reference_file(file);
  };

  const handleRunScan = async () => {
    if (!fasta_file) return;

    // --- Parse Target FASTA ---
    const fastaText = await fasta_file.text();
    const parsedTargets = parseFasta(fastaText);
    setTargetSequences(parsedTargets);
    setSelectedTargetId(parsedTargets[0]?.id || "");

    // --- Parse Reference FASTA ---
    if (reference_file) {
      const refText = await reference_file.text();
      const parsedRefs = parseFasta(refText);
      setReferenceSequence(parsedRefs[0] || null);
    }

    // --- Update Recent Scans ---
    setRecentScans((prev) => [
      {
        id: Date.now().toString(),
        name: fasta_file.name,
        date: new Date().toLocaleString(),
      },
      ...prev,
    ]);
  };

  // --- Computed Analysis ---
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
        detected.push({
          position: i + 1,
          refBase: ref[i],
          varBase: target[i],
          type: "SNP",
        });
      }
    }
    return detected;
  }, [activeSequence, referenceSequence]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (!stats) return list;
    if (stats.length < 200)
      list.push("Sequence is surprisingly short (<200bp).");
    if (stats.nCount > stats.length * 0.1)
      list.push("High ambiguity detected (>10% 'N's).");
    if (stats.length === 0) list.push("Sequence is empty.");
    if (
      referenceSequence &&
      activeSequence &&
      Math.abs(
        referenceSequence.sequence.length - activeSequence.sequence.length
      ) > 100
    )
      list.push(
        "Large length discrepancy between Target and Reference. Naive alignment may be inaccurate."
      );

    return list;
  }, [stats, referenceSequence, activeSequence]);

  // --- Export Functions ---
  const exportStats = () => {
    if (!stats || !activeSequence) return;
    const data = {
      header: activeSequence.header,
      ...stats,
      warnings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
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
      mutations
        .map((m) => `${m.position},${m.refBase},${m.varBase},${m.type}`)
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mutations_vs_ref.csv`;
    a.click();
  };

  return (
    <div className="space-x-8">
      <div className="ml-16 pt-16">
        <main className="mx-auto max-w-7xl container pt-8 bg-background min-w-full min-h-screen space-y-8">
          {/* info */}
          <div className="flex flex-row items-center gap-2 justify-start glass p-4 text-gray-400 max-w-175">
            <Info className="size-4 shrink-0" />
            <p className="text-sm">
              The scanner prepares raw genomic data for simulation by converting
              unstructured files into a standardized Sequence Object. <br />
              Input: Multi-FASTA/GenBank ➔ Output: Validated JSON Map.
            </p>
          </div>

          {/* uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* fasta */}
            <div className="w-full">
              <div className="glass p-12 rounded-lg border-2 border-dashed border-primary/50 text-center">
                <Badge variant={"failure"} className="mb-4">
                  Required
                </Badge>
                <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2 ">
                  Upload Fasta File
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Drop your FASTA or GenBank files here, or click to browse
                </p>
                <label
                  htmlFor="fasta_file"
                  className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 has-[>svg]:px-3"
                >
                  Browse Files
                  <input
                    type="file"
                    name="fasta_file"
                    id="fasta_file"
                    className="hidden"
                    onChange={handleFileChange}
                    ref={fastaInputRef}
                  />
                </label>
                {fasta_file && (
                  <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs font-medium max-w-sm truncate">
                      {fasta_file.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* reference */}
            <div className="w-full">
              <div className="glass p-12 rounded-lg border-2 border-dashed border-primary/50 text-center">
                <Badge variant={"neutral"} className="mb-4">
                  Optional
                </Badge>
                <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2 ">
                  Upload Reference File
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Required for mutation calling. Upload a WT or Reference genome
                </p>
                <label
                  htmlFor="reference_file"
                  className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 has-[>svg]:px-3"
                >
                  Browse Files
                  <input
                    type="file"
                    name="reference_file"
                    id="reference_file"
                    className="hidden"
                    onChange={handleFileChange}
                    ref={referenceInputRef}
                  />
                </label>
                {reference_file && (
                  <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs font-medium max-w-sm truncate">
                      {reference_file.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* run button */}
          <div className="lg:col-span-2 flex justify-center">
            <Button
              onClick={handleRunScan}
              className="w-full py-4 font-bold"
            >
              Run DNA Scan
            </Button>
          </div>

          {/* ================= Bottom Analysis Panel ================= */}
          <div className="glass rounded-xl p-6 space-y-6">
            {/* Tabs + Actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
              {/* Tabs */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setActiveTab("stats")}
                  className={`bg-primary/50 ${
                    activeTab === "stats"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-primary/80"
                  }`}
                >
                  Statistics
                </Button>

                <Button
                  onClick={() => setActiveTab("mutations")}
                  className={`bg-primary/50 ${
                    activeTab === "mutations"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-primary/80"
                  }`}
                >
                  Mutations ({mutations.length})
                </Button>

                <Button
                  onClick={() => setActiveTab("sequence")}
                  className={`bg-primary/50 ${
                    activeTab === "sequence"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-primary/80"
                  }`}
                >
                  Sequence Preview
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={exportStats}>
                  <DownloadIcon />
                  JSON Stats
                </Button>
                <Button
                  onClick={exportMutations}
                  disabled={mutations.length === 0}
                >
                  <DownloadIcon />
                  CSV Mutations
                </Button>
              </div>
            </div>

            {/* Statistics */}
            {activeTab === "stats" && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  label="Length (bp)"
                  value={stats.length.toLocaleString()}
                />
                <StatCard
                  label="GC Content"
                  value={`${stats.gcContent.toFixed(2)}%`}
                />
                <StatCard label="Ambiguous Bases (N)" value={stats.nCount} />
                <StatCard label="Putative ORFs" value={stats.orfs} />
              </div>
            )}

            {/* Mutations */}
            {activeTab === "mutations" && (
              <>
                {!referenceSequence ? (
                  <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground space-y-2">
                    <p className="text-lg font-semibold">Reference Missing</p>
                    <p className="text-sm">
                      Please upload a Reference FASTA (Step 2) to identify
                      mutations.
                    </p>
                  </div>
                ) : mutations.length === 0 ? (
                  <div className="text-center py-12 text-green-600 font-mediu rounded-lg">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2" />
                    No mutations detected (100% Identity vs Reference)
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scroll max-h-80">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 border">Position</th>
                          <th className="px-4 py-3 border">Reference</th>
                          <th className="px-4 py-3 border">Mutation</th>
                          <th className="px-4 py-3 border">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mutations.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-mono">
                              {m.position}
                            </td>
                            <td className="px-4 py-2 font-mono text-slate-500">
                              {m.refBase}
                            </td>
                            <td className="px-4 py-2 font-mono text-red-600 font-bold">
                              {m.varBase}
                            </td>
                            <td className="px-4 py-2">{m.type}</td>
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
              <div className="relative w-full">
                {/* Copy button */}
                <button
                  onClick={handleCopySequence}
                  className="absolute top-3 right-3 z-10 text-xs bg-black/70 hover:bg-black text-white px-3 py-1 rounded-md border border-white/10 transition"
                >
                  {copied ? "Copied" : "Copy"} {/* <-- changed text */}
                </button>

                {/* Sequence box */}
                <div className="bg-[#0b1020] text-green-200 rounded-sm p-4 text-sm font-mono overflow-auto seq-scroll max-h-[320px]">
                  {activeSequence ? (
                    <>
                      {activeSequence.sequence.slice(0, 1000)}
                      {activeSequence.sequence.length > 1000 && (
                        <span className="text-slate-500">
                          ... (sequence truncated for preview)
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="opacity-60">No FASTA file uploaded.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// --- Helper Component ---
const StatCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="bg-card p-5 rounded-xl border flex flex-col justify-between min-h-[120px]">
    <p className="text-xs text-muted-foreground uppercase">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

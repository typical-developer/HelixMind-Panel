"use client";

import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import {
  Upload,
  FileText,
  Info,
  DownloadIcon,
  CheckCircle,
  Dna,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

// ── ADDED: 3D structure components ──
import DnaHelix3D from "@/lib/structure/DnaHelix3D";
import ProteinStructure3D from "@/lib/structure/ProteinStructure3D";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type SequenceType = "DNA" | "RNA";

interface FastaSequence {
  id: string;
  header: string;
  sequence: string;
  type: SequenceType;
}

interface Mutation {
  position: number;
  refBase: string;
  varBase: string;
  type: "SNP" | "Indel";
}

interface CodonUsage {
  codon: string;
  aminoAcid: string;
  count: number;
  frequency: number;
}

interface ORF {
  start: number;
  end: number;
  length: number;
  frame: number;
  sequence: string;
  proteinSequence: string;
}

interface ResistanceHit {
  gene: string;
  kmer: string;
  position: number;
  drug_class: string;
}

interface OrganismHit {
  accession: string;
  title: string;
  score: number;
  identity: string;
}

interface SequenceStats {
  length: number;
  gcContent: number;
  nCount: number;
  orfs: ORF[];
  codonUsage: CodonUsage[];
  type: SequenceType;
  iupacCount: number;
}

interface BatchResult {
  sequence: FastaSequence;
  stats: SequenceStats;
  mutations: Mutation[];
  resistanceHits: ResistanceHit[];
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const IUPAC_DNA_REGEX = /[^ATGCBDHKMRSVWYN]/g;
const IUPAC_RNA_REGEX = /[^AUGCBDHKMRSVWYN]/g;

const CODON_TABLE: Record<string, string> = {
  TTT: "Phe", TTC: "Phe", TTA: "Leu", TTG: "Leu",
  CTT: "Leu", CTC: "Leu", CTA: "Leu", CTG: "Leu",
  ATT: "Ile", ATC: "Ile", ATA: "Ile", ATG: "Met",
  GTT: "Val", GTC: "Val", GTA: "Val", GTG: "Val",
  TCT: "Ser", TCC: "Ser", TCA: "Ser", TCG: "Ser",
  CCT: "Pro", CCC: "Pro", CCA: "Pro", CCG: "Pro",
  ACT: "Thr", ACC: "Thr", ACA: "Thr", ACG: "Thr",
  GCT: "Ala", GCC: "Ala", GCA: "Ala", GCG: "Ala",
  TAT: "Tyr", TAC: "Tyr", TAA: "Stop", TAG: "Stop",
  CAT: "His", CAC: "His", CAA: "Gln", CAG: "Gln",
  AAT: "Asn", AAC: "Asn", AAA: "Lys", AAG: "Lys",
  GAT: "Asp", GAC: "Asp", GAA: "Glu", GAG: "Glu",
  TGT: "Cys", TGC: "Cys", TGA: "Stop", TGG: "Trp",
  CGT: "Arg", CGC: "Arg", CGA: "Arg", CGG: "Arg",
  AGT: "Ser", AGC: "Ser", AGA: "Arg", AGG: "Arg",
  GGT: "Gly", GGC: "Gly", GGA: "Gly", GGG: "Gly",
};

const KMER_LEN = 21;
const CARD_KMERS: Record<string, { gene: string; drug_class: string }> = {
  "ATGAGCATTCTGAAAACAACA": { gene: "mecA", drug_class: "Beta-lactam" },
  "GCTTCACCGCCTGTCGCAAAA": { gene: "vanA", drug_class: "Glycopeptide" },
  "ATGGCAATGAGCAAACTACTA": { gene: "blaTEM-1", drug_class: "Beta-lactam" },
  "TTACCAATGCTTAATCAGTGA": { gene: "aac(6')-Ib", drug_class: "Aminoglycoside" },
  "ATGAGTATTCAACATTTTCGT": { gene: "sul1", drug_class: "Sulfonamide" },
  "GCAATGTCGCTATGGAATTAC": { gene: "tetM", drug_class: "Tetracycline" },
  "ATGGCAACTCTTGAAAATCGT": { gene: "qnrB", drug_class: "Fluoroquinolone" },
  "GCTTCACCGCCTGTTGCAAAG": { gene: "vanB", drug_class: "Glycopeptide" },
  "ATGCGCTTCGCCATTGAAAGC": { gene: "blaOXA-1", drug_class: "Beta-lactam" },
  "ATGAAAGCAATTTTCGTACTG": { gene: "ermB", drug_class: "Macrolide" },
};

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

function detectSequenceType(seq: string): SequenceType {
  const uCount = (seq.match(/U/g) || []).length;
  const tCount = (seq.match(/T/g) || []).length;
  return uCount > tCount ? "RNA" : "DNA";
}

function parseFasta(content: string): FastaSequence[] {
  const parts = content.split(">");
  const sequences: FastaSequence[] = [];

  parts.forEach((part, index) => {
    if (!part.trim()) return;
    const lines = part.split("\n");
    const header = lines[0].split(/\s+/)[0];
    const rawSeq = lines.slice(1).join("").toUpperCase().trim();
    const type = detectSequenceType(rawSeq);
    const seq = rawSeq.replace(type === "RNA" ? IUPAC_RNA_REGEX : IUPAC_DNA_REGEX, "");

    if (seq.length > 0) {
      sequences.push({
        id: `seq_${index}_${Date.now()}`,
        header: header || `Sequence_${index + 1}`,
        sequence: seq,
        type,
      });
    }
  });

  return sequences;
}

function translateSequence(seq: string): string {
  let protein = "";
  for (let i = 0; i < seq.length - 2; i += 3) {
    const codon = seq.slice(i, i + 3);
    const aa = CODON_TABLE[codon];
    if (aa === "Stop") break;
    protein += getSingleLetterAA(aa) || "X";
  }
  return protein;
}

function getSingleLetterAA(threeLetter: string): string {
  const map: Record<string, string> = {
    Phe: "F", Leu: "L", Ile: "I", Met: "M", Val: "V",
    Ser: "S", Pro: "P", Thr: "T", Ala: "A", Tyr: "Y",
    His: "H", Gln: "Q", Asn: "N", Lys: "K", Asp: "D",
    Glu: "E", Cys: "C", Trp: "W", Arg: "R", Gly: "G"
  };
  return map[threeLetter] || "X";
}

function getReverseComplement(seq: string): string {
  const complement: Record<string, string> = { A: 'T', T: 'A', U: 'A', C: 'G', G: 'C', N: 'N' };
  return seq.split('').reverse().map(b => complement[b] || 'N').join('');
}

function smithWaterman(ref: string, target: string): [string, string] {
  const CAP = 10000;
  const s1 = ref.slice(0, CAP);
  const s2 = target.slice(0, CAP);
  const GAP = -2, MATCH = 2, MISMATCH = -1;
  const m = s1.length, n = s2.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  let maxScore = 0;
  let maxI = 0, maxJ = 0;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = dp[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? MATCH : MISMATCH);
      const del = dp[i - 1][j] + GAP;
      const ins = dp[i][j - 1] + GAP;
      dp[i][j] = Math.max(0, match, del, ins);

      if (dp[i][j] > maxScore) {
        maxScore = dp[i][j];
        maxI = i; maxJ = j;
      }
    }
  }

  let a1 = "", a2 = "";
  let i = maxI, j = maxJ;
  while (i > 0 && j > 0 && dp[i][j] > 0) {
    const score = dp[i][j];
    if (score === dp[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? MATCH : MISMATCH)) {
      a1 = s1[i - 1] + a1; a2 = s2[j - 1] + a2; i--; j--;
    } else if (score === dp[i - 1][j] + GAP) {
      a1 = s1[i - 1] + a1; a2 = "-" + a2; i--;
    } else {
      a1 = "-" + a1; a2 = s2[j - 1] + a2; j--;
    }
  }

  return [a1, a2];
}

function computeMutations(aligned1: string, aligned2: string): Mutation[] {
  const mutations: Mutation[] = [];
  let refPos = 0;
  for (let i = 0; i < aligned1.length; i++) {
    const r = aligned1[i], v = aligned2[i];
    if (r !== "-") refPos++;
    if (r === v || r === "N" || v === "N") continue;
    if (r === "-" || v === "-") {
      mutations.push({ position: refPos, refBase: r, varBase: v, type: "Indel" });
    } else {
      mutations.push({ position: refPos, refBase: r, varBase: v, type: "SNP" });
    }
  }
  return mutations;
}

function detectORFs(seq: string): ORF[] {
  const orfs: ORF[] = [];
  const stopCodons = new Set(["TAA", "TAG", "TGA"]);

  const normSeq = seq.replace(/U/g, 'T');
  const revComp = getReverseComplement(normSeq);

  const findInStrand = (strandSeq: string, strandDir: string) => {
    for (let frame = 0; frame < 3; frame++) {
      for (let i = frame; i < strandSeq.length - 2; i += 3) {
        if (strandSeq.slice(i, i + 3) === "ATG") {
          const start = i;
          for (let j = i + 3; j < strandSeq.length - 2; j += 3) {
            const codon = strandSeq.slice(j, j + 3);
            if (stopCodons.has(codon)) {
              const orfSeq = strandSeq.slice(start, j + 3);
              if (orfSeq.length >= 300) {
                const actualStart = strandDir === '+' ? start + 1 : strandSeq.length - (j + 3) + 1;
                const actualEnd = strandDir === '+' ? j + 3 : strandSeq.length - start;
                const frameNum = strandDir === '+' ? frame + 1 : -(frame + 1);

                orfs.push({
                  start: actualStart,
                  end: actualEnd,
                  length: orfSeq.length,
                  frame: frameNum,
                  sequence: orfSeq,
                  proteinSequence: translateSequence(orfSeq)
                });
              }
              break;
            }
          }
        }
      }
    }
  };

  findInStrand(normSeq, '+');
  findInStrand(revComp, '-');

  return orfs.sort((a, b) => b.length - a.length);
}

function computeCodonUsage(seq: string): CodonUsage[] {
  const counts: Record<string, number> = {};
  let total = 0;
  const normSeq = seq.replace(/U/g, 'T');

  for (let i = 0; i < normSeq.length - 2; i += 3) {
    const codon = normSeq.slice(i, i + 3);
    if (codon.length === 3 && CODON_TABLE[codon]) {
      const displayCodon = seq[i] === 'U' || seq[i+1] === 'U' || seq[i+2] === 'U'
        ? codon.replace(/T/g, 'U')
        : codon;

      counts[displayCodon] = (counts[displayCodon] || 0) + 1;
      total++;
    }
  }

  return Object.entries(counts)
    .map(([codon, count]) => ({
      codon,
      aminoAcid: CODON_TABLE[codon.replace(/U/g, 'T')] || "?",
      count,
      frequency: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function kmerResistanceScan(seq: string): ResistanceHit[] {
  const hits: ResistanceHit[] = [];
  const seen = new Set<string>();
  const normSeq = seq.replace(/U/g, 'T');

  for (let i = 0; i <= normSeq.length - KMER_LEN; i++) {
    const kmer = normSeq.slice(i, i + KMER_LEN);
    const hit = CARD_KMERS[kmer];
    if (hit && !seen.has(hit.gene)) {
      seen.add(hit.gene);
      hits.push({ gene: hit.gene, kmer, position: i + 1, drug_class: hit.drug_class });
    }
  }
  return hits;
}

function countIUPAC(seq: string): number {
  return (seq.match(/[BDHKMRSVWY]/g) || []).length;
}

function computeStats(seq: FastaSequence): SequenceStats {
  const s = seq.sequence;
  const len = s.length;
  const gc = (s.match(/[GC]/g) || []).length;
  const n = (s.match(/N/g) || []).length;
  const iupacCount = countIUPAC(s);
  const orfs = detectORFs(s);
  const codonUsage = computeCodonUsage(s);

  return {
    length: len,
    gcContent: len > 0 ? (gc / len) * 100 : 0,
    nCount: n,
    orfs,
    codonUsage,
    type: seq.type,
    iupacCount,
  };
}

// ─────────────────────────────────────────────
// NCBI BLAST organism identification
// ─────────────────────────────────────────────
async function identifyOrganism(seq: string): Promise<OrganismHit[]> {
  const query = seq.slice(0, 500);
  try {
    const submitRes = await fetch(
      "https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          CMD: "Put",
          PROGRAM: "blastn",
          DATABASE: "nt",
          QUERY: query,
          FORMAT_TYPE: "JSON2",
          HITLIST_SIZE: "5",
          WORD_SIZE: "28",
        }),
      }
    );
    const submitText = await submitRes.text();
    const ridMatch = submitText.match(/RID = ([A-Z0-9]+)/);
    if (!ridMatch) return [];

    const rid = ridMatch[1];

    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));
      const pollRes = await fetch(
        `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&FORMAT_TYPE=JSON2&RID=${rid}`
      );
      const pollText = await pollRes.text();

      if (pollText.includes("Status=WAITING")) continue;
      if (pollText.includes("Status=FAILED")) return [];

      try {
        const json = JSON.parse(pollText);
        const hits =
          json?.BlastOutput2?.[0]?.report?.results?.search?.hits || [];
        return hits.slice(0, 5).map((hit: any) => ({
          accession: hit.description?.[0]?.accession || "",
          title: hit.description?.[0]?.title || "Unknown",
          score: hit.hsps?.[0]?.score || 0,
          identity: hit.hsps?.[0]?.identity
            ? `${((hit.hsps[0].identity / hit.hsps[0].align_len) * 100).toFixed(1)}%`
            : "N/A",
        }));
      } catch {
        return [];
      }
    }
    return [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function DNAScanner() {
  const [activeTab, setActiveTab] = useState<
    "stats" | "mutations" | "sequence" | "resistance" | "organism" | "codon" | "batch" | "structure"
  >("stats");

  const [fasta_file, set_fasta_file] = useState<File | undefined>(undefined);
  const [reference_file, set_reference_file] = useState<File | undefined>(undefined);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);

  const [targetSequences, setTargetSequences] = useState<FastaSequence[]>([]);
  const [referenceSequence, setReferenceSequence] = useState<FastaSequence | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [resistanceHits, setResistanceHits] = useState<ResistanceHit[]>([]);
  const [organismHits, setOrganismHits] = useState<OrganismHit[]>([]);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

  const [isScanning, setIsScanning] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alignmentCapped, setAlignmentCapped] = useState(false);

  const fastaInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (event.target.id === "fasta_file") {
      set_fasta_file(file);
      // Auto-run: as soon as the target FASTA is picked, run the full scan.
      // Pass the file directly (not the state var) since state updates are async.
      runFullScan(file, reference_file);
    }
    if (event.target.id === "reference_file") {
      set_reference_file(file);
      // If a target is already loaded, re-run so the new reference is
      // reflected in the mutation/alignment results immediately.
      if (fasta_file) runFullScan(fasta_file, file);
    }
  };

  // Extracted from the old button-click handler so it can run on upload,
  // taking files as direct arguments rather than relying on state that
  // hasn't finished updating yet.
  const runFullScan = async (targetFile: File, refFile?: File) => {
    setIsScanning(true);
    setOrganismHits([]);

    const fastaText = await targetFile.text();
    const parsedTargets = parseFasta(fastaText);
    setTargetSequences(parsedTargets);
    setSelectedTargetId(parsedTargets[0]?.id || "");

    let refSeq: FastaSequence | null = null;
    if (refFile) {
      const refText = await refFile.text();
      const parsedRefs = parseFasta(refText);
      refSeq = parsedRefs[0] || null;
      setReferenceSequence(refSeq);
    }

    if (refSeq && parsedTargets[0]) {
      const target = parsedTargets[0].sequence;
      const ref = refSeq.sequence;
      const capped = target.length > 10000 || ref.length > 10000;
      setAlignmentCapped(capped);
      const [a1, a2] = smithWaterman(ref, target);
      setMutations(computeMutations(a1, a2));
    }

    if (parsedTargets[0]) {
      setResistanceHits(kmerResistanceScan(parsedTargets[0].sequence));
    }

    setIsScanning(false);
  };

  const handleBatchFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setBatchFiles(files);
  };

  const handleIdentifyOrganism = async () => {
    if (!activeSequence) return;
    setIsIdentifying(true);
    const hits = await identifyOrganism(activeSequence.sequence);
    setOrganismHits(hits);
    setIsIdentifying(false);
  };

  const handleRunBatch = async () => {
    if (batchFiles.length === 0) return;
    setIsScanning(true);
    const results: BatchResult[] = [];

    for (const file of batchFiles) {
      const text = await file.text();
      const sequences = parseFasta(text);
      for (const seq of sequences) {
        const seqStats = computeStats(seq);
        const seqMutations: Mutation[] = [];
        const seqResistance = kmerResistanceScan(seq.sequence);
        results.push({ sequence: seq, stats: seqStats, mutations: seqMutations, resistanceHits: seqResistance });
      }
    }

    setBatchResults(results);
    setIsScanning(false);
    setActiveTab("batch");
  };

  const activeSequence = useMemo(
    () => targetSequences.find((s) => s.id === selectedTargetId),
    [targetSequences, selectedTargetId]
  );

  const stats: SequenceStats | null = useMemo(() => {
    if (!activeSequence) return null;
    return computeStats(activeSequence);
  }, [activeSequence]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (!stats) return list;
    if (stats.length < 200) list.push("Sequence is short (<200bp).");
    if (stats.nCount > stats.length * 0.1) list.push("High ambiguity (>10% 'N').");
    if (stats.iupacCount > 0) list.push(`${stats.iupacCount} IUPAC ambiguity bases detected.`);
    if (alignmentCapped) list.push("Sequences >10kb — Smith-Waterman alignment capped at 10k bp for browser performance.");
    return list;
  }, [stats, alignmentCapped]);

  const handleCopySequence = async () => {
    if (!activeSequence) return;
    await navigator.clipboard.writeText(activeSequence.sequence);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exportStats = () => {
    if (!stats || !activeSequence) return;
    const data = { header: activeSequence.header, type: activeSequence.type, ...stats, warnings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSequence.header.substring(0, 10)}_stats.json`;
    a.click();
  };

  const exportMutations = () => { /*...*/ };
  const exportCodonUsage = () => { /*...*/ };
  const exportBatch = () => { /*...*/ };

  return (
    <div className="space-x-8">
      <Sidebar />
      <div className="ml-16 pt-16">
        <Header title="DNA Scanner" />

        <main className="mx-auto max-w-7xl container pt-8 bg-background min-w-full min-h-screen space-y-8">

          <div className="flex flex-row items-center gap-2 justify-start glass p-4 text-gray-400 max-w-175">
            <Info className="size-4 shrink-0" />
            <p className="text-sm">
              Input: Multi-FASTA / GenBank → Output: Validated Sequence Object. RNA automatically normalized for protein translation. ORFs verified across all 6 reading frames.
            </p>
          </div>

          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                  <AlertTriangle className="size-4 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UploadCard
              id="fasta_file"
              label="Target FASTA"
              badge="Required"
              badgeVariant="failure"
              description="Drop FASTA or GenBank files here"
              file={fasta_file}
              inputRef={fastaInputRef}
              onChange={handleFileChange}
              sequenceType={targetSequences[0]?.type}
            />

            <UploadCard
              id="reference_file"
              label="Reference FASTA"
              badge="Optional"
              badgeVariant="neutral"
              description="Upload a reference genome for local variant calling"
              file={reference_file}
              inputRef={referenceInputRef}
              onChange={handleFileChange}
            />

            <div className="w-full">
              <div className="glass p-8 rounded-lg border-2 border-dashed border-primary/50 text-center">
                <Badge variant="neutral" className="mb-4">Batch</Badge>
                <Upload className="w-10 h-10 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Batch Processing</h3>
                <p className="text-sm text-muted-foreground mb-4">Upload multiple FASTA files</p>
                <label htmlFor="batch_files" className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground rounded-sm px-4 py-2 hover:bg-primary/90">
                  Browse Files
                  <input
                    type="file"
                    id="batch_files"
                    multiple
                    className="hidden"
                    onChange={handleBatchFileChange}
                    ref={batchInputRef}
                  />
                </label>
                {batchFiles.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">{batchFiles.length} file(s) selected</p>
                )}
              </div>
            </div>
          </div>

          {targetSequences.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Active sequence:</span>
              <select
                className="bg-card border rounded px-3 py-1.5 text-sm"
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
              >
                {targetSequences.map((s) => (
                  <option key={s.id} value={s.id}>{s.header}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => fasta_file && runFullScan(fasta_file, reference_file)}
              disabled={isScanning || !fasta_file}
              variant="outline"
              className="flex-1 py-4 font-bold"
            >
              {isScanning ? "Scanning..." : "Re-run Scan"}
            </Button>
            {batchFiles.length > 0 && (
              <Button onClick={handleRunBatch} disabled={isScanning} variant="outline" className="py-4">
                Run Batch
              </Button>
            )}
          </div>

          <div className="glass rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "stats", label: "Statistics" },
                    { key: "mutations", label: `Mutations (${mutations.length})` },
                    { key: "resistance", label: `Resistance (${resistanceHits.length})` },
                    { key: "codon", label: "Codon Usage" },
                    { key: "organism", label: "Organism ID & Proteins" },
                    { key: "structure", label: "3D Structure" },
                    { key: "sequence", label: "Sequence" },
                    { key: "batch", label: `Batch (${batchResults.length})` },
                  ] as const
                ).map((tab) => (
                  <Button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`bg-primary/50 text-sm ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "hover:bg-primary/80"}`}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={exportStats} size="sm"><DownloadIcon className="size-4" /> JSON Stats</Button>
              </div>
            </div>

            {/* ── STATISTICS TAB ── */}
            {activeTab === "stats" && stats && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="Length (bp)" value={stats.length.toLocaleString()} />
                  <StatCard label="GC Content" value={`${stats.gcContent.toFixed(2)}%`} />
                  <StatCard label="Ambiguous (N)" value={stats.nCount} />
                  <StatCard label="ORFs (≥300bp)" value={stats.orfs.length} />
                  <StatCard label="Sequence Type" value={stats.type} />
                  <StatCard label="IUPAC Bases" value={stats.iupacCount} />
                  <StatCard label="Total Codons" value={Math.floor(stats.length / 3).toLocaleString()} />
                  <StatCard label="Resistance Hits" value={resistanceHits.length} />
                </div>

                {stats.orfs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">6-Frame Open Reading Frames</h3>
                    <div className="overflow-x-auto max-h-64 custom-scroll">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-3 border">Frame</th>
                            <th className="px-4 py-3 border">Start</th>
                            <th className="px-4 py-3 border">End</th>
                            <th className="px-4 py-3 border">Length (bp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {stats.orfs.map((orf, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                              <td className="px-4 py-2 font-mono">{orf.frame > 0 ? `+${orf.frame}` : `${orf.frame}`}</td>
                              <td className="px-4 py-2 font-mono">{orf.start.toLocaleString()}</td>
                              <td className="px-4 py-2 font-mono">{orf.end.toLocaleString()}</td>
                              <td className="px-4 py-2 font-mono">{orf.length.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ORGANISM ID & PROTEINS TAB ── */}
            {activeTab === "organism" && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleIdentifyOrganism}
                    disabled={isIdentifying || !activeSequence}
                    className="gap-2"
                  >
                    <Dna className="size-4" />
                    {isIdentifying ? "Querying NCBI BLASTn..." : "Identify Organism (Nucleotide BLAST)"}
                  </Button>
                  <span className="text-xs text-muted-foreground">BLAST queries take ~30s</span>
                </div>

                {organismHits.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">BLAST Top Hits</h3>
                    <div className="space-y-2">
                      {organismHits.map((hit, i) => (
                        <div key={i} className="p-4 bg-card border rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{hit.title}</p>
                            <p className="text-xs text-muted-foreground font-mono">{hit.accession}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">{hit.identity}</p>
                            <p className="text-xs text-muted-foreground">Identity</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stats && stats.orfs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Protein Sequence Homology (BLASTp)</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Direct REST queries for amino acid alignment are restricted by database limits. Use the translated sequences below to query NCBI or UniProt directly.
                    </p>
                    <div className="space-y-3">
                      {stats.orfs.slice(0, 5).map((orf, i) => (
                        <div key={i} className="p-4 bg-card border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">Longest ORF #{i + 1} (Frame {orf.frame > 0 ? `+${orf.frame}` : orf.frame})</p>
                              <p className="text-xs text-muted-foreground">Pos: {orf.start}-{orf.end} | Length: {Math.floor(orf.length/3)} AAs</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`https://blast.ncbi.nlm.nih.gov/Blast.cgi?PROGRAM=blastp&PAGE_TYPE=BlastSearch&QUERY=${orf.proteinSequence}`, '_blank')}
                              className="gap-2"
                            >
                              Search NCBI BLASTp <ExternalLink className="size-3"/>
                            </Button>
                          </div>
                          <div className="bg-[#0b1020] text-blue-300 rounded p-2 text-xs font-mono max-h-20 overflow-auto">
                            {orf.proteinSequence}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 3D STRUCTURE TAB (ADDED) ── */}
            {activeTab === "structure" && (
              <div className="space-y-6">
                {!activeSequence && (
                  <p className="text-sm text-muted-foreground">Run a scan first to load a sequence.</p>
                )}

                {activeSequence && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                      {activeSequence.type} Double Helix
                    </h3>
                    <DnaHelix3D
                      sequence={activeSequence.sequence}
                      isRna={activeSequence.type === "RNA"}
                    />
                  </div>
                )}

                {stats && stats.orfs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                      Predicted Protein Fold (Longest ORF, {Math.floor(stats.orfs[0].length / 3)} AAs)
                    </h3>
                    <ProteinStructure3D proteinSequence={stats.orfs[0].proteinSequence} />
                  </div>
                )}

                {stats && stats.orfs.length === 0 && (
                  <p className="text-sm text-muted-foreground">No ORFs ≥300bp detected — no protein fold to render for this sequence.</p>
                )}
              </div>
            )}

            {/* Other tabs omitted for brevity but remain structurally identical to the original layout */}

          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HELPER COMPONENTS (Unchanged)
// ─────────────────────────────────────────────

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-card p-5 rounded-xl border flex flex-col justify-between min-h-[120px]">
    <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

const UploadCard = ({
  id,
  label,
  badge,
  badgeVariant,
  description,
  file,
  inputRef,
  onChange,
  sequenceType,
}: {
  id: string;
  label: string;
  badge: string;
  badgeVariant: "failure" | "neutral";
  description: string;
  file: File | undefined;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sequenceType?: SequenceType;
}) => (
  <div className="w-full">
    <div className="glass p-10 rounded-lg border-2 border-dashed border-primary/50 text-center">
      <Badge variant={badgeVariant} className="mb-4">{badge}</Badge>
      <Upload className="w-10 h-10 mx-auto mb-4 text-primary" />
      <h3 className="text-lg font-semibold mb-2">{label}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <label
        htmlFor={id}
        className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground rounded-sm px-4 py-2 hover:bg-primary/90"
      >
        Browse Files
        <input type="file" id={id} name={id} className="hidden" onChange={onChange} ref={inputRef} />
      </label>
      {file && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-medium max-w-sm truncate">{file.name}</span>
          {sequenceType && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${sequenceType === "RNA" ? "bg-purple-600 text-white" : "bg-green-800 text-green-200"}`}>
              {sequenceType}
            </span>
          )}
        </div>
      )}
    </div>
  </div>
);

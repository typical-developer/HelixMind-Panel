"use client";

import {
  Activity,
  Download,
  FileText,
  LineChart as LineChartIcon,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

// ui
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChartFallback } from "@/components/chart-fallback";

// Recharts is the heaviest dependency on this route and nothing above the fold
// needs it, so the plot loads as its own chunk once the controls are live.
const RunChart = dynamic(
  () => import("./run-chart").then((m) => m.RunChart),
  { ssr: false, loading: () => <ChartFallback height={300} /> },
);
import {
  ViewLayout,
  ViewScroll,
  Field,
  Pane,
  PaneHeader,
  StatTile,
  ToolbarButton,
  WBInput,
  WBSelect,
  useLogStream,
  useAlerts,
  useRunStatus,
  useStatusItems,
  useViewContext,
  type WorkbenchAlert,
} from "@/components/workbench";

// ==================== SIMULATION UTILITIES ====================

const CODON_MAP: Record<string, string> = {
  ATA: "I",
  ATC: "I",
  ATT: "I",
  ATG: "M",
  ACA: "T",
  ACC: "T",
  ACG: "T",
  ACT: "T",
  AAC: "N",
  AAT: "N",
  AAA: "K",
  AAG: "K",
  AGC: "S",
  AGT: "S",
  AGA: "R",
  AGG: "R",
  CTA: "L",
  CTC: "L",
  CTG: "L",
  CTT: "L",
  CCA: "P",
  CCC: "P",
  CCG: "P",
  CCT: "P",
  CAC: "H",
  CAT: "H",
  CAA: "Q",
  CAG: "Q",
  CGA: "R",
  CGC: "R",
  CGG: "R",
  CGT: "R",
  GTA: "V",
  GTC: "V",
  GTG: "V",
  GTT: "V",
  GCA: "A",
  GCC: "A",
  GCG: "A",
  GCT: "A",
  GAC: "D",
  GAT: "D",
  GAA: "E",
  GAG: "E",
  GGA: "G",
  GGC: "G",
  GGG: "G",
  GGT: "G",
  TCA: "S",
  TCC: "S",
  TCG: "S",
  TCT: "S",
  TTC: "F",
  TTT: "F",
  TTA: "L",
  TTG: "L",
  TAC: "Y",
  TAT: "Y",
  TAA: "",
  TAG: "",
  TGC: "C",
  TGT: "C",
  TGA: "_",
  TGG: "W",
};

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

const getMutatedBase = (original: string, rng: SeededRandom): string => {
  const transitions: Record<string, string> = {
    A: "G",
    G: "A",
    C: "T",
    T: "C",
  };
  const transversions: Record<string, string[]> = {
    A: ["C", "T"],
    G: ["C", "T"],
    C: ["A", "G"],
    T: ["A", "G"],
  };

  if (rng.next() < 0.66) {
    return transitions[original] || original;
  } else {
    const choices = transversions[original] || [original];
    return choices[Math.floor(rng.next() * choices.length)];
  }
};

const calculateFitness = (
  seq: string,
  mutations: { type: string; context: string; aminoAcidChange: string }[]
): number => {
  let fitness = 100;

  mutations.forEach((m) => {
    if (m.type === "substitution" && m.context === "coding") {
      if (m.aminoAcidChange && m.aminoAcidChange !== "none") fitness -= 1.5;
    } else if (m.type === "insertion" || m.type === "deletion") {
      fitness -= 10.0;
    }
  });

  const stopCodons = ["TAA", "TAG", "TGA"];
  for (let i = 0; i < seq.length - 2; i += 3) {
    if (stopCodons.includes(seq.substr(i, 3))) fitness -= 5;
  }
  return Math.max(0, fitness);
};

const parseFASTA = (text: string): Record<string, string> => {
  const sequences: Record<string, string> = {};
  const lines = text.split("\n");
  let currentHeader = "";
  let currentSeq = "";

  for (const line of lines) {
    if (line.startsWith(">")) {
      if (currentHeader) {
        sequences[currentHeader] = currentSeq;
      }
      currentHeader = line.substring(1).trim();
      currentSeq = "";
    } else {
      currentSeq += line.trim().toUpperCase();
    }
  }

  if (currentHeader) {
    sequences[currentHeader] = currentSeq;
  }

  return sequences;
};

// ==================== MAIN COMPONENT ====================

interface MutationData {
  generation: number;
  position: number;
  type: "insertion" | "deletion" | "substitution";
  original: string;
  mutated: string;
  aminoAcidChange: string;
  context: "coding" | "non-coding";
}

interface GenerationStats {
  generation: number;
  fitness: number;
  mutationCount: number;
  progress: number;
  cumulativeMutations: number;
}

export default function MutationSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [queryFastaFile, setQueryFastaFile] = useState<File | null>(null);
  const [sequence, setSequence] = useState<string>("");
  const [params, setParams] = useState({
    tempUnit: "C" as "C" | "F",
    temperature: 37,
    substitutionRate: 0.0001,
    numGenerations: 5,
    pH: 7,
    nutrients: "Medium",
    oxygen: "Normal (21%)",
  });

  const [errors, setErrors] = useState({
    temperature: "",
    pH: "",
    numGenerations: "",
    substitutionRate: "",
  });

  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [mutations, setMutations] = useState<MutationData[]>([]);
  const [generationStats, setGenerationStats] = useState<GenerationStats[]>([]);
  const [totalMutations, setTotalMutations] = useState(0);
  const [substitutions, setSubstitutions] = useState(0);
  const [insertions, setInsertions] = useState(0);
  const [currentSequence, setCurrentSequence] = useState("");

  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setQueryFastaFile(file);

    const text = await file.text();
    const sequences = parseFASTA(text);
    const firstSeq = Object.values(sequences)[0];

    if (firstSeq) {
      setSequence(firstSeq);
      setCurrentSequence(firstSeq);
    }
  };

  const validateTemperature = (value: number) => {
    const min = params.tempUnit === "C" ? -10 : 14;
    const max = params.tempUnit === "C" ? 100 : 212;

    if (value < min) {
      setErrors((prev) => ({
        ...prev,
        temperature: `Too low! Minimum is ${min}°${params.tempUnit}`,
      }));
      return false;
    } else if (value > max) {
      setErrors((prev) => ({
        ...prev,
        temperature: `Too high! Maximum is ${max}°${params.tempUnit}`,
      }));
      return false;
    } else {
      setErrors((prev) => ({ ...prev, temperature: "" }));
      return true;
    }
  };

  const validatePH = (value: number) => {
    if (value < 0) {
      setErrors((prev) => ({ ...prev, pH: "Too low! Minimum is 0.0" }));
      return false;
    } else if (value > 14) {
      setErrors((prev) => ({ ...prev, pH: "Too high! Maximum is 14.0" }));
      return false;
    } else {
      setErrors((prev) => ({ ...prev, pH: "" }));
      return true;
    }
  };

  const validateGenerations = (value: number) => {
    if (value < 1) {
      setErrors((prev) => ({
        ...prev,
        numGenerations: "Too low! Minimum is 1",
      }));
      return false;
    } else if (value > 10) {
      setErrors((prev) => ({
        ...prev,
        numGenerations: "Too high! Maximum is 10",
      }));
      return false;
    } else {
      setErrors((prev) => ({ ...prev, numGenerations: "" }));
      return true;
    }
  };

  const validateMutationRate = (value: number) => {
    if (value < 0) {
      setErrors((prev) => ({
        ...prev,
        substitutionRate: "Too low! Minimum is 0.00000",
      }));
      return false;
    } else if (value > 0.001) {
      setErrors((prev) => ({
        ...prev,
        substitutionRate: "Too high! Maximum is 0.00100",
      }));
      return false;
    } else {
      setErrors((prev) => ({ ...prev, substitutionRate: "" }));
      return true;
    }
  };

  const runSimulationStep = () => {
    if (!sequence || currentGeneration >= params.numGenerations) {
      setIsRunning(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const rng = new SeededRandom(Date.now() + currentGeneration);

    const tempCelsius =
      params.tempUnit === "F"
        ? ((params.temperature - 32) * 5) / 9
        : params.temperature;
    const tempFactor = Math.pow(1.1, (tempCelsius - 37) / 5);
    const effectiveSubRate = params.substitutionRate * tempFactor;

    let seqArray = currentSequence.split("");
    const genMutations: MutationData[] = [];
    let genSubCount = 0;
    let genInsCount = 0;

    for (let i = 0; i < currentSequence.length; i++) {
      if (rng.next() < effectiveSubRate) {
        const originalBase = seqArray[i];
        const newBase = getMutatedBase(originalBase, rng);

        let aaChange = "none";
        const codonStart = Math.floor(i / 3) * 3;
        const originalCodon = currentSequence.substr(codonStart, 3);

        if (originalCodon.length === 3) {
          const tempCodon = originalCodon.split("");
          tempCodon[i % 3] = newBase;
          const newCodon = tempCodon.join("");
          if (CODON_MAP[originalCodon] !== CODON_MAP[newCodon]) {
            aaChange = `${CODON_MAP[originalCodon]}->${CODON_MAP[newCodon]}`;
          }
        }

        seqArray[i] = newBase;
        genMutations.push({
          generation: currentGeneration + 1,
          position: i,
          type: "substitution",
          original: originalBase,
          mutated: newBase,
          aminoAcidChange: aaChange,
          context: i < currentSequence.length - 100 ? "coding" : "non-coding",
        });
        genSubCount++;
      }
    }

    const newSeq = seqArray.join("");
    setCurrentSequence(newSeq);

    const allMutations = [...mutations, ...genMutations];
    setMutations(allMutations);
    setTotalMutations(allMutations.length);
    setSubstitutions(substitutions + genSubCount);
    setInsertions(insertions + genInsCount);

    const fitness = calculateFitness(newSeq, allMutations);
    const newStats: GenerationStats = {
      generation: currentGeneration + 1,
      fitness,
      mutationCount: genMutations.length,
      progress: ((currentGeneration + 1) / params.numGenerations) * 100,
      cumulativeMutations: allMutations.length,
    };

    setGenerationStats((prev) => [...prev, newStats]);
    setCurrentGeneration((prev) => prev + 1);
  };

  useEffect(() => {
    if (!isRunning) return;

    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current > 800) {
        runSimulationStep();
        lastUpdateRef.current = timestamp;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, currentGeneration, currentSequence]);

  const handleStart = () => {
    handleReset();
    if (!queryFastaFile || !sequence) {
      alert("Please upload a FASTA file before starting the simulation.");
      return;
    }

    if (isRunning) {
      setIsRunning(false);
    } else {
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentGeneration(0);
    setMutations([]);
    setGenerationStats([]);
    setTotalMutations(0);
    setSubstitutions(0);
    setInsertions(0);
    setCurrentSequence(sequence);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const handleExport = () => {
    const data = {
      finalSequence: currentSequence,
      mutations,
      generationStats,
      summary: {
        totalMutations,
        substitutions,
        insertions,
        finalGeneration: currentGeneration,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- Bench integration ------------------------------------------------
     Validation errors become Problems, each completed generation becomes a
     run-log line, and the run itself drives the status bar. */

  const problems = useMemo<WorkbenchAlert[]>(() => {
    const list: WorkbenchAlert[] = []
    for (const [field, message] of Object.entries(errors)) {
      if (message) {
        list.push({ source: "mutation-simulator", severity: "error", message, at: field })
      }
    }
    if (!queryFastaFile) {
      list.push({
        source: "mutation-simulator",
        severity: "info",
        message: "No query sequence loaded — upload a FASTA file to enable the run.",
      })
    }
    return list
  }, [errors, queryFastaFile])

  useAlerts("mutation-simulator", problems)

  const logLines = useMemo(
    () =>
      generationStats.map(
        (s) =>
          `gen ${s.generation}/${params.numGenerations} · ${s.mutationCount} mutations · fitness ${s.fitness.toFixed(1)} · total ${s.cumulativeMutations}`,
      ),
    [generationStats, params.numGenerations],
  )

  useLogStream("mutation-simulator", logLines)

  useRunStatus(
    useMemo(
      () =>
        currentGeneration > 0 || isRunning
          ? {
              label: "Mutation simulation",
              state: isRunning
                ? ("running" as const)
                : currentGeneration >= params.numGenerations
                  ? ("done" as const)
                  : ("paused" as const),
              progress: (currentGeneration / params.numGenerations) * 100,
              detail: `generation ${currentGeneration} of ${params.numGenerations}`,
            }
          : null,
      [currentGeneration, isRunning, params.numGenerations],
    ),
  )

  const currentFitness =
    generationStats.length > 0
      ? generationStats[generationStats.length - 1].fitness
      : 100

  useStatusItems(
    useMemo(
      () => [
        { id: "gen", label: `Gen ${currentGeneration}/${params.numGenerations}` },
        {
          id: "fit",
          label: `Fitness ${currentFitness.toFixed(1)}`,
          tone: currentFitness < 80 ? ("warning" as const) : ("default" as const),
        },
        { id: "mut", label: `${totalMutations} mutations` },
      ],
      [currentGeneration, params.numGenerations, currentFitness, totalMutations],
    ),
  )

  useViewContext(
    queryFastaFile
      ? `${queryFastaFile.name} · ${sequence.length.toLocaleString()} bp · ${params.numGenerations} generations at ${params.temperature}°${params.tempUnit}`
      : null,
  )

  return (
    <ViewLayout
      inspectorId="mutation-simulator"
      defaultInspectorSize={28}
      inspector={
        <SimulatorInspector
          params={params}
          setParams={setParams}
          errors={errors}
          isRunning={isRunning}
          sequence={sequence}
          queryFastaFile={queryFastaFile}
          onFileChange={handleFileChange}
          onStart={handleStart}
          onReset={handleReset}
          validateTemperature={validateTemperature}
          validatePH={validatePH}
          validateGenerations={validateGenerations}
          validateMutationRate={validateMutationRate}
        />
      }
    >
      <ViewScroll>
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile icon={Activity} label="Total mutations" value={totalMutations} />
            <StatTile label="Substitutions" value={substitutions} />
            <StatTile label="Insertions" value={insertions} />
            <StatTile
              label="Current fitness"
              value={currentFitness.toFixed(1)}
              tone={currentFitness < 80 ? "warning" : "positive"}
            />
          </div>

          <Pane>
            <PaneHeader
              icon={LineChartIcon}
              title="Mutation dynamics"
              subtitle="fitness vs cumulative mutations"
              actions={
                currentGeneration > 0 ? (
                  <ToolbarButton
                    icon={Download}
                    label="Export run as JSON"
                    onClick={handleExport}
                  />
                ) : null
              }
            />
            <div className="min-h-0 flex-1 p-3">
              {generationStats.length > 0 ? (
                <RunChart data={generationStats} />
              ) : (
                <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
                  <div
                    className={cn(
                      "size-10 rounded-full border-2 border-dashed border-border",
                      isRunning && "animate-spin border-brand/60",
                    )}
                  />
                  <p className="text-sm font-medium text-foreground">
                    {isRunning
                      ? `Simulating generation ${currentGeneration + 1}/${params.numGenerations}…`
                      : "Ready to simulate"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sequence
                      ? `Loaded ${sequence.length.toLocaleString()} bp sequence`
                      : "Upload a sequence in the inspector, then press Start"}
                  </p>
                </div>
              )}
            </div>
          </Pane>

          <Pane>
            <PaneHeader
              icon={ListChecks}
              title="Generation progress"
              subtitle={`${currentGeneration} of ${params.numGenerations} complete`}
            />
            <div className="space-y-1.5 p-3">
              {Array.from({ length: params.numGenerations }, (_, i) => i + 1).map(
                (gen) => {
                  const stat = generationStats.find((s) => s.generation === gen)
                  const isActive = gen === currentGeneration
                  return (
                    <div key={gen} className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "w-12 shrink-0 font-mono text-xs tabular",
                          stat ? "text-foreground/85" : "text-muted-foreground/60",
                        )}
                      >
                        gen {gen}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--wb-active)]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quint)]",
                            isActive && isRunning
                              ? "animate-soft-pulse bg-brand"
                              : "bg-brand/70",
                          )}
                          style={{ width: stat ? "100%" : "0%" }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground tabular">
                        {stat ? `${stat.mutationCount} mut` : "—"}
                      </span>
                    </div>
                  )
                },
              )}
            </div>
          </Pane>
        </div>
      </ViewScroll>
    </ViewLayout>
  )
}

/* ============================================================================
   Inspector — every simulation parameter, in one dense column
   ========================================================================= */

type Params = {
  tempUnit: "C" | "F"
  temperature: number
  substitutionRate: number
  numGenerations: number
  pH: number
  nutrients: string
  oxygen: string
}

function SimulatorInspector({
  params,
  setParams,
  errors,
  isRunning,
  sequence,
  queryFastaFile,
  onFileChange,
  onStart,
  onReset,
  validateTemperature,
  validatePH,
  validateGenerations,
  validateMutationRate,
}: {
  params: Params
  setParams: React.Dispatch<React.SetStateAction<Params>>
  errors: Record<string, string>
  isRunning: boolean
  sequence: string
  queryFastaFile: File | null
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onStart: () => void
  onReset: () => void
  validateTemperature: (v: number) => boolean
  validatePH: (v: number) => boolean
  validateGenerations: (v: number) => boolean
  validateMutationRate: (v: number) => boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="seq-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Pane>
          <PaneHeader icon={Upload} title="Query sequence" />
          <div className="space-y-2 p-3">
            <label
              htmlFor="query_fasta"
              className="group flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-3 transition-colors duration-150 hover:border-[var(--wb-border-strong)] hover:bg-[var(--wb-hover)]"
            >
              <Upload className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  Upload FASTA
                </span>
                <span className="block truncate text-xs text-muted-foreground/80">
                  .fasta .fa .fna .ffn .faa .frn
                </span>
              </span>
              <input
                type="file"
                accept=".fasta,.fa,.fna,.ffn,.faa,.frn"
                id="query_fasta"
                className="hidden"
                onChange={onFileChange}
              />
            </label>

            {queryFastaFile && (
              <div className="flex items-center gap-1.5 rounded-sm border border-border bg-[var(--wb-raised)] px-2 py-1 text-xs">
                <FileText className="size-3 shrink-0 text-brand-bright" />
                <span className="min-w-0 flex-1 truncate font-mono text-foreground/85">
                  {queryFastaFile.name}
                </span>
                <span className="shrink-0 text-muted-foreground tabular">
                  {sequence.length} bp
                </span>
              </div>
            )}
          </div>
        </Pane>

        <Pane>
          <PaneHeader icon={SlidersHorizontal} title="Parameters" />
          <div className="space-y-4 p-3">
            <Field label="Temperature" error={errors.temperature}>
              <div className="flex gap-1.5">
                <WBInput
                  type="number"
                  value={params.temperature}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (validateTemperature(val)) {
                      setParams((prev) => ({ ...prev, temperature: val }))
                    } else {
                      setParams((prev) => ({ ...prev, temperature: val }))
                    }
                  }}
                  disabled={isRunning}
                />
                <WBSelect
                  value={params.tempUnit}
                  onChange={(e) => {
                    setParams((prev) => ({
                      ...prev,
                      tempUnit: e.target.value as "C" | "F",
                    }))
                    validateTemperature(params.temperature)
                  }}
                  disabled={isRunning}
                  className="w-20"
                  aria-label="Temperature unit"
                >
                  <option value={"C"}>&deg;C</option>
                  <option value={"F"}>&deg;F</option>
                </WBSelect>
              </div>
            </Field>

            <Field
              label="pH balance"
              value={params.pH.toFixed(1)}
              error={errors.pH}
              hint="Acidic · Neutral · Alkaline"
            >
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="14"
                  step="0.1"
                  value={params.pH}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (validatePH(val)) {
                      setParams((prev) => ({ ...prev, pH: val }))
                    }
                  }}
                  disabled={isRunning}
                  aria-label="pH balance"
                />
                <WBInput
                  type="number"
                  min="0"
                  max="14"
                  step="0.1"
                  value={params.pH}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (validatePH(val)) {
                      setParams((prev) => ({ ...prev, pH: val }))
                    } else {
                      setParams((prev) => ({ ...prev, pH: val }))
                    }
                  }}
                  disabled={isRunning}
                />
              </div>
            </Field>

            <Field label="Nutrient availability">
              <WBSelect
                value={params.nutrients}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, nutrients: e.target.value }))
                }
                disabled={isRunning}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Excess</option>
              </WBSelect>
            </Field>

            <Field label="Oxygen level">
              <WBSelect
                value={params.oxygen}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, oxygen: e.target.value }))
                }
                disabled={isRunning}
              >
                <option>Anaerobic (None)</option>
                <option>Low</option>
                <option>Normal (21%)</option>
                <option>High</option>
              </WBSelect>
            </Field>

            <Field label="Generations" error={errors.numGenerations} hint="1 – 10 per run">
              <WBInput
                type="number"
                value={params.numGenerations}
                onChange={(e) => {
                  const nG = parseInt(e.target.value)
                  if (validateGenerations(nG)) {
                    setParams((prev) => ({ ...prev, numGenerations: nG }))
                  } else {
                    setParams((prev) => ({ ...prev, numGenerations: nG }))
                  }
                }}
                max={10}
                min={1}
                disabled={isRunning}
              />
            </Field>

            <Field
              label="Base mutation rate"
              value={params.substitutionRate.toFixed(5)}
              error={errors.substitutionRate}
            >
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="0.001"
                  step="0.00001"
                  value={params.substitutionRate}
                  disabled={isRunning}
                  aria-label="Base mutation rate"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (validateMutationRate(val)) {
                      setParams((prev) => ({ ...prev, substitutionRate: val }))
                    }
                  }}
                />
                <WBInput
                  type="number"
                  min="0"
                  max="0.001"
                  step="0.00001"
                  value={params.substitutionRate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (validateMutationRate(val)) {
                      setParams((prev) => ({ ...prev, substitutionRate: val }))
                    } else {
                      setParams((prev) => ({ ...prev, substitutionRate: val }))
                    }
                  }}
                  disabled={isRunning}
                />
              </div>
            </Field>
          </div>
        </Pane>
      </div>

      {/* Run controls stay pinned so they never scroll out of reach. */}
      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <Button onClick={onStart} disabled={!sequence} className="h-8 flex-1">
          {isRunning ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {isRunning ? "Pause" : "Start"}
        </Button>
        <Button onClick={onReset} variant="secondary" className="h-8 flex-1">
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </div>
    </div>
  )
}

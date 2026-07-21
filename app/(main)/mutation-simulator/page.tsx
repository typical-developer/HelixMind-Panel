"use client";

import { Play, Pause, RotateCcw, Upload, Download } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ui
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  return (
    <div className="space-x-8">
      <div className="ml-16 pt-16">
        <main className="mx-auto max-w-7xl container pt-8 bg-background min-w-full min-h-screen space-y-8">
          {/* Upload */}
          <div className="glass p-12 rounded-lg border-2 border-dashed border-primary/50 text-center mb-10">
            <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-semibold mb-2">
              Upload Query Sequence
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Drop your FASTA file here, or click to browse
            </p>

            <label
              htmlFor="query_fasta"
              className={cn(
                "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90, h-9 px-4 py-2 has-[>svg]:px-3"
              )}
            >
              Browse Files
              <input
                type="file"
                accept=".fasta,.fa,.fna,.ffn,.faa,.frn"
                id="query_fasta"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {queryFastaFile && (
              <div className="mt-4">
                <p className="text-sm text-primary font-medium">
                  {queryFastaFile.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sequence length: {sequence.length} bp
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT */}
            <div className="lg:col-span-2">
              <div className="glass p-8 rounded-lg mb-8">
                <h3 className="text-lg font-semibold mb-6">
                  Real-Time Mutation Dynamics
                </h3>

                <div className="bg-black/40 rounded-lg p-6 min-h-96 border border-border">
                  {generationStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={generationStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="generation"
                          stroke="#888"
                          label={{
                            value: "Generation",
                            position: "insideBottom",
                            offset: -5,
                          }}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#8b5cf6"
                          label={{
                            value: "Fitness",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#10b981"
                          label={{
                            value: "Mutations",
                            angle: 90,
                            position: "insideRight",
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(0,0,0,0.8)",
                            border: "1px solid #333",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="fitness"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ fill: "#8b5cf6", r: 4 }}
                          name="Fitness Score"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="cumulativeMutations"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: "#10b981", r: 4 }}
                          name="Total Mutations"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-80">
                      <div className="text-center">
                        <div
                          className={`w-32 h-32 mx-auto mb-4 border-2 border-primary/50 rounded-full ${
                            isRunning ? "animate-spin" : ""
                          }`}
                        />
                        <p className="text-primary font-semibold">
                          {isRunning
                            ? `Simulating Generation ${currentGeneration + 1}/${
                                params.numGenerations
                              }...`
                            : "Ready to simulate"}
                        </p>
                        <p className="text-muted-foreground text-sm mt-2">
                          {sequence
                            ? `Loaded ${sequence.length} bp sequence`
                            : "Upload a sequence and click start"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass p-6 rounded-lg mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-primary">
                    Statistics
                  </h3>
                  {currentGeneration > 0 && (
                    <button
                      onClick={handleExport}
                      className="text-xs bg-primary/20 hover:bg-primary/30 px-3 py-1 rounded flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Export JSON
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-card/50 p-4 rounded-lg">
                    <span className="text-muted-foreground block mb-1">
                      Total Mutations
                    </span>
                    <span className="text-2xl text-primary font-bold">
                      {totalMutations}
                    </span>
                  </div>
                  <div className="bg-card/50 p-4 rounded-lg">
                    <span className="text-muted-foreground block mb-1">
                      Substitutions
                    </span>
                    <span className="text-2xl text-primary font-bold">
                      {substitutions}
                    </span>
                  </div>
                  <div className="bg-card/50 p-4 rounded-lg">
                    <span className="text-muted-foreground block mb-1">
                      Insertions
                    </span>
                    <span className="text-2xl text-primary font-bold">
                      {insertions}
                    </span>
                  </div>
                  <div className="bg-card/50 p-4 rounded-lg">
                    <span className="text-muted-foreground block mb-1">
                      Current Fitness
                    </span>
                    <span className="text-2xl text-primary font-bold">
                      {generationStats.length > 0
                        ? generationStats[
                            generationStats.length - 1
                          ].fitness.toFixed(1)
                        : "100.0"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">
                  Generation Progress
                </h3>
                <ScrollArea className="min-h-[100px]">
                  <div className="space-y-3">
                    {Array.from(
                      { length: params.numGenerations },
                      (_, i) => i + 1
                    ).map((gen) => {
                      const stat = generationStats.find(
                        (s) => s.generation === gen
                      );
                      const isActive = gen === currentGeneration;
                      return (
                        <div
                          key={gen}
                          className={`flex items-center gap-3 transition-all ${
                            isActive ? "scale-105" : ""
                          }`}
                        >
                          <span
                            className={`text-sm w-12 font-medium ${
                              stat ? "text-primary" : "text-muted-foreground"
                            }`}
                          >
                            Gen {gen}
                          </span>
                          <div className="flex-1 bg-card rounded-full h-3 overflow-hidden border border-border/50">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isActive && isRunning
                                  ? "bg-gradient-to-r from-primary via-secondary to-primary animate-pulse"
                                  : "bg-gradient-to-r from-primary to-secondary"
                              }`}
                              style={{
                                width: stat ? `100%` : "0%",
                              }}
                            />
                          </div>
                          {stat && (
                            <span className="text-xs text-muted-foreground w-20 text-right">
                              {stat.mutationCount} mutations
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* RIGHT */}
            <div>
              <div className="glass p-6 rounded-lg mb-6">
                <h3 className="text-lg font-semibold mb-4">
                  Simulation Parameters
                </h3>

                <ScrollArea className="min-h-[600px]">
                  <div className="space-y-6 mb-10">
                    {/* temperatire */}
                    <div>
                      <label className="text-sm block mb-2">
                        Temperature
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={params.temperature}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (validateTemperature(val)) {
                              setParams((prev) => ({
                                ...prev,
                                temperature: val,
                              }));
                            } else {
                              setParams((prev) => ({
                                ...prev,
                                temperature: val,
                              }));
                            }
                          }}
                          disabled={isRunning}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                        />
                        <select
                          value={params.tempUnit}
                          onChange={(e) => {
                            setParams((prev) => ({
                              ...prev,
                              tempUnit: e.target.value as "C" | "F",
                            }));
                            validateTemperature(params.temperature);
                          }}
                          disabled={isRunning}
                          className="bg-card border border-border rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                        >
                          <option value={"C"}>°C</option>
                          <option value={"F"}>°F</option>
                        </select>
                      </div>
                      {errors.temperature && (
                        <p className="text-xs text-red-400 mt-1">
                          {errors.temperature}
                        </p>
                      )}
                    </div>

                    {/* ph balance */}
                    <div>
                      <label className="text-sm block mb-2">
                        pH Balance: {params.pH.toFixed(1)}
                      </label>
                      <div className="flex flex-col gap-2 mb-2">
                        <input
                          type="range"
                          min="0"
                          max="14"
                          step="0.1"
                          value={params.pH}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (validatePH(val)) {
                              setParams((prev) => ({ ...prev, pH: val }));
                            }
                          }}
                          disabled={isRunning}
                          className="flex-1 accent-primary disabled:opacity-50"
                        />
                        <input
                          type="number"
                          min="0"
                          max="14"
                          step="0.1"
                          value={params.pH}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (validatePH(val)) {
                              setParams((prev) => ({ ...prev, pH: val }));
                            } else {
                              setParams((prev) => ({ ...prev, pH: val }));
                            }
                          }}
                          disabled={isRunning}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Acidic</span>
                        <span>Neutral</span>
                        <span>Alkaline</span>
                      </div>
                      {errors.pH && (
                        <p className="text-xs text-red-400 mt-1">{errors.pH}</p>
                      )}
                    </div>

                    {/* nutrient availability */}
                    <div>
                      <label className="text-sm block mb-2">
                        Nutrient Availability
                      </label>
                      <select
                        value={params.nutrients}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            nutrients: e.target.value,
                          }))
                        }
                        disabled={isRunning}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Excess</option>
                      </select>
                    </div>

                    {/* oxygen level */}
                    <div>
                      <label className="text-sm block mb-2">
                        Oxygen Level
                      </label>
                      <select
                        value={params.oxygen}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            oxygen: e.target.value,
                          }))
                        }
                        disabled={isRunning}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                      >
                        <option>Anaerobic (None)</option>
                        <option>Low</option>
                        <option>Normal (21%)</option>
                        <option>High</option>
                      </select>
                    </div>

                    {/* number of generations */}
                    <div>
                      <label className="text-sm block mb-2">
                        Number of Generations
                      </label>
                      <input
                        type="number"
                        value={params.numGenerations}
                        onChange={(e) => {
                          const nG = parseInt(e.target.value);
                          if (validateGenerations(nG)) {
                            setParams((prev) => ({
                              ...prev,
                              numGenerations: nG,
                            }));
                          } else {
                            setParams((prev) => ({
                              ...prev,
                              numGenerations: nG,
                            }));
                          }
                        }}
                        max={10}
                        min={1}
                        disabled={isRunning}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                      />
                      {errors.numGenerations && (
                        <p className="text-xs text-red-400 mt-1">
                          {errors.numGenerations}
                        </p>
                      )}
                    </div>

                    {/* base mutation */}
                    <div>
                      <label className="text-sm block mb-2">
                        Base Mutation Rate: {params.substitutionRate.toFixed(5)}
                      </label>
                      <div className="flex flex-col gap-2 mb-2">
                        <input
                          type="range"
                          min="0"
                          max="0.001"
                          step="0.00001"
                          value={params.substitutionRate}
                          className="flex-1 accent-primary disabled:opacity-50"
                          disabled={isRunning}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (validateMutationRate(val)) {
                              setParams((prev) => ({
                                ...prev,
                                substitutionRate: val,
                              }));
                            }
                          }}
                        />
                        <input
                          type="number"
                          min="0"
                          max="0.001"
                          step="0.00001"
                          value={params.substitutionRate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (validateMutationRate(val)) {
                              setParams((prev) => ({
                                ...prev,
                                substitutionRate: val,
                              }));
                            } else {
                              setParams((prev) => ({
                                ...prev,
                                substitutionRate: val,
                              }));
                            }
                          }}
                          disabled={isRunning}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                        />
                      </div>
                      {errors.substitutionRate && (
                        <p className="text-xs text-red-400 mt-1">
                          {errors.substitutionRate}
                        </p>
                      )}
                    </div>
                  </div>
                </ScrollArea>

                {/* action buttons */}
                <div className="flex items-center w-full gap-2 mt-0">
                  <Button
                    onClick={handleStart}
                    disabled={!sequence}
                    className="w-1/2"
                  >
                    {isRunning ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {isRunning ? "Pause" : "Start"}
                  </Button>

                  <Button
                    onClick={handleReset}
                    variant={"secondary"}
                    className="w-1/2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

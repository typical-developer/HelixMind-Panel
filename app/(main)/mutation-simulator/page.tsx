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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ui
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChartFallback } from "@/components/chart-fallback";
import { toast } from "@/hooks/use-toast";
import { recordActivity } from "@/lib/activity-store";
import { downloadJSON, fileStamp } from "@/lib/download";
import {
  FASTA_EXTENSIONS,
  parseFasta,
  findORFs,
  validateFastaFile,
  type ORF,
} from "@/lib/fasta";
import {
  calculateFitness,
  createRandom,
  nextRunAction,
  runGeneration,
  toCelsius,
  type GenerationStats,
  type MutationRecord,
  type SimulationParams,
} from "@/lib/mutation-model";

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

/** Milliseconds between generations. Slow enough to watch the plot build. */
const GENERATION_INTERVAL = 800;

const MAX_GENERATIONS = 10;

export default function MutationSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [queryFastaFile, setQueryFastaFile] = useState<File | null>(null);
  const [sequence, setSequence] = useState<string>("");
  const [sequenceHeader, setSequenceHeader] = useState<string>("");
  const [params, setParams] = useState<SimulationParams>({
    tempUnit: "C",
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
  const [mutations, setMutations] = useState<MutationRecord[]>([]);
  const [generationStats, setGenerationStats] = useState<GenerationStats[]>([]);
  const [totals, setTotals] = useState({
    substitutions: 0,
    insertions: 0,
    deletions: 0,
  });
  const [currentSequence, setCurrentSequence] = useState("");
  /**
   * The seed the run started from.
   *
   * The original `SeededRandom` was re-seeded with `Date.now() + generation`
   * on every step, so nothing about a run was reproducible despite the name.
   * The seed is fixed when a run starts, carried through every generation, and
   * written into the export so a run can be repeated exactly.
   */
  const [seed, setSeed] = useState<number | null>(null);

  /** Kept across generations so the random stream is continuous. */
  const randomRef = useRef<(() => number) | null>(null);
  /** ORFs of the original sequence, computed once per upload. */
  const orfsRef = useRef<ORF[]>([]);
  /** Set once per run so completion is announced exactly once. */
  const announced = useRef(false);

  const totalMutations = mutations.length;

  /* ---- Input ------------------------------------------------------------ */

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const check = validateFastaFile(file);
      if (!check.ok) {
        toast({
          variant: "destructive",
          title: "That file can't be simulated",
          description: check.error,
        });
        return;
      }

      try {
        const text = await file.text();
        const records = parseFasta(text);
        const first = records[0];

        if (!first) {
          toast({
            variant: "destructive",
            title: "No sequences found",
            description: `${file.name} contains no FASTA records.`,
          });
          return;
        }

        setQueryFastaFile(file);
        setSequence(first.sequence);
        setSequenceHeader(first.header);
        setCurrentSequence(first.sequence);
        orfsRef.current = findORFs(first.sequence);
        // A new sequence invalidates whatever the previous run produced.
        setIsRunning(false);
        setCurrentGeneration(0);
        setMutations([]);
        setGenerationStats([]);
        setTotals({ substitutions: 0, insertions: 0, deletions: 0 });
        setSeed(null);

        toast({
          variant: "success",
          title: "Sequence loaded",
          description: `${first.header} · ${first.sequence.length.toLocaleString()} bp · ${orfsRef.current.length} ORF${
            orfsRef.current.length === 1 ? "" : "s"
          }`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Couldn't read the file",
          description:
            error instanceof Error ? error.message : "The file could not be read.",
        });
      }
    },
    [],
  );

  /* ---- Validation ------------------------------------------------------- */

  const validateTemperature = useCallback(
    (value: number) => {
      const min = params.tempUnit === "C" ? -10 : 14;
      const max = params.tempUnit === "C" ? 100 : 212;
      const message = Number.isNaN(value)
        ? "Enter a number"
        : value < min
          ? `Too low — the minimum is ${min}°${params.tempUnit}`
          : value > max
            ? `Too high — the maximum is ${max}°${params.tempUnit}`
            : "";
      setErrors((prev) => ({ ...prev, temperature: message }));
      return message === "";
    },
    [params.tempUnit],
  );

  const validatePH = useCallback((value: number) => {
    const message = Number.isNaN(value)
      ? "Enter a number"
      : value < 0
        ? "Too low — the minimum is 0.0"
        : value > 14
          ? "Too high — the maximum is 14.0"
          : "";
    setErrors((prev) => ({ ...prev, pH: message }));
    return message === "";
  }, []);

  const validateGenerations = useCallback((value: number) => {
    const message = Number.isNaN(value)
      ? "Enter a whole number"
      : value < 1
        ? "Too low — the minimum is 1"
        : value > MAX_GENERATIONS
          ? `Too high — the maximum is ${MAX_GENERATIONS}`
          : "";
    setErrors((prev) => ({ ...prev, numGenerations: message }));
    return message === "";
  }, []);

  const validateMutationRate = useCallback((value: number) => {
    const message = Number.isNaN(value)
      ? "Enter a number"
      : value < 0
        ? "Too low — the minimum is 0.00000"
        : value > 0.001
          ? "Too high — the maximum is 0.00100"
          : "";
    setErrors((prev) => ({ ...prev, substitutionRate: message }));
    return message === "";
  }, []);

  /* ---- Run -------------------------------------------------------------- */

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setCurrentGeneration(0);
    setMutations([]);
    setGenerationStats([]);
    setTotals({ substitutions: 0, insertions: 0, deletions: 0 });
    setCurrentSequence(sequence);
    setSeed(null);
    randomRef.current = null;
    announced.current = false;
  }, [sequence]);

  /**
   * Start, pause or resume.
   *
   * This used to call `handleReset()` on its first line, unconditionally —
   * which set `isRunning` to false, so the `isRunning` check immediately below
   * it could never be true. Pressing "Pause" threw the run away and started it
   * again from generation zero; the button had never once paused anything.
   */
  const handleStart = useCallback(() => {
    const invalid = Object.entries(errors).find(([, message]) => message !== "");

    // The decision lives in lib/mutation-model.ts so it can be tested; see the
    // note there on what this used to do instead.
    const action = nextRunAction({
      isRunning,
      hasSequence: Boolean(queryFastaFile && sequence),
      currentGeneration,
      numGenerations: params.numGenerations,
      hasInvalidParams: Boolean(invalid),
    });

    if (action === "pause") {
      setIsRunning(false);
      return;
    }

    if (action === "blocked") {
      // Parameters were only ever validated as they were typed; nothing
      // checked them at the point of starting, so a run could begin on a value
      // the inspector was already showing as an error.
      toast(
        invalid
          ? {
              variant: "destructive",
              title: "Check the parameters",
              description: invalid[1],
            }
          : {
              variant: "destructive",
              title: "No sequence loaded",
              description: "Upload a FASTA file before starting the simulation.",
            },
      );
      return;
    }

    if (action === "restart") handleReset();

    if (randomRef.current === null) {
      const nextSeed = Date.now() >>> 0;
      setSeed(nextSeed);
      randomRef.current = createRandom(nextSeed);
      announced.current = false;
    }

    setIsRunning(true);
  }, [
    currentGeneration,
    errors,
    handleReset,
    isRunning,
    params.numGenerations,
    queryFastaFile,
    sequence,
  ]);

  /**
   * The generation loop.
   *
   * One timer per completed generation rather than a self-rescheduling
   * animation frame: the previous loop re-created its `requestAnimationFrame`
   * chain on every state change it caused, which made its effective cadence
   * depend on how often React happened to re-render.
   */
  useEffect(() => {
    if (!isRunning) return;

    if (currentGeneration >= params.numGenerations || !currentSequence) {
      setIsRunning(false);
      return;
    }

    const timer = window.setTimeout(() => {
      const random = randomRef.current;
      if (!random) return;

      const generation = currentGeneration + 1;
      const result = runGeneration(
        currentSequence,
        generation,
        params,
        random,
        orfsRef.current,
      );

      setCurrentSequence(result.sequence);
      setMutations((prev) => {
        const all = [...prev, ...result.mutations];
        setGenerationStats((stats) => [
          ...stats,
          {
            generation,
            fitness: calculateFitness(all),
            mutationCount: result.mutations.length,
            progress: (generation / params.numGenerations) * 100,
            cumulativeMutations: all.length,
          },
        ]);
        return all;
      });
      setTotals((prev) => ({
        substitutions: prev.substitutions + result.substitutions,
        insertions: prev.insertions + result.insertions,
        deletions: prev.deletions + result.deletions,
      }));
      setCurrentGeneration(generation);
    }, GENERATION_INTERVAL);

    return () => window.clearTimeout(timer);
  }, [isRunning, currentGeneration, currentSequence, params]);

  /** Announce completion once, when the last generation lands. */
  useEffect(() => {
    if (
      currentGeneration === 0 ||
      currentGeneration < params.numGenerations ||
      announced.current
    ) {
      return;
    }
    announced.current = true;

    recordActivity({
      kind: "simulation.completed",
      engine: "simulator",
      label: `Simulation · ${params.numGenerations} generations`,
      detail: `${sequenceHeader || queryFastaFile?.name || "sequence"} · ${
        mutations.length
      } mutation${mutations.length === 1 ? "" : "s"}`,
      href: "/mutation-simulator",
      severity: "success",
      value: params.numGenerations,
    });
  }, [
    currentGeneration,
    mutations.length,
    params.numGenerations,
    queryFastaFile,
    sequenceHeader,
  ]);

  const currentFitness =
    generationStats.length > 0
      ? generationStats[generationStats.length - 1].fitness
      : 100;

  /* ---- Export ----------------------------------------------------------- */

  const handleExport = () => {
    downloadJSON(
      {
        metadata: {
          sequence: sequenceHeader,
          file: queryFastaFile?.name ?? null,
          startingLength: sequence.length,
          finalLength: currentSequence.length,
          // Enough to reproduce the run exactly.
          seed,
          parameters: params,
          temperatureCelsius: toCelsius(params.temperature, params.tempUnit),
          generatedAt: new Date().toISOString(),
          note: "pH, nutrients and oxygen are recorded but do not currently affect the model.",
        },
        summary: {
          totalMutations: mutations.length,
          ...totals,
          finalGeneration: currentGeneration,
          finalFitness: currentFitness,
        },
        generationStats,
        mutations,
        finalSequence: currentSequence,
      },
      {
        filename: `mutation-run-${fileStamp()}.json`,
        engine: "simulator",
        description: `${currentGeneration} generation${
          currentGeneration === 1 ? "" : "s"
        }, ${mutations.length} mutation${mutations.length === 1 ? "" : "s"}.`,
      },
    );
  };

  /* ---- Bench integration ------------------------------------------------
     Validation errors become Problems, each completed generation becomes a
     run-log line, and the run itself drives the status bar. */

  const problems = useMemo<WorkbenchAlert[]>(() => {
    const list: WorkbenchAlert[] = [];
    for (const [field, message] of Object.entries(errors)) {
      if (message) {
        list.push({
          source: "mutation-simulator",
          severity: "error",
          message,
          at: field,
        });
      }
    }
    if (!queryFastaFile) {
      list.push({
        source: "mutation-simulator",
        severity: "info",
        message: "No query sequence loaded — upload a FASTA file to enable the run.",
      });
    }
    if (currentFitness < 60 && currentGeneration > 0) {
      list.push({
        source: "mutation-simulator",
        severity: "warning",
        message: `Fitness has fallen to ${currentFitness.toFixed(1)} — the sequence is accumulating damaging changes.`,
        at: `generation ${currentGeneration}`,
      });
    }
    return list;
  }, [errors, queryFastaFile, currentFitness, currentGeneration]);

  useAlerts("mutation-simulator", problems);

  const logLines = useMemo(
    () =>
      generationStats.map(
        (s) =>
          `gen ${s.generation}/${params.numGenerations} · ${s.mutationCount} mutations · fitness ${s.fitness.toFixed(1)} · total ${s.cumulativeMutations}`,
      ),
    [generationStats, params.numGenerations],
  );

  useLogStream("mutation-simulator", logLines);

  useRunStatus(
    useMemo(
      () =>
        currentGeneration > 0 || isRunning
          ? {
              label: "Mutation simulation",
              source: "mutation-simulator",
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
  );

  useStatusItems(
    useMemo(
      () => [
        {
          id: "gen",
          label: `Gen ${currentGeneration}/${params.numGenerations}`,
          title: "Generations completed in this run",
        },
        {
          id: "fit",
          label: `Fitness ${currentFitness.toFixed(1)}`,
          title:
            "Starts at 100; coding substitutions and indels reduce it",
          tone: currentFitness < 80 ? ("warning" as const) : ("default" as const),
        },
        {
          id: "mut",
          label: `${totalMutations} mutations`,
          title: `${totals.substitutions} substitutions, ${totals.insertions} insertions, ${totals.deletions} deletions`,
        },
      ],
      [
        currentGeneration,
        params.numGenerations,
        currentFitness,
        totalMutations,
        totals,
      ],
    ),
  );

  useViewContext(
    queryFastaFile
      ? `${sequenceHeader || queryFastaFile.name} · ${sequence.length.toLocaleString()} bp · ${params.numGenerations} generations at ${params.temperature}°${params.tempUnit}`
      : null,
  );

  const substitutions = totals.substitutions;
  const insertions = totals.insertions;

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
          <div className="grid grid-cols-1 gap-3 @sm/bench:grid-cols-2 @4xl/bench:grid-cols-4">
            <StatTile icon={Activity} label="Total mutations" value={totalMutations} />
            <StatTile label="Substitutions" value={substitutions} />
            <StatTile
              label="Indels"
              value={insertions + totals.deletions}
              hint={`${insertions} in · ${totals.deletions} del`}
              tone={insertions + totals.deletions > 0 ? "warning" : "default"}
            />
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
  params: SimulationParams
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>
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
                  {FASTA_EXTENSIONS.join(" ")}
                </span>
              </span>
              <input
                type="file"
                accept={FASTA_EXTENSIONS.join(",")}
                id="query_fasta"
                className="hidden"
                onChange={onFileChange}
              />
            </label>

            {queryFastaFile && (
              <div className="flex items-center gap-1.5 rounded-sm border border-border bg-[var(--wb-raised)] px-2 py-1 text-xs">
                <FileText className="size-3 shrink-0 text-muted-foreground" />
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

"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  DnaIcon,
  Plus,
  FileText,
  Thermometer,
  ImageDown,
  Pill,
  AlertTriangle,
  Activity,
  Clock,
  LineChart as LineChartIcon,
} from "lucide-react";
import dynamic from "next/dynamic";

// components
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ChartFallback } from "@/components/chart-fallback";

// Recharts is the heaviest dependency on this route and the experiment's
// controls do not need it, so the plot loads as its own chunk.
const PopulationChart = dynamic(
  () => import("./population-chart").then((m) => m.PopulationChart),
  { ssr: false, loading: () => <ChartFallback height={288} /> },
);
import { toast } from "@/hooks/use-toast";
import { recordActivity } from "@/lib/activity-store";
import { downloadBlob, downloadCSV, fileStamp, safeFilename } from "@/lib/download";
import {
  FASTA_EXTENSIONS,
  parseFasta,
  sequenceStats,
  validateFastaFile,
} from "@/lib/fasta";
import {
  MicrobeSimulation,
  type SimulationState,
} from "@/lib/growth-model";
import {
  Chip,
  ViewLayout,
  ViewScroll,
  Field,
  Pane,
  PaneHeader,
  StatTile,
  ToolbarButton,
  WBInput,
  useLogStream,
  useAlerts,
  useRunStatus,
  useStatusItems,
  useViewContext,
  type WorkbenchAlert,
} from "@/components/workbench";

// ────────────────────────────────────────────────
//  TYPES
// ────────────────────────────────────────────────
interface Strain {
  name: string;
  description: string;
  growthRate: number;
  tempOptimal: number;
  resistance: number;
}

interface GenomeInfo {
  header: string;
  length: number;
  gcContent: string;
  resistanceGenes: number;
  estimatedGrowthRate: number;
  estimatedResistance: number;
}

// ────────────────────────────────────────────────
//  STRAINS
// ────────────────────────────────────────────────
//
// KNOWN GAP — these values are shown but do not reach the model. Picking
// Thermus aquaticus, whose optimum is 70 °C, behaves exactly like E. coli
// because `MicrobeSimulation` has a fixed 37 °C optimum and a fixed maximum
// growth rate. Recorded in docs/BUG-REPORT.md; the controls are kept so the
// intended shape of the feature stays visible.
const STRAINS: Record<string, Strain> = {
  ecoli: {
    name: "E. coli",
    description: "Fast-growing, commonly studied in labs",
    growthRate: 0.35,
    tempOptimal: 37,
    resistance: 0.0,
  },
  bacillus: {
    name: "Bacillus subtilis",
    description: "Gram-positive, produces spores",
    growthRate: 0.25,
    tempOptimal: 37,
    resistance: 0.05,
  },
  pseudomonas: {
    name: "Pseudomonas aeruginosa",
    description: "Opportunistic pathogen, antibiotic-resistant",
    growthRate: 0.2,
    tempOptimal: 37,
    resistance: 0.4,
  },
  thermophile: {
    name: "Thermus aquaticus",
    description: "Extreme thermophile, heat-stable",
    growthRate: 0.28,
    tempOptimal: 70,
    resistance: 0.1,
  },
  acidophile: {
    name: "Acidobacteria",
    description: "Acid-loving bacterium",
    growthRate: 0.18,
    tempOptimal: 37,
    resistance: 0.15,
  },
};

// ────────────────────────────────────────────────
//  MAIN COMPONENT
// ────────────────────────────────────────────────
export default function MicrobeGrowthLab() {
  const [sim] = useState(() => new MicrobeSimulation());
  const [isRunning, setIsRunning] = useState(false);
  const [state, setState] = useState<SimulationState>(sim.getState());
  const [selectedStrain, setSelectedStrain] = useState("ecoli");
  const [showCustomStrain, setShowCustomStrain] = useState(false);
  const [customStrain, setCustomStrain] = useState<Strain>({
    name: "Custom Strain",
    description: "User-defined strain",
    growthRate: 0.3,
    tempOptimal: 37,
    resistance: 0.0,
  });
  const [genomeInfo, setGenomeInfo] = useState<GenomeInfo | null>(null);

  const [temperature, setTemperature] = useState(37);
  const [pH, setPH] = useState(7.0);
  const [nutrients, setNutrients] = useState(100);
  const [oxygen, setOxygen] = useState(21);
  const [antibioticOn, setAntibioticOn] = useState(false);

  // Validation warnings
  const [tempWarning, setTempWarning] = useState("");
  const [phWarning, setPhWarning] = useState("");

  // Ref attached to chart wrapper so handleExportPNG can find the SVG inside
  const chartRef = useRef<HTMLDivElement>(null);

  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => state.growthHistory, [state.growthHistory]);

  // Sync environment changes
  useEffect(() => {
    sim.updateEnvironment({ temperature, pH, nutrients, oxygen, antibioticOn });
  }, [temperature, pH, nutrients, oxygen, antibioticOn, sim]);

  // Simulation loop
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const newState = sim.tick();
      setState(newState);
    }, 300);
    return () => clearInterval(interval);
  }, [isRunning, sim]);

  /**
   * Summarise an uploaded genome.
   *
   * The parsing was a third private implementation — it kept every character
   * of every non-header line, including digits and whitespace, so the reported
   * length and GC content were both wrong for any file with line numbering.
   * It uses the shared parser now.
   *
   * The resistance-marker count is a header text search, not an alignment: it
   * looks for known gene names in the description line. That is all it has
   * ever done, and the inspector says so.
   */
  const analyzeFastaGenome = (fastaText: string): GenomeInfo | null => {
    const record = parseFasta(fastaText)[0];
    if (!record) return null;

    const stats = sequenceStats(record.sequence);
    const haystack = `${record.header} ${record.description}`.toLowerCase();
    const resistanceGeneCount = ["gyra", "rpob", "katg", "efflux", "beta"].filter(
      (pattern) => haystack.includes(pattern),
    ).length;

    const baseGrowthRate = 0.35 - (stats.length > 5_000_000 ? 0.05 : 0);
    const baseResistance = Math.min(
      0.8,
      resistanceGeneCount * 0.15 + (stats.gcContent / 100) * 0.1,
    );

    return {
      header: record.header,
      length: stats.length,
      gcContent: stats.gcContent.toFixed(1),
      resistanceGenes: resistanceGeneCount,
      estimatedGrowthRate: Math.max(0.1, baseGrowthRate),
      estimatedResistance: baseResistance,
    };
  };

  const handleFastaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const check = validateFastaFile(file);
    if (!check.ok) {
      toast({
        variant: "destructive",
        title: "That file can't be read",
        description: check.error,
      });
      return;
    }

    try {
      const info = analyzeFastaGenome(await file.text());

      if (!info) {
        toast({
          variant: "destructive",
          title: "No sequence found",
          description: `${file.name} contains no FASTA records.`,
        });
        return;
      }

      setGenomeInfo(info);
      setCustomStrain({
        name: info.header || "FASTA strain",
        description: `${info.length.toLocaleString()} bp · GC ${info.gcContent}% · ${info.resistanceGenes} marker${info.resistanceGenes === 1 ? "" : "s"}`,
        growthRate: info.estimatedGrowthRate,
        tempOptimal: 37,
        resistance: info.estimatedResistance,
      });
      setShowCustomStrain(true);
      setSelectedStrain("custom");

      toast({
        variant: "success",
        title: "Genome loaded",
        description: `${info.header} · ${info.length.toLocaleString()} bp · GC ${info.gcContent}%`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't read the file",
        description:
          error instanceof Error ? error.message : "The file could not be read.",
      });
    }
  };

  const handleStrainChange = (key: string) => {
    if (key === "custom") {
      setShowCustomStrain(true);
      setSelectedStrain("custom");
    } else {
      setShowCustomStrain(false);
      setSelectedStrain(key);
      const strain = STRAINS[key];
      setTemperature(strain.tempOptimal);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    sim.reset();
    const strain = showCustomStrain ? customStrain : STRAINS[selectedStrain];
    sim.avgResistance = strain.resistance;
    setState(sim.getState());
    setTemperature(strain.tempOptimal);
    setPH(7.0);
    setNutrients(100);
    setOxygen(21);
    setAntibioticOn(false);
    setTempWarning("");
    setPhWarning("");
  };

  const handleStartPause = () => {
    if (!isRunning) {
      setIsRunning(true);
      return;
    }

    setIsRunning(false);

    // Pausing is how an experiment ends here — there is no fixed number of
    // steps to reach — so this is where the run is recorded for the Overview,
    // the notification feed and the console's history.
    if (state.timeStep > 0) {
      recordActivity({
        kind: "growth.completed",
        engine: "growth",
        label: `Growth experiment · ${currentStrain.name}`,
        detail: `${state.timeStep} steps · ${state.population.toLocaleString()} cells · resistance ${state.resistanceLevel}%`,
        href: "/microbe-growth-lab",
        severity: state.population === 0 ? "warning" : "success",
        value: state.timeStep,
      });
    }
  };

  const handleExport = () => {
    if (state.growthHistory.length === 0) {
      toast({
        variant: "warning",
        title: "Nothing to export",
        description: "Run the experiment first — there is no growth curve yet.",
      });
      return;
    }

    // The resistance column used to repeat the *final* value against every
    // historical row, so an exported curve claimed the culture had been fully
    // resistant from inoculation.
    downloadCSV(
      ["Step", "Population", "Resistance (%)"],
      state.growthHistory.map((point) => [
        point.time,
        point.population,
        point.time === state.timeStep ? state.resistanceLevel : "",
      ]),
      {
        filename: `${safeFilename(currentStrain.name)}-growth-${fileStamp()}.csv`,
        engine: "growth",
        description: `${state.growthHistory.length} steps of ${currentStrain.name}.`,
      },
    );
  };

  // ── PNG Export ──────────────────────────────────────────────────────────────
  // How this works:
  //  1. Find the live SVG that Recharts rendered inside chartRef
  //  2. Deep-clone it so we never mutate what's on screen
  //  3. Prepend a dark background rect so the export isn't transparent
  //  4. Walk every live element, read its computed CSS, and bake those values
  //     as inline styles onto the matching cloned element — necessary because
  //     the serialised SVG blob has no stylesheet context
  //  5. Second pass: force text/axis/grid colours explicitly using both
  //     .style and setAttribute so they survive all browser renderers
  //  6. Serialise clone → Blob → object URL → Image
  //  7. Draw onto a 2× canvas (retina quality) with padding, then download PNG
  // ───────────────────────────────────────────────────────────────────────────
  const handleExportPNG = () => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg || chartData.length === 0) {
      toast({
        variant: "warning",
        title: "Nothing to export",
        description: "Run the experiment first — there is no chart to capture.",
      });
      return;
    }

    const cloned = svg.cloneNode(true) as SVGElement;
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Capture rendered size before touching the clone
    const rect = svg.getBoundingClientRect();

    // Dark background rect so the PNG isn't transparent.
    //
    // The export bakes literal hex — a detached SVG has no stylesheet, so the
    // `var(--…)` the chart normally draws with resolves to nothing. These
    // mirror `--wb-surface`, `--gray-1000` and `--gray-500`, and have to be
    // moved by hand when those move.
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#121212");
    cloned.insertBefore(bg, cloned.firstChild);

    // Bake computed styles — without this the blob SVG loses all colour
    svg.querySelectorAll("*").forEach((el, i) => {
      const computed = window.getComputedStyle(el);
      const target = cloned.querySelectorAll("*")[i] as SVGElement;
      [
        "fill", "stroke", "stroke-width", "stroke-dasharray",
        "font-size", "font-family", "text-anchor", "dominant-baseline",
      ].forEach((prop) => {
        const val = computed.getPropertyValue(prop);
        if (val) target.style.setProperty(prop, val);
      });
    });

    // Force text to be visible on the dark background
    cloned.querySelectorAll("text, tspan").forEach((el) => {
      (el as SVGElement).style.fill = "#e0e0e0";
      (el as SVGElement).setAttribute("fill", "#e0e0e0");
    });

    // Axis lines
    cloned
      .querySelectorAll(".recharts-cartesian-axis-line, .recharts-cartesian-axis-tick-line")
      .forEach((el) => {
        (el as SVGElement).style.stroke = "#e0e0e0";
        (el as SVGElement).setAttribute("stroke", "#e0e0e0");
      });

    // Subtle grid lines
    cloned
      .querySelectorAll(
        ".recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line"
      )
      .forEach((el) => {
        (el as SVGElement).style.stroke = "#4d4d4d";
        (el as SVGElement).setAttribute("stroke", "#4d4d4d");
      });

    // Data line — white, no fill flood
    cloned.querySelectorAll(".recharts-line-curve").forEach((el) => {
      (el as SVGElement).style.stroke = "#e0e0e0";
      (el as SVGElement).style.strokeWidth = "2";
      (el as SVGElement).style.fill = "none";
      (el as SVGElement).setAttribute("stroke", "#e0e0e0");
      (el as SVGElement).setAttribute("fill", "none");
    });

    const svgBlob = new Blob([cloned.outerHTML], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const scale = 2;    // 2× for retina/HiDPI quality
      const padding = 60; // breathing room so Y-axis labels aren't clipped

      const canvas = document.createElement("canvas");
      canvas.width = (rect.width + padding) * scale;
      canvas.height = (rect.height + padding) * scale;

      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, padding / 2, padding / 2);

      URL.revokeObjectURL(url);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "population_chart.png";
      a.click();
    };
    img.src = url;
  };

  const handleTemperatureChange = (value: number) => {
    setTemperature(value);
    if (value < 10) {
      setTempWarning("Temperature too low - min 10°C");
    } else if (value > 46) {
      setTempWarning("Temperature too high - max 46°C");
    } else {
      setTempWarning("");
    }
  };

  const handlePHChange = (value: number) => {
    setPH(value);
    if (value < 5) {
      setPhWarning("pH too low - min 5.0");
    } else if (value > 9) {
      setPhWarning("pH too high - max 9.0");
    } else {
      setPhWarning("");
    }
  };

  // Stress escalates neutral → amber → red so a struggling culture is legible
  // at a glance rather than only readable from the percentage.
  const getStressClass = (level: number): string => {
    if (level < 0.3) return "bg-muted-foreground/50";
    if (level < 0.7) return "bg-warning";
    return "bg-destructive";
  };

  const getStressTextClass = (level: number): string => {
    if (level < 0.3) return "text-muted-foreground";
    if (level < 0.7) return "text-warning";
    return "text-destructive";
  };

  const currentStrain = showCustomStrain
    ? customStrain
    : STRAINS[selectedStrain];

  /* ---- Bench integration ------------------------------------------------
     Environment warnings become Problems, the adaptation log streams to the
     run log, and the run itself drives the status bar. */

  const problems = useMemo<WorkbenchAlert[]>(() => {
    const list: WorkbenchAlert[] = [];
    if (tempWarning)
      list.push({
        source: "microbe-growth-lab",
        severity: "warning",
        message: tempWarning,
        at: "temperature",
      });
    if (phWarning)
      list.push({
        source: "microbe-growth-lab",
        severity: "warning",
        message: phWarning,
        at: "pH",
      });
    if (state.population === 0 && state.timeStep > 0)
      list.push({
        source: "microbe-growth-lab",
        severity: "error",
        message: "Culture collapsed — population reached zero.",
        at: `step ${state.timeStep}`,
      });
    return list;
  }, [tempWarning, phWarning, state.population, state.timeStep]);

  useAlerts("microbe-growth-lab", problems);
  useLogStream("microbe-growth-lab", state.adaptationLog);

  useRunStatus(
    useMemo(
      () =>
        isRunning || state.timeStep > 0
          ? {
              label: "Growth experiment",
              source: "microbe-growth-lab",
              state: isRunning ? ("running" as const) : ("paused" as const),
              detail: `step ${state.timeStep} · ${state.population.toLocaleString()} cells`,
            }
          : null,
      [isRunning, state.timeStep, state.population],
    ),
  );

  useStatusItems(
    useMemo(
      () => [
        { id: "strain", label: currentStrain.name },
        { id: "pop", label: `${state.population.toLocaleString()} cells` },
        {
          id: "res",
          label: `Resistance ${state.resistanceLevel}%`,
          tone:
            state.resistanceLevel >= 50
              ? ("danger" as const)
              : state.resistanceLevel >= 20
                ? ("warning" as const)
                : ("default" as const),
        },
      ],
      [currentStrain.name, state.population, state.resistanceLevel],
    ),
  );

  useViewContext(
    `${currentStrain.name}${
      genomeInfo ? ` · genome ${genomeInfo.header}` : " · no genome loaded"
    } · step ${state.timeStep}`,
  );

  const peakPopulation = useMemo(
    () => chartData.reduce((max, d) => Math.max(max, d.population), 0),
    [chartData],
  );

  return (
    <ViewLayout
      inspectorId="microbe-growth-lab"
      defaultInspectorSize={30}
      inspector={
        <LabInspector
          selectedStrain={selectedStrain}
          showCustomStrain={showCustomStrain}
          customStrain={customStrain}
          setCustomStrain={setCustomStrain}
          genomeInfo={genomeInfo}
          onStrainChange={handleStrainChange}
          onFastaUpload={handleFastaUpload}
          temperature={temperature}
          onTemperatureChange={handleTemperatureChange}
          tempWarning={tempWarning}
          pH={pH}
          onPHChange={handlePHChange}
          phWarning={phWarning}
          nutrients={nutrients}
          setNutrients={setNutrients}
          oxygen={oxygen}
          setOxygen={setOxygen}
          antibioticOn={antibioticOn}
          setAntibioticOn={setAntibioticOn}
          isRunning={isRunning}
          onStartPause={handleStartPause}
          onReset={handleReset}
          onExport={handleExport}
        />
      }
    >
      <ViewScroll>
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-1 gap-3 @sm/bench:grid-cols-2 @4xl/bench:grid-cols-4">
            <StatTile
              icon={Clock}
              label="Time steps"
              value={state.timeStep}
              hint={isRunning ? "running · 300ms/step" : "paused"}
            />
            <StatTile
              icon={Activity}
              label="Population"
              value={state.population.toLocaleString()}
              hint={`peak ${peakPopulation.toLocaleString()}`}
            />
            <StatTile
              icon={Pill}
              label="Resistance"
              value={`${state.resistanceLevel}%`}
              tone={
                state.resistanceLevel >= 50
                  ? "critical"
                  : state.resistanceLevel >= 20
                    ? "warning"
                    : "default"
              }
              hint={antibioticOn ? "under selection (50 µg/mL)" : "no antibiotic"}
            />
            <StatTile
              icon={DnaIcon}
              label="Strain"
              value={
                <span className="text-base leading-tight">{currentStrain.name}</span>
              }
              hint={`growth ${(currentStrain.growthRate * 100).toFixed(0)}%`}
            />
          </div>

          <Pane>
            <PaneHeader
              icon={LineChartIcon}
              title="Population growth"
              subtitle={`${chartData.length} data points`}
              actions={
                <>
                  <ToolbarButton
                    icon={ImageDown}
                    label="Export chart as PNG"
                    onClick={handleExportPNG}
                  />
                  <ToolbarButton
                    icon={Download}
                    label="Export data as CSV"
                    onClick={handleExport}
                  />
                </>
              }
            />
            <div className="p-3">
              {chartData.length > 0 ? (
                // chartRef lets handleExportPNG find the SVG inside this div
                <div className="h-72" ref={chartRef}>
                  <PopulationChart data={chartData} />
                </div>
              ) : (
                <div className="bg-grid flex h-72 flex-col items-center justify-center gap-2 text-center">
                  <LineChartIcon className="size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Start the simulation to plot population growth
                  </p>
                </div>
              )}
            </div>
          </Pane>

          <div className="grid gap-3 @4xl/bench:grid-cols-2">
            <Pane>
              <PaneHeader icon={AlertTriangle} title="Stress monitor" />
              <div className="space-y-3 p-3">
                {Object.entries(state.stressLevels).map(([key, level]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{key}</span>
                      <span
                        className={cn(
                          "font-mono tabular",
                          getStressTextClass(level),
                        )}
                      >
                        {Math.round(level * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--wb-active)]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width,background-color] duration-300 ease-[var(--ease-out-quint)]",
                          getStressClass(level),
                        )}
                        style={{ width: `${Math.min(100, level * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Pane>

            <Pane className="min-h-0">
              <PaneHeader
                icon={Clock}
                title="Adaptation log"
                subtitle="also streamed to the run log"
                actions={
                  <Chip tone={isRunning ? "success" : "neutral"}>
                    {isRunning ? "live" : "idle"}
                  </Chip>
                }
              />
              <div className="seq-scroll max-h-56 min-h-40 overflow-auto bg-[var(--wb-inset)] p-2 font-mono text-xs leading-5">
                {state.adaptationLog.length === 0 ? (
                  <p className="px-1 text-[var(--log-dim)]">
                    Simulation not started yet.
                  </p>
                ) : (
                  state.adaptationLog.map((entry, i) => (
                    <div
                      key={`${i}-${entry}`}
                      className="animate-line-in flex gap-2 px-1 hover:bg-[var(--wb-hover)]"
                    >
                      <span className="shrink-0 text-[var(--log-dim)]">›</span>
                      <span className="text-[var(--log-fg)]">{entry}</span>
                    </div>
                  ))
                )}
              </div>
            </Pane>
          </div>
        </div>
      </ViewScroll>
    </ViewLayout>
  );
}

/* ============================================================================
   Inspector — strain, genome and environment controls
   ========================================================================= */

function LabInspector({
  selectedStrain,
  showCustomStrain,
  customStrain,
  setCustomStrain,
  genomeInfo,
  onStrainChange,
  onFastaUpload,
  temperature,
  onTemperatureChange,
  tempWarning,
  pH,
  onPHChange,
  phWarning,
  nutrients,
  setNutrients,
  oxygen,
  setOxygen,
  antibioticOn,
  setAntibioticOn,
  isRunning,
  onStartPause,
  onReset,
  onExport,
}: {
  selectedStrain: string;
  showCustomStrain: boolean;
  customStrain: Strain;
  setCustomStrain: React.Dispatch<React.SetStateAction<Strain>>;
  genomeInfo: GenomeInfo | null;
  onStrainChange: (key: string) => void;
  onFastaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  temperature: number;
  onTemperatureChange: (v: number) => void;
  tempWarning: string;
  pH: number;
  onPHChange: (v: number) => void;
  phWarning: string;
  nutrients: number;
  setNutrients: (v: number) => void;
  oxygen: number;
  setOxygen: (v: number) => void;
  antibioticOn: boolean;
  setAntibioticOn: (v: boolean) => void;
  isRunning: boolean;
  onStartPause: () => void;
  onReset: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="seq-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Pane>
          <PaneHeader icon={DnaIcon} title="Strain" />
          <div className="p-1.5">
            {Object.entries(STRAINS).map(([key, strain]) => {
              const active = selectedStrain === key && !showCustomStrain;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onStrainChange(key)}
                  className={cn(
                    "row-hover flex w-full cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left",
                    "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                    active && "bg-[var(--wb-active)]",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        active ? "bg-brand" : "bg-muted-foreground/40",
                      )}
                    />
                    <span
                      className={cn(
                        "truncate text-sm font-medium",
                        active ? "text-foreground" : "text-foreground/80",
                      )}
                    >
                      {strain.name}
                    </span>
                  </span>
                  <span className="truncate pl-3 text-xs text-muted-foreground/80">
                    {strain.description}
                  </span>
                  <span className="pl-3 font-mono text-xs text-muted-foreground/70 tabular">
                    growth {(strain.growthRate * 100).toFixed(0)}% · resist{" "}
                    {(strain.resistance * 100).toFixed(0)}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border p-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
              <FileText className="size-3.5" />
              Upload FASTA
            </label>
            <input
              type="file"
              accept={FASTA_EXTENSIONS.join(",")}
              onChange={onFastaUpload}
              className={cn(
                "w-full cursor-pointer text-xs text-muted-foreground",
                "file:mr-2 file:cursor-pointer file:rounded-sm file:border file:border-border",
                "file:bg-[var(--wb-raised)] file:px-2 file:py-1 file:text-xs file:text-foreground/85",
                "hover:file:bg-[var(--wb-active)]",
              )}
            />
            <p className="mt-1.5 text-xs text-muted-foreground/70">
              Derives a custom strain from the genome header.
            </p>
          </div>
        </Pane>

        {showCustomStrain && (
          <Pane>
            <PaneHeader icon={Plus} title="Custom strain" />
            <div className="space-y-3 p-3">
              {genomeInfo && (
                <div className="space-y-1 rounded-sm border border-border bg-[var(--wb-raised)] p-2 font-mono text-xs">
                  <p className="flex items-center gap-1.5 font-sans text-muted-foreground">
                    <Activity className="size-3" />
                    Genome analysis
                  </p>
                  <p className="text-foreground/80">
                    size {genomeInfo.length.toLocaleString()} bp
                  </p>
                  <p className="text-foreground/80">GC {genomeInfo.gcContent}%</p>
                  <p className="text-foreground/80">
                    resistance markers {genomeInfo.resistanceGenes}
                  </p>
                </div>
              )}

              <Field label="Name">
                <WBInput
                  type="text"
                  value={customStrain.name}
                  onChange={(e) =>
                    setCustomStrain({ ...customStrain, name: e.target.value })
                  }
                />
              </Field>

              <Field label="Description">
                <WBInput
                  type="text"
                  value={customStrain.description}
                  onChange={(e) =>
                    setCustomStrain({ ...customStrain, description: e.target.value })
                  }
                />
              </Field>

              <Field
                label="Growth rate"
                value={`${(customStrain.growthRate * 100).toFixed(1)}%`}
              >
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.01"
                  value={customStrain.growthRate}
                  onChange={(e) =>
                    setCustomStrain({
                      ...customStrain,
                      growthRate: Number(e.target.value),
                    })
                  }
                  aria-label="Growth rate"
                />
              </Field>

              <Field label="Optimal temp" value={`${customStrain.tempOptimal}°C`}>
                <input
                  type="range"
                  min="10"
                  max="80"
                  value={customStrain.tempOptimal}
                  onChange={(e) =>
                    setCustomStrain({
                      ...customStrain,
                      tempOptimal: Number(e.target.value),
                    })
                  }
                  aria-label="Optimal temperature"
                />
              </Field>

              <Field
                label="Resistance"
                value={`${(customStrain.resistance * 100).toFixed(0)}%`}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={customStrain.resistance}
                  onChange={(e) =>
                    setCustomStrain({
                      ...customStrain,
                      resistance: Number(e.target.value),
                    })
                  }
                  aria-label="Resistance"
                />
              </Field>
            </div>
          </Pane>
        )}

        <Pane>
          <PaneHeader icon={Thermometer} title="Environment" />
          <div className="space-y-4 p-3">
            <Field label="Temperature" value={`${temperature}°C`} error={tempWarning}>
              <div className="space-y-2">
                <input
                  type="range"
                  min="10"
                  max="46"
                  value={temperature}
                  onChange={(e) => onTemperatureChange(Number(e.target.value))}
                  aria-label="Temperature"
                />
                <WBInput
                  type="number"
                  value={temperature}
                  onChange={(e) => onTemperatureChange(Number(e.target.value))}
                />
              </div>
            </Field>

            <Field label="pH" value={pH.toFixed(1)} error={phWarning}>
              <div className="space-y-2">
                <input
                  type="range"
                  min="5"
                  max="9"
                  step="0.1"
                  value={pH}
                  onChange={(e) => onPHChange(Number(e.target.value))}
                  aria-label="pH"
                />
                <WBInput
                  type="number"
                  step="0.1"
                  value={pH}
                  onChange={(e) => onPHChange(Number(e.target.value))}
                />
              </div>
            </Field>

            <Field label="Nutrients" value={`${Math.round(nutrients)}%`}>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={nutrients}
                  onChange={(e) => setNutrients(Number(e.target.value))}
                  aria-label="Nutrients"
                />
                <WBInput
                  type="number"
                  value={Math.round(nutrients)}
                  onChange={(e) => setNutrients(Number(e.target.value))}
                />
              </div>
            </Field>

            <Field label="Oxygen" value={`${oxygen}%`}>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={oxygen}
                  onChange={(e) => setOxygen(Number(e.target.value))}
                  aria-label="Oxygen"
                />
                <WBInput
                  type="number"
                  value={oxygen}
                  onChange={(e) => setOxygen(Number(e.target.value))}
                />
              </div>
            </Field>

            <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-3">
              <Pill className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">Antibiotic</span>
                <span className="block text-xs text-muted-foreground/70">
                  {antibioticOn ? "50 µg/mL — selection active" : "none"}
                </span>
              </span>
              <Switch
                checked={antibioticOn}
                onCheckedChange={setAntibioticOn}
                aria-label="Antibiotic"
              />
            </label>
          </div>
        </Pane>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <Button onClick={onStartPause} className="h-8 flex-1">
          {isRunning ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {isRunning ? "Pause" : "Start"}
        </Button>
        <Button onClick={onReset} variant="secondary" className="h-8">
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
        <Button onClick={onExport} variant="secondary" className="h-8">
          <Download className="size-3.5" />
          CSV
        </Button>
      </div>
    </div>
  );
}

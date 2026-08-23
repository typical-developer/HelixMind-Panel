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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// components
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP,
  SERIES,
} from "@/lib/chart-theme";
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

interface SimulationState {
  population: number;
  timeStep: number;
  resistanceLevel: number;
  growthHistory: { time: number; population: number }[];
  adaptationLog: string[];
  stressLevels: {
    temperature: number;
    ph: number;
    nutrients: number;
    oxygen: number;
  };
  resistance: number;
  environment: {
    temperature: number;
    pH: number;
    nutrients: number;
    oxygen: number;
    antibioticConc: number;
  };
}

// ────────────────────────────────────────────────
//  CONSTANTS
// ────────────────────────────────────────────────
const CARRYING_CAPACITY = 10000;
const MAX_GROWTH_RATE = 0.35;
const K_S = 20;
const BASE_MUTATION_RATE = 0.005;
const SELECTION_COEFFICIENT = 0.1;

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
//  SIMULATION CLASS
// ────────────────────────────────────────────────
class MicrobeSimulation {
  population: number = 1000;
  timeStep: number = 0;
  avgResistance: number = 0.0;
  adaptationLog: string[] = ["Culture inoculated."];
  growthHistory: { time: number; population: number }[] = [];

  env = {
    temperature: 37,
    pH: 7.0,
    nutrients: 100,
    oxygen: 21,
    antibioticConc: 0,
  };

  reset() {
    this.population = 1000;
    this.timeStep = 0;
    this.avgResistance = 0.0;
    this.adaptationLog = ["Culture inoculated."];
    this.growthHistory = [];
    this.env = {
      temperature: 37,
      pH: 7.0,
      nutrients: 100,
      oxygen: 21,
      antibioticConc: 0,
    };
  }

  updateEnvironment(
    updates: Partial<typeof this.env> & { antibioticOn?: boolean }
  ) {
    if (updates.antibioticOn !== undefined) {
      updates.antibioticConc = updates.antibioticOn ? 50 : 0;
      delete updates.antibioticOn;
    }
    this.env = { ...this.env, ...updates };
  }

  getTemperatureCoeff(): number {
    const T = this.env.temperature;
    const T_opt = 37;
    const T_min = 10;
    const T_max = 46;
    if (T <= T_min || T >= T_max) return 0;
    const sigma = 5;
    return Math.exp(-0.5 * ((T - T_opt) / sigma) ** 2);
  }

  getPHCoeff(): number {
    const pH = this.env.pH;
    const pH_opt = 7.0;
    const pH_width = 2.5;
    const coeff = 1 - ((pH - pH_opt) / pH_width) ** 2;
    return Math.max(0, coeff);
  }

  getNutrientCoeff(): number {
    const S = this.env.nutrients;
    if (S <= 0) return 0;
    return S / (K_S + S);
  }

  getKillRate(): number {
    const dose = this.env.antibioticConc;
    if (dose <= 0) return 0;
    const MIC = 10 + this.avgResistance * 90;
    const n = 2;
    const efficacy = dose ** n / (MIC ** n + dose ** n);
    return 0.4 * efficacy;
  }

  tick(): SimulationState {
    this.timeStep += 1;

    const tempK = this.getTemperatureCoeff();
    const phK = this.getPHCoeff();
    const nutrientK = this.getNutrientCoeff();
    const oxygenK = this.env.oxygen > 5 ? 1 : 0.1;

    const currentGrowthRate =
      MAX_GROWTH_RATE * tempK * phK * nutrientK * oxygenK;
    const logisticFactor = 1 - this.population / CARRYING_CAPACITY;
    const growthAmount = this.population * currentGrowthRate * logisticFactor;

    const antibioticKillRate = this.getKillRate();
    const deathAmount = this.population * antibioticKillRate;

    if (antibioticKillRate > 0.01 && this.population > 0) {
      const selectionPressure = antibioticKillRate * SELECTION_COEFFICIENT;
      this.avgResistance = Math.min(
        1.0,
        this.avgResistance + selectionPressure
      );
      if (Math.random() < 0.1) {
        this.adaptationLog.push(
          `Step ${this.timeStep}: Selection → Resistance ${(
            this.avgResistance * 100
          ).toFixed(1)}%`
        );
      }
    } else if (this.avgResistance > 0) {
      this.avgResistance = Math.max(0, this.avgResistance - 0.001);
    }

    const stress = 1 - tempK * phK;
    const currentMutationChance = BASE_MUTATION_RATE * (1 + stress * 5);

    if (Math.random() < currentMutationChance) {
      this.avgResistance = Math.min(1.0, this.avgResistance + 0.01);
      this.adaptationLog.push(`Step ${this.timeStep}: Mutation detected.`);
    }

    let nextPop = this.population + growthAmount - deathAmount;
    const consumption = growthAmount > 0 ? growthAmount * 0.05 : 0;
    this.env.nutrients = Math.max(0, this.env.nutrients - consumption);

    this.population = Math.max(0, Math.round(nextPop));

    if (this.adaptationLog.length > 10) this.adaptationLog.shift();

    this.growthHistory.push({
      time: this.timeStep,
      population: this.population,
    });

    return this.getState();
  }

  getState(): SimulationState {
    return {
      population: this.population,
      timeStep: this.timeStep,
      resistanceLevel: Math.round(this.avgResistance * 100),
      growthHistory: this.growthHistory,
      adaptationLog: [...this.adaptationLog],
      stressLevels: {
        temperature: 1 - this.getTemperatureCoeff(),
        ph: 1 - this.getPHCoeff(),
        nutrients: 1 - this.getNutrientCoeff(),
        oxygen: Math.abs(this.env.oxygen - 21) / 21,
      },
      resistance: this.avgResistance,
      environment: this.env,
    };
  }
}

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
  const [chartSize, setChartSize] = useState<"99.5%" | "100%">("99.5%");

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

  // Chart size oscillation effect when running - more subtle
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setChartSize((prev) => (prev === "99.5%" ? "100%" : "99.5%"));
    }, 1500);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Simulation loop
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const newState = sim.tick();
      setState(newState);
    }, 300);
    return () => clearInterval(interval);
  }, [isRunning, sim]);

  const analyzeFastaGenome = (fastaText: string): GenomeInfo | null => {
    const lines = fastaText.split("\n");
    let header = "";
    let sequence = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(">")) {
        header = trimmed.substring(1);
      } else if (trimmed.length > 0) {
        sequence += trimmed;
      }
    }

    if (!sequence) return null;

    const genomeLength = sequence.length;
    const gcContent =
      ((sequence.match(/[GC]/gi) || []).length / genomeLength) * 100;

    const resistancePatterns = ["gyrA", "rpoB", "katG", "efflux", "beta"];
    let resistanceGeneCount = 0;
    for (const pattern of resistancePatterns) {
      resistanceGeneCount += (
        header.toLowerCase().match(new RegExp(pattern, "g")) || []
      ).length;
    }

    const baseGrowthRate = 0.35 - (genomeLength > 5000000 ? 0.05 : 0);
    const baseResistance = Math.min(
      0.8,
      resistanceGeneCount * 0.15 + (gcContent / 100) * 0.1
    );

    return {
      header,
      length: genomeLength,
      gcContent: gcContent.toFixed(1),
      resistanceGenes: resistanceGeneCount,
      estimatedGrowthRate: Math.max(0.1, baseGrowthRate),
      estimatedResistance: baseResistance,
    };
  };

  const handleFastaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const info = analyzeFastaGenome(text);

        if (info) {
          setGenomeInfo(info);
          setCustomStrain({
            name: info.header || "FASTA Strain",
            description: `Genome: ${info.length} bp | GC: ${info.gcContent}% | Resistance Genes: ${info.resistanceGenes}`,
            growthRate: info.estimatedGrowthRate,
            tempOptimal: 37,
            resistance: info.estimatedResistance,
          });
          setShowCustomStrain(true);
          setSelectedStrain("custom");
        } else {
          alert("No valid sequence found in FASTA file");
        }
      } catch (err) {
        alert("Error reading FASTA file");
      }
    };
    reader.onerror = () => alert("Error reading file");
    reader.readAsText(file);
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
    setChartSize("99.5%");
    setTempWarning("");
    setPhWarning("");
  };

  const handleStartPause = () => {
    if (!isRunning) {
      setChartSize("99.5%");
    }
    setIsRunning(!isRunning);
  };

  const handleExport = () => {
    if (state.growthHistory.length === 0) {
      alert("Run simulation first to export data");
      return;
    }

    const csv = [
      "Time,Population,Resistance(%)",
      ...state.growthHistory.map(
        (d) => `${d.time},${d.population},${state.resistanceLevel}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "microbe_growth_data.csv";
    a.click();
    URL.revokeObjectURL(url);
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
      alert("Run simulation first to export chart");
      return;
    }

    const cloned = svg.cloneNode(true) as SVGElement;
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Capture rendered size before touching the clone
    const rect = svg.getBoundingClientRect();

    // Dark background rect so the PNG isn't transparent
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#0a0a0a");
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
      (el as SVGElement).style.fill = "#FBFBFB";
      (el as SVGElement).setAttribute("fill", "#FBFBFB");
    });

    // Axis lines
    cloned
      .querySelectorAll(".recharts-cartesian-axis-line, .recharts-cartesian-axis-tick-line")
      .forEach((el) => {
        (el as SVGElement).style.stroke = "#FBFBFB";
        (el as SVGElement).setAttribute("stroke", "#FBFBFB");
      });

    // Subtle grid lines
    cloned
      .querySelectorAll(
        ".recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line"
      )
      .forEach((el) => {
        (el as SVGElement).style.stroke = "#404040";
        (el as SVGElement).setAttribute("stroke", "#404040");
      });

    // Data line — white, no fill flood
    cloned.querySelectorAll(".recharts-line-curve").forEach((el) => {
      (el as SVGElement).style.stroke = "#FBFBFB";
      (el as SVGElement).style.strokeWidth = "2";
      (el as SVGElement).style.fill = "none";
      (el as SVGElement).setAttribute("stroke", "#FBFBFB");
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
      ctx.fillStyle = "#0a0a0a";
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
  useLogStream("microbe-lab", state.adaptationLog);

  useRunStatus(
    useMemo(
      () =>
        isRunning || state.timeStep > 0
          ? {
              label: "Growth experiment",
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
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
                  <ResponsiveContainer width={chartSize} height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
                    >
                      <CartesianGrid {...CHART_GRID} />
                      <XAxis
                        dataKey="time"
                        {...CHART_AXIS}
                        interval="preserveStartEnd"
                        minTickGap={40}
                      />
                      <YAxis {...CHART_AXIS} width={56} />
                      <Tooltip
                        {...CHART_TOOLTIP}
                        formatter={(v: number) => [v.toLocaleString(), "Population"]}
                        labelFormatter={(l) => `Step ${l}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="population"
                        stroke={SERIES.primary}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive
                        animationDuration={280}
                        animationEasing="linear"
                        animationBegin={0}
                      />
                    </LineChart>
                  </ResponsiveContainer>
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

          <div className="grid gap-3 xl:grid-cols-2">
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
              <div className="seq-scroll max-h-56 min-h-40 overflow-auto bg-[hsl(0_0%_2%)] p-2 font-mono text-xs leading-5">
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
              accept=".fasta,.fa,.fna,.txt"
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

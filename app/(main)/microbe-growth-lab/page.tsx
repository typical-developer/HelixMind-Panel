"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Microscope,
  DnaIcon,
  Plus,
  FileText,
  Thermometer,
  Droplet,
  Leaf,
  Wind,
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
  Legend,
  ResponsiveContainer,
} from "recharts";

// components
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  const getStressClass = (level: number): string => {
    if (level < 0.3) return "bg-neutral-700 text-neutral-300";
    if (level < 0.7) return "bg-neutral-600 text-neutral-200";
    return "bg-neutral-500 text-white";
  };

  const currentStrain = showCustomStrain
    ? customStrain
    : STRAINS[selectedStrain];

  return (
    <div className="space-x-8">
      <div className="ml-16 pt-16">
        <main className="mx-auto max-w-7xl container pt-8 bg-background min-w-full min-h-screen space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {/* Strain Selection */}
            <div className="glass p-6">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <DnaIcon className="h-5 w-5" />
                Strain
              </h2>

              <div className="space-y-2 mb-6">
                {Object.entries(STRAINS).map(([key, strain]) => (
                  <button
                    key={key}
                    onClick={() => handleStrainChange(key)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                      selectedStrain === key && !showCustomStrain
                        ? "border-white/25 bg-white/[0.08] text-foreground"
                        : "border-border bg-card/40 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                    }`}
                  >
                    <div className="font-medium">{strain.name}</div>
                    <div className="text-xs text-neutral-300 mt-0.5">
                      {strain.description}
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      Growth: {(strain.growthRate * 100).toFixed(0)}% • Resist:{" "}
                      {(strain.resistance * 100).toFixed(0)}%
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-border">
                <label className="text-xs font-medium text-neutral-500 block mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Upload FASTA
                </label>
                <input
                  type="file"
                  accept=".fasta,.fa,.fna,.txt"
                  onChange={handleFastaUpload}
                  className="w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700 cursor-pointer"
                />
                <p className="text-xs text-neutral-600 mt-2">
                  Analyze genome from FASTA header
                </p>
              </div>
            </div>

            {/* ───────────── Custom Strain ───────────── */}
            {showCustomStrain && (
              <div className="glass p-6">
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Custom Strain
                </h2>

                {genomeInfo && (
                  <div className="mb-6 rounded-lg border border-border bg-card/40 p-4 text-sm">
                    <p className="text-neutral-400 mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Genome Analysis
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-neutral-300">
                      <div>Size: {genomeInfo.length.toLocaleString()} bp</div>
                      <div>GC: {genomeInfo.gcContent}%</div>
                      <div>
                        Resistance markers: {genomeInfo.resistanceGenes}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Name
                    </label>
                    <input
                      type="text"
                      value={customStrain.name}
                      onChange={(e) =>
                        setCustomStrain({
                          ...customStrain,
                          name: e.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={customStrain.description}
                      onChange={(e) =>
                        setCustomStrain({
                          ...customStrain,
                          description: e.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span>Growth Rate</span>
                      <span>{(customStrain.growthRate * 100).toFixed(1)}%</span>
                    </div>
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
                      className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span>Optimal Temp</span>
                      <span>{customStrain.tempOptimal}°C</span>
                    </div>
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
                      className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span>Resistance</span>
                      <span>{(customStrain.resistance * 100).toFixed(0)}%</span>
                    </div>
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
                      className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ───────────── Environment ───────────── */}
            <div className="glass p-6">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <Thermometer className="h-5 w-5" />
                Environment
              </h2>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>Temperature</span>
                    <span>{temperature}°C</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="46"
                    value={temperature}
                    onChange={(e) => handleTemperatureChange(Number(e.target.value))}
                    className="w-full flex-1 accent-primary disabled:opacity-50 cursor-grab"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={temperature}
                      onChange={(e) => handleTemperatureChange(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  {tempWarning && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {tempWarning}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>pH</span>
                    <span>{pH.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="9"
                    step="0.1"
                    value={pH}
                    onChange={(e) => handlePHChange(Number(e.target.value))}
                    className="w-full flex-1 accent-primary disabled:opacity-50 cursor-grab"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      step="0.1"
                      value={pH}
                      onChange={(e) => handlePHChange(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  {phWarning && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {phWarning}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>Nutrients</span>
                    <span>{Math.round(nutrients)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={nutrients}
                    onChange={(e) => setNutrients(Number(e.target.value))}
                    className="w-full flex-1 accent-primary disabled:opacity-50 cursor-grab"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={Math.round(nutrients)}
                      onChange={(e) => setNutrients(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>Oxygen</span>
                    <span>{oxygen}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={oxygen}
                    onChange={(e) => setOxygen(Number(e.target.value))}
                    className="w-full flex-1 accent-primary disabled:opacity-50 cursor-grab"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={oxygen}
                      onChange={(e) => setOxygen(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border">
                  <input
                    type="checkbox"
                    checked={antibioticOn}
                    onChange={(e) => setAntibioticOn(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-white"
                  />
                  <div className="flex items-center gap-2 text-sm">
                    <Pill className="h-4 w-4" />
                    Antibiotic {antibioticOn ? "(50 µg/mL)" : ""}
                  </div>
                </label>
              </div>
            </div>

            {/* ───────────── Stress Monitor ───────────── */}
            <div className="glass p-6">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Stress Monitor
              </h2>

              <div className="space-y-4">
                {Object.entries(state.stressLevels).map(([key, level]) => (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1.5 capitalize">
                      <span>{key}</span>
                      <span>{Math.round(level * 100)}%</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getStressClass(
                          level
                        )}`}
                        style={{ width: `${Math.min(100, level * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-sm text-neutral-500 mb-1">
                  Resistance Level
                </p>
                <p className="text-4xl font-bold">{state.resistanceLevel}%</p>
              </div>
            </div>

            {/* ───────────── Controls ───────────── */}
            <div className="glass p-6">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Simulation
              </h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-500">Time Steps</p>
                  <p className="text-2xl font-bold">{state.timeStep}</p>
                </div>

                <div>
                  <p className="text-sm text-neutral-500">Population</p>
                  <p className="text-2xl font-bold">
                    {state.population.toLocaleString()}
                  </p>
                </div>

                <div className="pt-4 space-y-3 border-t border-border">
                  <Button onClick={handleStartPause} className="w-full">
                    {isRunning ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                    {isRunning ? "Pause" : "Start"}
                  </Button>

                  <Button
                    onClick={handleReset}
                    variant="secondary"
                    className="w-full"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Reset
                  </Button>

                  <Button
                    onClick={handleExport}
                    variant="secondary"
                    className="w-full"
                  >
                    <Download className="h-5 w-5" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="glass p-6 mb-8">
            {/* Header row with title and Export PNG button */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <LineChartIcon className="h-5 w-5" />
                Population Growth
              </h2>
              <Button onClick={handleExportPNG} variant="secondary" size="sm">
                <Download className="h-4 w-4" />
                Export PNG
              </Button>
            </div>

            {chartData.length > 0 ? (
              // chartRef lets handleExportPNG find the SVG inside this div
              <div className="h-80" ref={chartRef}>
                <ResponsiveContainer width={chartSize} height={chartSize}>
                  <LineChart
                    data={chartData}
                    className="transition-all duration-1000 ease-in-out"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                    <XAxis
                      dataKey="time"
                      stroke="#FBFBFB"
                      fontSize={"0.8rem"}
                      interval="preserveStartEnd"
                      minTickGap={50}
                    />
                    <YAxis stroke="#FBFBFB" fontSize={"0.8rem"} width={80} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        color: "#e2e8f0",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="population"
                      stroke="#FBFBFB"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={true}
                      animationDuration={280}
                      animationEasing="linear"
                      animationBegin={0}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-neutral-600">
                Start the simulation to see population growth
              </div>
            )}
          </div>

          {/* Log */}
          <div className="glass p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Adaptation Log
            </h2>
            <ScrollArea className="h-48 space-y-1 rounded-lg border border-border bg-black/50 p-4 font-mono text-sm text-muted-foreground">
              {state.adaptationLog.length === 0 ? (
                <p className="text-neutral-600">Simulation not started yet.</p>
              ) : (
                state.adaptationLog.map((entry, i) => (
                  <div key={i}>{entry}</div>
                ))
              )}
            </ScrollArea>
          </div>
        </main>
      </div>
    </div>
  );
}
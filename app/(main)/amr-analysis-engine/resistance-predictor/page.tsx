"use client";

import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Info, DownloadIcon, FlaskConical, Dna, Microscope, AlertTriangle, Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const amrDatabase = {
  "blaCTX-M": { antibiotic: "Ceftriaxone", drugClass: "Cephalosporins", mechanism: "ESBL", impact: 0.95 },
  "blaOXA-48": { antibiotic: "Meropenem", drugClass: "Carbapenems", mechanism: "Carbapenemase", impact: 0.98 },
  mecA: { antibiotic: "Oxacillin", drugClass: "Beta-lactams", mechanism: "PBP2a", impact: 0.99 },
  vanA: { antibiotic: "Vancomycin", drugClass: "Glycopeptides", mechanism: "Cell wall remodeling", impact: 0.99 },
  gyrA: { antibiotic: "Ciprofloxacin", drugClass: "Fluoroquinolones", mechanism: "DNA Gyrase mutation", impact: 0.4 },
  parC: { antibiotic: "Ciprofloxacin", drugClass: "Fluoroquinolones", mechanism: "Topoisomerase IV mutation", impact: 0.4 },
  tetM: { antibiotic: "Tetracycline", drugClass: "Tetracyclines", mechanism: "Ribosomal protection", impact: 0.7 },
};

const DETECTED_GENES = ["blaCTX-M", "blaOXA-48", "gyrA", "mecA", "parC", "tetM", "vanA"];

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function ResistancePredictorPage() {
  const [selectedOrganism, setSelectedOrganism] = useState("E. coli");
  const [selectedGenes, setSelectedGenes] = useState<string[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const organisms = ["E. coli", "K. pneumoniae", "S. aureus", "Enterococcus faecium"];

  const synergyRules = [
    {
      genesRequired: ["gyrA", "parC"],
      result: { drugClass: "Fluoroquinolones", boostedImpact: 0.9, note: "Dual mutations in gyrA and parC confer high-level resistance." },
    },
  ];

  const toggleGene = (label: string) => {
    setSelectedGenes((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const analyzeResistance = () => {
    if (!selectedGenes.length) {
      setError("Please select at least one gene");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const report: any = {};

      selectedGenes.forEach((geneName) => {
        const entry = amrDatabase[geneName];
        if (!entry) return;

        const drugClass = entry.drugClass;

        if (!report[drugClass]) {
          report[drugClass] = { class: drugClass, maxImpact: 0, detectedMarkers: [], mechanisms: [] };
        }

        report[drugClass].detectedMarkers.push(geneName);
        report[drugClass].mechanisms.push(entry.mechanism);

        if (entry.impact > report[drugClass].maxImpact) {
          report[drugClass].maxImpact = entry.impact;
        }
      });

      synergyRules.forEach((rule) => {
        const hasAll = rule.genesRequired.every((g) => selectedGenes.includes(g));
        if (hasAll && report[rule.result.drugClass]) {
          report[rule.result.drugClass].maxImpact = rule.result.boostedImpact;
          report[rule.result.drugClass].isSynergistic = true;
        }
      });

      const resistanceProfile = Object.values(report).map((item: any) => ({
        antibiotic: item.class,
        confidence: {
          level: item.maxImpact >= 0.9 ? "High" : item.maxImpact >= 0.7 ? "Medium" : "Low",
          score: item.maxImpact,
        },
        genes: item.detectedMarkers,
        mechanisms: item.mechanisms,
        isSynergistic: item.isSynergistic || false,
      }));

      setResults({
        organism: selectedOrganism,
        selectedGenes,
        resistanceProfile,
        timestamp: new Date().toLocaleString(),
      });
    } catch (err: any) {
      setError("Error analyzing resistance profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!results) return;

    const report = {
      metadata: {
        organism: results.organism,
        timestamp: results.timestamp,
        disclaimer: "Research tool only. Not for clinical use.",
        modelType: "Rule-based (Synergy-aware)",
      },
      detectedResistance: results.resistanceProfile,
      genesAnalyzed: results.selectedGenes,
    };

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2))
    );
    element.setAttribute("download", `amr_report_${Date.now()}.json`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getConfidenceBadgeColor = (score: number) => {
    if (score >= 0.9) return "border-destructive/30 bg-destructive/15 text-destructive";
    if (score >= 0.7) return "border-amber-500/30 bg-amber-500/15 text-amber-400";
    return "border-white/10 bg-white/5 text-muted-foreground";
  };

  return (
    <div className="ml-16">
      <main className="min-h-screen space-y-6 px-6 pb-12">
        {/* Info banner */}
        <div className="glass flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This tool identifies genetic markers associated with antimicrobial resistance based on
            impact scoring. Clinical resistance is determined by susceptibility testing — this is not
            a diagnostic tool. Synergy rules apply when multiple markers are detected.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left: inputs */}
          <div className="space-y-6 lg:col-span-2">
            <div className="glass p-6">
              <SectionHeader icon={Microscope} title="Select Organism" />
              <Select onValueChange={(val) => setSelectedOrganism(val)} value={selectedOrganism}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Select an organism" />
                </SelectTrigger>
                <SelectContent>
                  {organisms.map((org) => (
                    <SelectItem key={org} value={org}>{org}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="glass p-6">
              <SectionHeader
                icon={Dna}
                title="Detected Genes"
                subtitle={`${selectedGenes.length} selected`}
              />
              <div className="grid grid-cols-2 gap-2">
                {DETECTED_GENES.map((label) => {
                  const active = selectedGenes.includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => toggleGene(label)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2.5 font-mono text-sm transition-colors",
                        active
                          ? "border-white/25 bg-white/[0.08] text-foreground"
                          : "border-border text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{label}</span>
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          active ? "border-white bg-white text-black" : "border-border"
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> {error}
                </p>
              )}

              <Button
                onClick={analyzeResistance}
                disabled={loading || selectedGenes.length === 0}
                className="mt-4 h-11 w-full"
              >
                <FlaskConical className="h-4 w-4" />
                {loading ? "Analyzing..." : "Analyze Resistance Profile"}
              </Button>
            </div>

            {/* Limitations */}
            <div className="surface p-5">
              <p className="mb-2 text-sm font-medium">Tool limitations</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                <li>Impact scoring is literature-based; individual variation may occur</li>
                <li>Synergy rules apply only when specific marker combinations are detected</li>
              </ul>
            </div>
          </div>

          {/* Right: results */}
          <div className="lg:col-span-3">
            {results ? (
              <div className="glass p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <SectionHeader icon={Sparkles} title="Analysis Results" />
                  <Button variant="outline" size="sm" onClick={exportReport}>
                    <DownloadIcon className="h-4 w-4" />
                    Export JSON
                  </Button>
                </div>

                <div className="mb-6 grid grid-cols-3 gap-3">
                  {[
                    ["Organism", results.organism],
                    ["Genes", results.selectedGenes.length],
                    ["Analyzed", results.timestamp.split(",")[0]],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-lg border border-border/60 bg-card/40 p-3">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="mt-0.5 truncate font-mono text-sm text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <p className="mb-3 text-sm font-medium">Detected Resistance Markers</p>
                <Accordion type="multiple" className="space-y-3">
                  {results.resistanceProfile.map((item: any, idx: number) => (
                    <AccordionItem
                      key={idx}
                      value={`item-${idx}`}
                      className="overflow-hidden rounded-lg border border-border bg-card/40 px-4"
                    >
                      <AccordionTrigger className="cursor-pointer hover:no-underline">
                        <div className="flex w-full items-center justify-between gap-3 pr-2">
                          <div className="text-left">
                            <p className="flex items-center gap-2 font-medium">
                              {item.antibiotic}
                              {item.isSynergistic && (
                                <span className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Synergy
                                </span>
                              )}
                            </p>
                            <span className="font-mono text-xs text-muted-foreground">
                              {item.genes.length} marker{item.genes.length !== 1 ? "s" : ""} detected
                            </span>
                          </div>
                          <Badge variant="neutral" className={cn("border", getConfidenceBadgeColor(item.confidence.score))}>
                            {item.confidence.level} · {Math.round(item.confidence.score * 100)}%
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-1 border-t border-border pt-3 font-mono text-sm text-muted-foreground">
                        <p><span className="text-foreground/70">Genes:</span> {item.genes.join(", ")}</p>
                        <p><span className="text-foreground/70">Mechanisms:</span> {item.mechanisms.join(", ")}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : (
              <div className="glass flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <FlaskConical className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No analysis yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Select an organism and one or more detected genes, then run the analysis to see the
                  predicted resistance profile.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

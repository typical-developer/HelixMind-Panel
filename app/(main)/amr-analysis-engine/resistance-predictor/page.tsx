"use client";

import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Info, DownloadIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

/* =======================
   Local AMR Database
   ----------------------
   This is a simplified database of antimicrobial resistance (AMR) genes.
   Each key is a gene name and the value is an object containing:
   - antibiotic: the drug affected
   - drugClass: class of the antibiotic
   - mechanism: how resistance occurs
   - impact: numeric score (0-1) representing likelihood of resistance
======================= */
const amrDatabase = {
  "blaCTX-M": { antibiotic: "Ceftriaxone", drugClass: "Cephalosporins", mechanism: "ESBL", impact: 0.95 },
  "blaOXA-48": { antibiotic: "Meropenem", drugClass: "Carbapenems", mechanism: "Carbapenemase", impact: 0.98 },
  mecA: { antibiotic: "Oxacillin", drugClass: "Beta-lactams", mechanism: "PBP2a", impact: 0.99 },
  vanA: { antibiotic: "Vancomycin", drugClass: "Glycopeptides", mechanism: "Cell wall remodeling", impact: 0.99 },
  gyrA: { antibiotic: "Ciprofloxacin", drugClass: "Fluoroquinolones", mechanism: "DNA Gyrase mutation", impact: 0.4 },
  parC: { antibiotic: "Ciprofloxacin", drugClass: "Fluoroquinolones", mechanism: "Topoisomerase IV mutation", impact: 0.4 },
  tetM: { antibiotic: "Tetracycline", drugClass: "Tetracyclines", mechanism: "Ribosomal protection", impact: 0.7 },
};

/* =======================
   Detected Genes Array
   ----------------------
   This array represents the checkboxes displayed in the UI for detected genes.
   Each object includes:
   - label: gene name
   - checkboxId, checkboxName, htmlFor: used for accessibility and checkbox linking
======================= */
interface DetectedGenes {
  label: string;
  checkboxId: string;
  checkboxName: string;
  htmlFor: string;
}

const DETECTED_GENES: DetectedGenes[] = [
  { label: "blaCTX-M", checkboxId: "blaCTX-M", checkboxName: "blaCTX-M", htmlFor: "blaCTX-M" },
  { label: "blaOXA-48", checkboxId: "blaOXA-48", checkboxName: "blaOXA-48", htmlFor: "blaOXA-48" },
  { label: "gyrA", checkboxId: "gyrA", checkboxName: "gyrA", htmlFor: "gyrA" },
  { label: "mecA", checkboxId: "mecA", checkboxName: "mecA", htmlFor: "mecA" },
  { label: "parC", checkboxId: "parC", checkboxName: "parC", htmlFor: "parC" },
  { label: "tetM", checkboxId: "tetM", checkboxName: "tetM", htmlFor: "tetM" },
  { label: "vanA", checkboxId: "vanA", checkboxName: "vanA", htmlFor: "vanA" },
];

/* =======================
   Main Component
======================= */
export default function ResistancePredictorPage() {
  // State variables
  const [selectedOrganism, setSelectedOrganism] = useState("E. coli"); // selected organism in the dropdown
  const [selectedGenes, setSelectedGenes] = useState<string[]>([]); // selected gene checkboxes
  const [results, setResults] = useState<any>(null); // stores the analysis results
  const [loading, setLoading] = useState(false); // true when analysis is running
  const [error, setError] = useState(""); // stores any error messages

  // Available organisms for selection
  const organisms = ["E. coli", "K. pneumoniae", "S. aureus", "Enterococcus faecium"];

  /* =======================
     Synergy Rules
     ----------------------
     Some genes together confer stronger resistance than individually.
     Each rule defines:
     - genesRequired: array of genes that must all be present
     - result: what drug class gets boosted, by how much, and a note
  ======================== */
  const synergyRules = [
    {
      genesRequired: ["gyrA", "parC"],
      result: { drugClass: "Fluoroquinolones", boostedImpact: 0.9, note: "Dual mutations in gyrA and parC confer high-level resistance." },
    },
  ];

  /* =======================
     Analyze Resistance Function
     ----------------------
     This function calculates the predicted resistance profile
     based on selected genes and applies synergy rules.
  ======================== */
  const analyzeResistance = () => {
    if (!selectedGenes.length) {
      setError("Please select at least one gene");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const report: any = {}; // temporary object grouped by drug class

      // Process each selected gene
      selectedGenes.forEach((geneName) => {
        const entry = amrDatabase[geneName];
        if (!entry) return;

        const drugClass = entry.drugClass;

        // Initialize the drug class entry if it does not exist
        if (!report[drugClass]) {
          report[drugClass] = { class: drugClass, maxImpact: 0, detectedMarkers: [], mechanisms: [] };
        }

        // Add gene and mechanism information
        report[drugClass].detectedMarkers.push(geneName);
        report[drugClass].mechanisms.push(entry.mechanism);

        // Update max impact for this drug class
        if (entry.impact > report[drugClass].maxImpact) {
          report[drugClass].maxImpact = entry.impact;
        }
      });

      // Apply synergy rules
      synergyRules.forEach((rule) => {
        const hasAll = rule.genesRequired.every((g) => selectedGenes.includes(g));
        if (hasAll && report[rule.result.drugClass]) {
          report[rule.result.drugClass].maxImpact = rule.result.boostedImpact;
          report[rule.result.drugClass].isSynergistic = true;
        }
      });

      // Convert report object into an array for easier rendering
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

      // Save results to state
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

  /* =======================
     Export JSON Report
     ----------------------
     Allows the user to download the resistance analysis as a JSON file.
  ======================== */
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

    // Create a temporary <a> element to trigger file download
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

  /* =======================
     Helper for Badge Colors
     ----------------------
     Returns Tailwind CSS classes based on confidence score
  ======================== */
  const getConfidenceBadgeColor = (score: number) => {
    if (score >= 0.9) return "bg-red-700 text-red-100"; // High
    if (score >= 0.7) return "bg-yellow-700 text-yellow-100"; // Medium
    return "bg-orange-700 text-orange-100"; // Low
  };

  /* =======================
     Render UI
======================= */
  return (
    <div className="ml-16">
      <main className="space-y-8 bg-background min-h-screen">

        {/* Information Panel */}
        <div className="flex flex-row items-center gap-2 justify-start glass p-4 text-gray-400 max-w-[700px]">
          <Info className="size-4 shrink-0" />
          <p className="text-sm">
            This tool identifies genetic markers associated with antimicrobial resistance based on impact scoring. Clinical resistance is determined by susceptibility testing. This is not a diagnostic tool. Synergy rules apply when multiple markers are detected.
          </p>
        </div>

        {/* Organism Selection */}
        <div className="space-y-6 glass p-6 rounded-lg mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">Select Organism</h3>
          <Select onValueChange={(val) => setSelectedOrganism(val)} value={selectedOrganism}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an organism" />
            </SelectTrigger>
            <SelectContent>
              {organisms.map((org) => (
                <SelectItem key={org} value={org}>{org}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gene Selection */}
        <div className="space-y-6 glass p-6 rounded-lg mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">Select Detected Genes</h3>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DETECTED_GENES.map(({ label, checkboxId, checkboxName, htmlFor }) => (
              <Field key={checkboxId} orientation="horizontal">
                <Checkbox
                  id={checkboxId}
                  name={checkboxName}
                  checked={selectedGenes.includes(label)}
                  onCheckedChange={(checked) => {
                    // Update selectedGenes state based on checkbox toggle
                    if (checked) setSelectedGenes([...selectedGenes, label]);
                    else setSelectedGenes(selectedGenes.filter((g) => g !== label));
                  }}
                />
                <Label htmlFor={htmlFor} className="text-sm font-mono text-primary">{label}</Label>
              </Field>
            ))}
          </div>

          {/* Analyze Button */}
          <Button onClick={analyzeResistance} disabled={loading || selectedGenes.length === 0}>
            {loading ? "Analyzing..." : "Analyze Resistance Profile"}
          </Button>
        </div>

        {/* Analysis Results */}
        {results && (
          <div className="space-y-6 glass p-6 rounded-lg mb-8">

            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">Analysis Results</h3>

            {/* Basic Info */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h4>Organism</h4>
                <p className="font-mono text-primary/80 text-sm">{results.organism}</p>
              </div>
              <div>
                <h4>Genes Analyzed</h4>
                <p className="font-mono text-primary/80 text-sm">{results.selectedGenes.length}</p>
              </div>
              <div>
                <h4>Timestamp</h4>
                <p className="font-mono text-primary/80 text-sm">{results.timestamp}</p>
              </div>
            </div>

            {/* Export Report Button */}
            <Button onClick={exportReport}>
              <DownloadIcon />
              Export JSON Report
            </Button>

            {/* Detected Resistance Markers */}
            <div className="space-y-6 mt-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">Detected Resistance Markers</h3>
              <Accordion type="multiple" className="space-y-4">
                {results.resistanceProfile.map((item: any, idx: number) => {
                  const badgeColor = getConfidenceBadgeColor(item.confidence.score);
                  const label = item.confidence.level;

                  return (
                    <AccordionItem key={idx} value={`item-${idx}`} className="glass px-4">
                      <AccordionTrigger className="hover:no-underline cursor-pointer">
                        <div className="w-full flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-base font-medium">{item.antibiotic}</p>
                            <span className="text-primary/80 text-sm font-mono">
                              {item.genes.length} marker{item.genes.length !== 1 ? "s" : ""} detected
                            </span>
                          </div>
                          <Badge variant="neutral" className={`py-1 ${badgeColor}`}>
                            {label} ({Math.round(item.confidence.score * 100)}%)
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="border-t border-t-accent pt-4">
                        <p className="text-sm font-mono">Genes: {item.genes.join(", ")}</p>
                        <p className="text-sm font-mono">Mechanisms: {item.mechanisms.join(", ")}</p>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </div>
        )}

        {/* Tool Limitations */}
        <div className="space-y-6 glass p-6 rounded-lg mb-8">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Tools Limitations</h3>
          <ul className="pl-4 text-primary/80 text-sm list-disc">
            <li>Impact scoring based on literature, individual variation may occur</li>
            <li>Synergy rules apply when multiple specific markers are detected</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

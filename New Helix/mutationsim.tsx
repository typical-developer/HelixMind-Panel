"use client";

import {
  useState, useEffect, useRef, useMemo, useCallback, ChangeEvent,
} from "react";

// ==================== BLOSUM62 MATRIX ====================
// Proxy for ESM1b evolutionary plausibility scoring.
// Positive = conservative substitution (tolerated), Negative = radical (likely deleterious).
// Source: Henikoff & Henikoff (1992) PNAS 89:10915–10919.
const BLOSUM62: Record<string, Record<string, number>> = {
  A: { A:4,  R:-1, N:-2, D:-2, C:0,  Q:-1, E:-1, G:0,  H:-2, I:-1, L:-1, K:-1, M:-1, F:-2, P:-1, S:1,  T:0,  W:-3, Y:-2, V:0  },
  R: { A:-1, R:5,  N:0,  D:-2, C:-3, Q:1,  E:0,  G:-2, H:0,  I:-3, L:-2, K:2,  M:-1, F:-3, P:-2, S:-1, T:-1, W:-3, Y:-2, V:-3 },
  N: { A:-2, R:0,  N:6,  D:1,  C:-3, Q:0,  E:0,  G:0,  H:1,  I:-3, L:-3, K:0,  M:-2, F:-3, P:-2, S:1,  T:0,  W:-4, Y:-2, V:-3 },
  D: { A:-2, R:-2, N:1,  D:6,  C:-3, Q:0,  E:2,  G:-1, H:-1, I:-3, L:-4, K:-1, M:-3, F:-3, P:-1, S:0,  T:-1, W:-4, Y:-3, V:-3 },
  C: { A:0,  R:-3, N:-3, D:-3, C:9,  Q:-3, E:-4, G:-3, H:-3, I:-1, L:-1, K:-3, M:-1, F:-2, P:-3, S:-1, T:-1, W:-2, Y:-2, V:-1 },
  Q: { A:-1, R:1,  N:0,  D:0,  C:-3, Q:5,  E:2,  G:-2, H:0,  I:-3, L:-2, K:1,  M:0,  F:-3, P:-1, S:0,  T:-1, W:-2, Y:-1, V:-2 },
  E: { A:-1, R:0,  N:0,  D:2,  C:-4, Q:2,  E:5,  G:-2, H:0,  I:-3, L:-3, K:1,  M:-2, F:-3, P:-1, S:0,  T:-1, W:-3, Y:-2, V:-2 },
  G: { A:0,  R:-2, N:0,  D:-1, C:-3, Q:-2, E:-2, G:6,  H:-2, I:-4, L:-4, K:-2, M:-3, F:-3, P:-2, S:0,  T:-2, W:-2, Y:-3, V:-3 },
  H: { A:-2, R:0,  N:1,  D:-1, C:-3, Q:0,  E:0,  G:-2, H:8,  I:-3, L:-3, K:-1, M:-2, F:-1, P:-2, S:-1, T:-2, W:-2, Y:2,  V:-3 },
  I: { A:-1, R:-3, N:-3, D:-3, C:-1, Q:-3, E:-3, G:-4, H:-3, I:4,  L:2,  K:-3, M:1,  F:0,  P:-3, S:-2, T:-1, W:-3, Y:-1, V:3  },
  L: { A:-1, R:-2, N:-3, D:-4, C:-1, Q:-2, E:-3, G:-4, H:-3, I:2,  L:4,  K:-2, M:2,  F:0,  P:-3, S:-2, T:-1, W:-2, Y:-1, V:1  },
  K: { A:-1, R:2,  N:0,  D:-1, C:-3, Q:1,  E:1,  G:-2, H:-1, I:-3, L:-2, K:5,  M:-1, F:-3, P:-1, S:0,  T:-1, W:-3, Y:-2, V:-2 },
  M: { A:-1, R:-1, N:-2, D:-3, C:-1, Q:0,  E:-2, G:-3, H:-2, I:1,  L:2,  K:-1, M:5,  F:0,  P:-2, S:-1, T:-1, W:-1, Y:-1, V:1  },
  F: { A:-2, R:-3, N:-3, D:-3, C:-2, Q:-3, E:-3, G:-3, H:-1, I:0,  L:0,  K:-3, M:0,  F:6,  P:-4, S:-2, T:-2, W:1,  Y:3,  V:-1 },
  P: { A:-1, R:-2, N:-2, D:-1, C:-3, Q:-1, E:-1, G:-2, H:-2, I:-3, L:-3, K:-1, M:-2, F:-4, P:7,  S:-1, T:-1, W:-4, Y:-3, V:-2 },
  S: { A:1,  R:-1, N:1,  D:0,  C:-1, Q:0,  E:0,  G:0,  H:-1, I:-2, L:-2, K:0,  M:-1, F:-2, P:-1, S:4,  T:1,  W:-3, Y:-2, V:-2 },
  T: { A:0,  R:-1, N:0,  D:-1, C:-1, Q:-1, E:-1, G:-2, H:-2, I:-1, L:-1, K:-1, M:-1, F:-2, P:-1, S:1,  T:5,  W:-2, Y:-2, V:0  },
  W: { A:-3, R:-3, N:-4, D:-4, C:-2, Q:-2, E:-3, G:-2, H:-2, I:-3, L:-2, K:-3, M:-1, F:1,  P:-4, S:-3, T:-2, W:11, Y:2,  V:-3 },
  Y: { A:-2, R:-2, N:-2, D:-3, C:-2, Q:-1, E:-2, G:-3, H:2,  I:-1, L:-1, K:-2, M:-1, F:3,  P:-3, S:-2, T:-2, W:2,  Y:7,  V:-1 },
  V: { A:0,  R:-3, N:-3, D:-3, C:-1, Q:-2, E:-2, G:-3, H:-3, I:3,  L:1,  K:-2, M:1,  F:-1, P:-2, S:-2, T:0,  W:-3, Y:-1, V:4  },
};

// ==================== CODON USAGE (human, hg38) ====================
// Source: Kazusa Codon Usage Database, Homo sapiens
const CODON_USAGE: Record<string, number> = {
  GCT:0.26,GCC:0.40,GCA:0.23,GCG:0.11,
  TGT:0.45,TGC:0.55,
  GAT:0.46,GAC:0.54,
  GAA:0.42,GAG:0.58,
  TTT:0.45,TTC:0.55,
  GGT:0.35,GGC:0.40,GGA:0.16,GGG:0.09,
  CAT:0.41,CAC:0.59,
  ATT:0.36,ATC:0.48,ATA:0.11,ATG:1.0,
  AAA:0.42,AAG:0.58,
  CTT:0.13,CTC:0.20,CTA:0.07,CTG:0.47,TTA:0.07,TTG:0.13,
  AAT:0.46,AAC:0.54,
  CCT:0.28,CCC:0.33,CCA:0.27,CCG:0.11,
  CAA:0.27,CAG:0.73,
  AGA:0.20,AGG:0.21,CGA:0.07,CGC:0.19,CGG:0.10,CGT:0.08,
  TCT:0.18,TCC:0.22,TCA:0.15,TCG:0.06,AGT:0.15,AGC:0.24,
  ACT:0.25,ACC:0.36,ACA:0.28,ACG:0.11,
  GTT:0.18,GTC:0.24,GTA:0.11,GTG:0.47,
  TGG:1.0,
  TAT:0.44,TAC:0.56,
};

// ==================== DRUG RESISTANCE DATABASE ====================
// Curated from CARD, DGIdb, and PharmGKB for common resistance-conferring variants.
interface DrugResistanceEntry {
  drug: string;
  effect: "sensitizing" | "resistance" | "reduced_efficacy";
  mechanism: string;
  evidence: "Level A" | "Level B" | "Level C";
}

const DRUG_RESISTANCE_DB: Record<string, DrugResistanceEntry[]> = {
  "L->R":   [{ drug:"Erlotinib/Gefitinib", effect:"sensitizing", mechanism:"Activating EGFR kinase domain mutation (L858R)", evidence:"Level A" }],
  "T->M":   [{ drug:"1st-gen EGFR inhibitors", effect:"resistance", mechanism:"T790M gatekeeper mutation blocks drug binding", evidence:"Level A" }],
  "C->Y":   [{ drug:"Cisplatin", effect:"resistance", mechanism:"BRCA1 C61Y ablates HR repair pathway", evidence:"Level B" }],
  "E->K":   [{ drug:"Penicillin/Amoxicillin (MRSA)", effect:"resistance", mechanism:"PBP2a E239K — reduced beta-lactam affinity (mecA-encoded transpeptidase)", evidence:"Level B" }],
  "E->V":   [{ drug:"Fluoroquinolones", effect:"resistance", mechanism:"ParC E84V — topoisomerase IV drug-binding pocket mutation (QRDR)", evidence:"Level B" }],
  "D->N":   [{ drug:"Carbapenems", effect:"resistance", mechanism:"OXA-type carbapenemase active-site alteration", evidence:"Level C" }],
  "R->H":   [{ drug:"Multiple chemotherapies", effect:"resistance", mechanism:"TP53 R248H dominant-negative GOF mutation", evidence:"Level A" }],
  "R->C":   [{ drug:"MDM2 inhibitors", effect:"resistance", mechanism:"TP53 R175C — structural p53 inactivation", evidence:"Level B" }],
  "G->V":   [{ drug:"Cetuximab/Panitumumab", effect:"resistance", mechanism:"KRAS G12V constitutively active GTPase", evidence:"Level A" }],
  "G->D":   [{ drug:"Anti-EGFR mAbs", effect:"resistance", mechanism:"KRAS G12D blocks GTPase, constitutive RAS signaling", evidence:"Level A" }],
};

// ==================== AMINO ACID PROPERTIES ====================
const AA_GROUPS = {
  positive:    new Set(["K","R","H"]),
  negative:    new Set(["D","E"]),
  polar:       new Set(["S","T","N","Q","Y","C"]),
  hydrophobic: new Set(["A","V","I","L","M","F","W","P"]),
  tiny:        new Set(["A","G","S"]),
  aromatic:    new Set(["F","W","Y","H"]),
};

const isRadicalChange = (from: string, to: string): boolean => {
  const groups = Object.values(AA_GROUPS);
  for (const g of groups) {
    if (g.has(from) && !g.has(to)) return true;
  }
  return false;
};

// ==================== ESM1b PROXY SCORING ====================
// DISCLOSURE: this is NOT real ESM1b model inference. It is a heuristic proxy built from
// BLOSUM62 substitution scores + conservation weighting, used as a stand-in when no live
// model endpoint is available. Do not present this as calibrated to a citable correlation.
const computeESM1bProxy = (fromAA: string, toAA: string, conservation: number): number => {
  if (!fromAA || !toAA || fromAA === toAA || !BLOSUM62[fromAA]) return 0;
  const rawScore = BLOSUM62[fromAA][toAA] ?? -4;
  const normalized = 1 - (rawScore + 4) / 15;
  return Math.min(1, normalized * (0.5 + conservation * 0.5));
};

// ==================== AlphaMissense PROXY ====================
// DISCLOSURE: this is NOT the real AlphaMissense model. Real AlphaMissense is missense-only
// (it is not trained or evaluated on nonsense/frameshift variants). This proxy is a heuristic
// (conservation × BLOSUM62-derived score × chemical severity), not live model inference.
// Real AlphaMissense's published operating thresholds are <0.34 likely benign, 0.34-0.564
// ambiguous, >0.564 likely pathogenic — the 5-tier ACMG-style breakdown elsewhere in this file
// is a separate, proprietary heuristic layered on top, not an official AM or ACMG mapping.
const computeAlphaMissenseProxy = (
  fromAA: string, toAA: string, conservation: number, position: number, seqLen: number
): number => {
  if (!fromAA || !toAA || fromAA === toAA) return 0.05;
  const esm = computeESM1bProxy(fromAA, toAA, conservation);
  const radical = isRadicalChange(fromAA, toAA) ? 1.3 : 1.0;
  const posWeight = position / seqLen < 0.1 ? 1.2 : 1.0;
  return Math.min(0.99, esm * radical * posWeight);
};

// ==================== CONSERVATION SCORING ====================
const estimateConservation = (position: number, seqLength: number): number => {
  const p = position / seqLength;
  if (p < 0.05) return 0.95;
  if (p < 0.15) return 0.78;
  if (p > 0.85) return 0.32;
  return 0.45 + Math.sin(p * Math.PI) * 0.35;
};

// ==================== EPISTASIS ====================
// DISCLOSURE: real epistasis depends on 3D structural proximity, not linear sequence
// distance. This linear-distance heuristic is a simplification for simulation purposes
// only and is not derived from or validated against a specific epistasis dataset.
type EpistasisType = "additive" | "synergistic" | "antagonistic" | "neutral";
const assessEpistasis = (pos1: number, cls1: string, pos2: number, cls2: string): EpistasisType => {
  if (Math.abs(pos1 - pos2) < 9) {
    if (cls1 === "nonsense" || cls2 === "nonsense") return "synergistic";
    return "antagonistic";
  }
  return "additive";
};

// ==================== REAL API INTEGRATIONS ====================

interface ClinVarResult {
  id: string;
  significance: string;
  condition: string;
  reviewStatus: string;
}

interface GnomadResult {
  alleleFrequency: number | null;
  homozygoteCount: number;
  popmax: string;
}

interface UniProtAnnotation {
  feature: string;
  description: string;
  accession: string;
}

interface PubMedRef {
  pmid: string;
  title: string;
  year: string;
}

const apiCache = new Map<string, unknown>();

async function queryClinVar(gene: string, aminoAcidChange: string): Promise<ClinVarResult | null> {
  const key = `clinvar:${gene}:${aminoAcidChange}`;
  if (apiCache.has(key)) return apiCache.get(key) as ClinVarResult | null;

  try {
    const term = encodeURIComponent(`${gene}[gene] AND ${aminoAcidChange}[variant_name]`);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=${term}&retmode=json&retmax=1`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist ?? [];

    if (!ids.length) {
      apiCache.set(key, null);
      return null;
    }

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=${ids[0]}&retmode=json`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData = await summaryRes.json();
    const result = summaryData?.result?.[ids[0]];

    if (!result) {
      apiCache.set(key, null);
      return null;
    }

    const clinVarResult: ClinVarResult = {
      id: ids[0],
      significance: result.clinical_significance?.description ?? "Unknown",
      condition: result.trait_set?.[0]?.trait_name ?? "Unknown condition",
      reviewStatus: result.clinical_significance?.review_status ?? "No assertion",
    };

    apiCache.set(key, clinVarResult);
    return clinVarResult;
  } catch {
    apiCache.set(key, null);
    return null;
  }
}

async function queryGnomAD(variantId: string): Promise<GnomadResult | null> {
  const key = `gnomad:${variantId}`;
  if (apiCache.has(key)) return apiCache.get(key) as GnomadResult | null;

  try {
    const query = {
      query: `{ variant(variantId: "${variantId}", dataset: gnomad_r4) { genome { af, homozygote_count, populations { id, af } } } }`,
    };
    const res = await fetch("https://gnomad.broadinstitute.org/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    const data = await res.json();
    const genome = data?.data?.variant?.genome;

    if (!genome) {
      apiCache.set(key, null);
      return null;
    }

    const pops: { id: string; af: number }[] = genome.populations ?? [];
    const popmax = pops.reduce((a, b) => (b.af > (a?.af ?? 0) ? b : a), pops[0]);

    const gnomadResult: GnomadResult = {
      alleleFrequency: genome.af ?? null,
      homozygoteCount: genome.homozygote_count ?? 0,
      popmax: popmax ? `${popmax.id} (AF=${popmax.af?.toExponential(2)})` : "N/A",
    };

    apiCache.set(key, gnomadResult);
    return gnomadResult;
  } catch {
    apiCache.set(key, null);
    return null;
  }
}

async function queryUniProt(gene: string): Promise<UniProtAnnotation | null> {
  const key = `uniprot:${gene}`;
  if (apiCache.has(key)) return apiCache.get(key) as UniProtAnnotation | null;

  try {
    const url = `https://rest.uniprot.org/uniprotkb/search?query=gene:${encodeURIComponent(gene)}+AND+organism_id:9606&format=json&size=1&fields=accession,ft_act_site,ft_binding,ft_domain`;
    const res = await fetch(url);
    const data = await res.json();
    const entry = data?.results?.[0];

    if (!entry) {
      apiCache.set(key, null);
      return null;
    }

    const features = entry.features ?? [];
    const interesting = features.find((f: { type: string }) =>
      ["Active site", "Binding site", "Domain"].includes(f.type)
    );

    const result: UniProtAnnotation = {
      accession: entry.primaryAccession ?? "Unknown",
      feature: interesting?.type ?? "No critical feature annotated",
      description: interesting?.description ?? entry.proteinDescription?.recommendedName?.fullName?.value ?? gene,
    };

    apiCache.set(key, result);
    return result;
  } catch {
    apiCache.set(key, null);
    return null;
  }
}

async function queryPubMed(gene: string, mutationLabel: string): Promise<PubMedRef[]> {
  const key = `pubmed:${gene}:${mutationLabel}`;
  if (apiCache.has(key)) return apiCache.get(key) as PubMedRef[];

  try {
    const term = encodeURIComponent(`${gene} ${mutationLabel} mutation pathogenicity`);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${term}&retmax=3&retmode=json&sort=relevance`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist ?? [];

    if (!ids.length) {
      apiCache.set(key, []);
      return [];
    }

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData = await summaryRes.json();

    const refs: PubMedRef[] = ids.map((id) => {
      const r = summaryData?.result?.[id];
      return {
        pmid: id,
        title: r?.title ?? "Title unavailable",
        year: r?.pubdate?.split(" ")?.[0] ?? "N/A",
      };
    }).filter(Boolean);

    apiCache.set(key, refs);
    return refs;
  } catch {
    apiCache.set(key, []);
    return [];
  }
}

// ==================== TYPE DEFINITIONS ====================

type MutationType = "substitution" | "insertion" | "deletion" | "inversion" | "translocation";
type MutationContext = "coding" | "non-coding";
type MutationClassification = "synonymous" | "missense" | "nonsense" | "frameshift" | "structural";
type ACMGClass = "benign" | "likely_benign" | "uncertain" | "likely_pathogenic" | "pathogenic";
type SimulationSpeed = "animated" | "fast" | "instant";

interface PathogenicityScore {
  score: number;
  alphaMissense: number;
  esm1b: number;
  conservation: number;
  evidence: string[];
  sources: string[];
  classification: ACMGClass;
  clinvar: ClinVarResult | null;
  gnomad: GnomadResult | null;
  uniprot: UniProtAnnotation | null;
  literature: PubMedRef[];
  drugResistance: DrugResistanceEntry[];
}

interface MutationData {
  generation: number;
  position: number;
  type: MutationType;
  original: string;
  mutated: string;
  originalCodon: string;
  newCodon: string;
  aminoAcidChange: string;
  fromAA: string;
  toAA: string;
  context: MutationContext;
  classification: MutationClassification;
  effect: string;
  conservation: number;
  pathogenicity: PathogenicityScore;
  genomicCoordinate?: string;
  isRecurrent: boolean;
  // Set when a later structural event (deletion or CNV deletion) removed the exact base
  // this mutation occurred at. `position` is left at its last-known value for reference,
  // but no longer corresponds to a real base in the current sequence — the UI should not
  // draw a highlight for it.
  positionStale?: boolean;
}

interface GenerationStats {
  generation: number;
  fitness: number;
  mutationCount: number;
  progress: number;
  cumulativeMutations: number;
  severity: string;
  recurrentCount: number;
}

// ==================== SIMULATION UTILITIES ====================

const CODON_MAP: Record<string, string> = {
  ATA:"I",ATC:"I",ATT:"I",ATG:"M",
  ACA:"T",ACC:"T",ACG:"T",ACT:"T",
  AAC:"N",AAT:"N",AAA:"K",AAG:"K",
  AGC:"S",AGT:"S",AGA:"R",AGG:"R",
  CTA:"L",CTC:"L",CTG:"L",CTT:"L",
  CCA:"P",CCC:"P",CCG:"P",CCT:"P",
  CAC:"H",CAT:"H",CAA:"Q",CAG:"Q",
  CGA:"R",CGC:"R",CGG:"R",CGT:"R",
  GTA:"V",GTC:"V",GTG:"V",GTT:"V",
  GCA:"A",GCC:"A",GCG:"A",GCT:"A",
  GAC:"D",GAT:"D",GAA:"E",GAG:"E",
  GGA:"G",GGC:"G",GGG:"G",GGT:"G",
  TCA:"S",TCC:"S",TCG:"S",TCT:"S",
  TTC:"F",TTT:"F",TTA:"L",TTG:"L",
  TAC:"Y",TAT:"Y",TAA:"*",TAG:"*",
  TGC:"C",TGT:"C",TGA:"*",TGG:"W",
};

const BASES = ["A","C","G","T"];

class SeededRandom {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    let s = this.s;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.s = s >>> 0;
    return (this.s >>> 0) / 4294967296;
  }
}

const normalizeSequence = (seq: string): string =>
  seq.replace(/[^ACGTacgt]/g, "").toUpperCase();

const parseFASTA = (text: string): Record<string, string> => {
  const sequences: Record<string, string> = {};
  let header = "", seq = "";
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith(">")) {
      if (header) sequences[header] = normalizeSequence(seq);
      header = t.slice(1).trim(); seq = "";
    } else { seq += t; }
  }
  if (header) sequences[header] = normalizeSequence(seq);
  return sequences;
};

// Ti:Tv = 2:1. Reasonable whole-genome-average reference point; coding regions typically
// skew closer to ~3:1 — treated here as one grounded reference, not a universal constant.
const getMutatedBase = (orig: string, rng: SeededRandom): string => {
  const ti: Record<string, string> = { A:"G", G:"A", C:"T", T:"C" };
  const tv: Record<string, string[]> = { A:["C","T"], G:["C","T"], C:["A","G"], T:["A","G"] };
  if (rng.next() < 0.667) return ti[orig] ?? orig;
  const opts = tv[orig] ?? [orig];
  return opts[Math.floor(rng.next() * opts.length)];
};

const classifyCodonChange = (orig: string, neo: string): MutationClassification => {
  if (orig.length !== 3 || neo.length !== 3) return "frameshift";
  const origAA = CODON_MAP[orig], newAA = CODON_MAP[neo];
  if (origAA === newAA) return "synonymous";
  if (!newAA || newAA === "*") return "nonsense";
  return "missense";
};

// Remaps the `.position` field of every mutation in `muts` (mutating the objects in place)
// according to `transform`. `transform` returns the new index, or null if the base that
// mutation originally occurred at was itself removed by this structural event (in which
// case the mutation is flagged `positionStale` rather than given a bogus coordinate).
// This must be called immediately after ANY operation that inserts, deletes, reorders, or
// reflows array indices (indels, CNV, inversion, translocation) — otherwise every
// previously recorded mutation's `.position` silently drifts out of sync with where that
// base actually lives in the current sequence.
function remapPositions(muts: MutationData[], transform: (pos: number) => number | null) {
  for (const m of muts) {
    const newPos = transform(m.position);
    if (newPos === null) {
      m.positionStale = true;
    } else {
      m.position = newPos;
    }
  }
}

const buildPathogenicity = (
  mutation: Omit<MutationData, "pathogenicity" | "isRecurrent">,
  seqLen: number,
  allMuts: MutationData[],
): PathogenicityScore => {
  const evidence: string[] = [];
  const sources: string[] = ["ACMG SVI guidelines (2019)"];
  let score = 0;

  const con = mutation.conservation;
  const { fromAA, toAA, classification, position } = mutation;

  const am = classification === "missense"
    ? computeAlphaMissenseProxy(fromAA, toAA, con, position, seqLen)
    : classification === "nonsense" ? 0.97
    : classification === "frameshift" ? 0.88
    : 0.04;

  const esm = classification === "missense"
    ? computeESM1bProxy(fromAA, toAA, con)
    : classification === "nonsense" ? 0.95
    : classification === "frameshift" ? 0.85
    : 0.03;

  const ensembleScore = am * 0.6 + esm * 0.4;

  if (classification === "nonsense") {
    score = 0.93 + (position / seqLen < 0.8 ? 0.05 : 0);
    evidence.push("Premature stop codon — PVS1 criterion (ACMG)");
    evidence.push("Note: AlphaMissense does not score nonsense variants (missense-only model) — score above is a heuristic stand-in, not a real AM output");
    sources.push("ClinVar: Nonsense variants = Pathogenic (PVS1)");
  } else if (classification === "frameshift") {
    score = 0.86 + con * 0.08;
    evidence.push("Frameshift disrupts reading frame — PVS1 criterion");
  } else if (classification === "missense") {
    score = ensembleScore;
    evidence.push(`AlphaMissense-style proxy (heuristic, not real AM inference): ${(am * 100).toFixed(0)}% pathogenic`);
    evidence.push(`ESM1b-style proxy (BLOSUM62-derived, not real ESM1b inference): score = ${BLOSUM62[fromAA]?.[toAA] ?? "N/A"}`);
    if (isRadicalChange(fromAA, toAA)) {
      evidence.push(`Radical AA change: ${fromAA}→${toAA} (chemical class switch)`);
      sources.push("Align-GVGD chemical severity matrix");
    }
    evidence.push(`Conservation at position: ${(con * 100).toFixed(0)}% (ConSurf-style estimate)`);
    sources.push("UniProt ConSurf-equivalent conservation");
    const codonBiasDelta = Math.abs(
      (CODON_USAGE[mutation.newCodon] ?? 0.5) - (CODON_USAGE[mutation.originalCodon] ?? 0.5)
    );
    if (codonBiasDelta > 0.2) {
      score += 0.03;
      evidence.push("Codon usage bias shift (may alter translation kinetics)");
      sources.push("Kazusa Codon Usage Database");
    }
  } else if (classification === "structural") {
    score = 0.90 + Math.min(0.08, con * 0.08);
    evidence.push("Structural variant — likely disruptive to gene structure/function");
    sources.push("ACMG: SVs with gene disruption");
  } else {
    score = 0.04;
    evidence.push("Synonymous — likely benign (BS1 criterion)");
  }

  if (allMuts.length > 0) {
    const prev = allMuts[allMuts.length - 1];
    const epi = assessEpistasis(position, classification, prev.position, prev.classification);
    if (epi === "synergistic") {
      score = Math.min(1, score * 1.25);
      evidence.push("Synergistic epistasis with prior variant (compound effect) — sequence-distance heuristic, not structurally derived");
    } else if (epi === "antagonistic") {
      score *= 0.8;
      evidence.push("Antagonistic epistasis — prior mutation may partially compensate (sequence-distance heuristic, not structurally derived)");
    }
  }

  const changeKey = fromAA && toAA ? `${fromAA}->${toAA}` : "";
  const drugResistance = DRUG_RESISTANCE_DB[changeKey] ?? [];
  if (drugResistance.length) {
    evidence.push(`Drug resistance: ${drugResistance[0].drug} (${drugResistance[0].effect})`);
    sources.push("CARD / PharmGKB drug-variant database");
  }

  // NOTE ON THRESHOLDS: real AlphaMissense's published operating points are <0.34 likely
  // benign, 0.34-0.564 ambiguous, >0.564 likely pathogenic (Cheng et al. 2023, Science).
  // The 5-tier ACMG-style breakdown below is a separate, proprietary heuristic layered on
  // top of the ensemble score — it is NOT an official AlphaMissense or ACMG mapping.
  let cls: ACMGClass;
  if (score >= 0.85) cls = "pathogenic";
  else if (score >= 0.65) cls = "likely_pathogenic";
  else if (score >= 0.40) cls = "uncertain";
  else if (score >= 0.20) cls = "likely_benign";
  else cls = "benign";

  return {
    score: Math.min(1, Math.max(0, score)),
    alphaMissense: am,
    esm1b: esm,
    conservation: con,
    evidence,
    sources,
    classification: cls,
    clinvar: null,
    gnomad: null,
    uniprot: null,
    literature: [],
    drugResistance,
  };
};

// Fitness penalty constants. NOTE: these are conservation-weighted heuristics, not values
// calibrated against a real distribution-of-fitness-effects (DFE) dataset. Flag for
// domain-expert review before this score informs any real decision.
const calculateFitness = (mutations: MutationData[]): number => {
  let fitness = 100;
  mutations.forEach((m, idx) => {
    const p = m.pathogenicity;
    const w = p.conservation;
    if (m.type === "substitution") {
      if (m.classification === "nonsense") fitness -= 25 + w * 10;
      else if (m.classification === "missense") fitness -= 6 + p.score * 10 * w;
      else fitness -= 0.3 + 0.1 * w;
    } else {
      fitness -= 12 + w * 6;
    }
    if (idx > 0) {
      const prev = mutations[idx - 1];
      const epi = assessEpistasis(m.position, m.classification, prev.position, prev.classification);
      if (epi === "synergistic") fitness *= 0.86;
      else if (epi === "antagonistic") fitness *= 0.96;
    }
  });
  return Math.max(0, fitness);
};

const makeSeverity = (f: number) =>
  f >= 90 ? "Stable" : f >= 75 ? "Moderate" : f >= 50 ? "At risk" : "Critically impacted";

// ==================== MAIN COMPONENT ====================

export default function MutationSimulator() {
  const [fastaFile, setFastaFile] = useState<File | null>(null);
  const [sequence, setSequence] = useState("");
  const [fastaHeader, setFastaHeader] = useState("No sequence loaded");
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<SimulationSpeed>("animated");

  const [params, setParams] = useState({
    tempUnit: "C" as "C" | "F",
    temperature: 37,
    substitutionRate: 0.0002,
    numGenerations: 10 as 10 | 50 | 100,
    pH: 7.0,
    nutrients: "Medium",
    oxygen: "Normal (21%)",
    uvExposure: false,
    uvDose: 20,
    mutagen: "None" as "None" | "EMS" | "HNO2" | "AFB1" | "BaP",
    seed: 42,
    genomicChrom: "",
    genomicStart: "",
    genomicEnd: "",
    genomicStrand: "+" as "+" | "-",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentGen, setCurrentGen] = useState(0);
  const [mutations, setMutations] = useState<MutationData[]>([]);
  const [genStats, setGenStats] = useState<GenerationStats[]>([]);
  const [fitness, setFitness] = useState(100);
  const [currentSequence, setCurrentSequence] = useState("");
  const [activeTab, setActiveTab] = useState<"variants" | "recurrent" | "resistance" | "literature">("variants");
  const [apiLoading, setApiLoading] = useState(false);

  // Recurrent-mutation tracking
  const recurrenceHistory = useRef<Map<number, { bases: string[]; gens: number[] }>>(new Map());
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  const genRef = useRef(0);
  const seqRef = useRef("");
  const mutsRef = useRef<MutationData[]>([]);

  // Element references for sequence view jumps
  const posRefs = useRef<Map<number, HTMLSpanElement>>(new Map());

  // Keep refs in sync
  useEffect(() => { genRef.current = currentGen; }, [currentGen]);
  useEffect(() => { seqRef.current = currentSequence; }, [currentSequence]);
  useEffect(() => { mutsRef.current = mutations; }, [mutations]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFastaFile(file);
    const text = await file.text();
    const parsed = parseFASTA(text);
    const [header, seq] = Object.entries(parsed)[0] ?? ["Unknown", ""];
    if (seq) {
      setSequence(seq);
      setFastaHeader(header);
      resetState(seq);
    }
  };

  const resetState = useCallback((seq?: string) => {
    setIsRunning(false);
    setCurrentGen(0);
    setMutations([]);
    setGenStats([]);
    setFitness(100);
    setCurrentSequence(seq ?? sequence);
    recurrenceHistory.current.clear();
    genRef.current = 0;
    seqRef.current = seq ?? sequence;
    mutsRef.current = [];
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, [sequence]);

  const computeEffectiveRate = useCallback(() => {
    const t = params.tempUnit === "F" ? ((params.temperature - 32) * 5) / 9 : params.temperature;
    let r = params.substitutionRate * Math.exp((t - 37) / 10 * 0.5);
    const ph = params.pH;
    if (ph < 5.5) r *= 1 + (5.5 - ph) * 0.18;
    if (ph > 8.5) r *= 1 + (ph - 8.5) * 0.12;
    if (params.uvExposure) r += params.uvDose * 0.000003;
    if (params.mutagen === "EMS")  r *= 1.4;
    if (params.mutagen === "HNO2") r *= 1.35;
    if (params.mutagen === "AFB1") r *= 1.3;
    if (params.mutagen === "BaP")  r *= 1.25;
    if (params.nutrients === "Low")    r *= 0.95;
    if (params.nutrients === "Excess") r *= 1.08;
    if (params.oxygen === "High") r *= 1.05;
    return Math.min(r, 0.002);
  }, [params]);

  const runOneGeneration = useCallback(() => {
    const g = genRef.current;
    const curSeq = seqRef.current;
    const prevMuts = mutsRef.current;

    if (!curSeq || g >= params.numGenerations) {
      setIsRunning(false);
      return;
    }

    const rng = new SeededRandom(params.seed * 1000 + g * 137);
    const effRate = computeEffectiveRate();
    const seqArr = curSeq.split("");
    const genMuts: MutationData[] = [];
    let recurrentCount = 0;

    // `liveMuts` is the running, ALWAYS-CURRENT-COORDINATES view of every mutation so far
    // (previous generations + this one). It starts as a clone of prevMuts and gets both
    // new entries appended and existing entries' `.position` remapped every time a
    // structural event (indel, CNV, inversion, translocation) shifts the array underneath
    // them. This is what gets stored as the new mutation list at the end of the generation
    // — NOT `[...prevMuts, ...genMuts]`, which would silently leave every earlier
    // mutation's position stale after the first length-changing event.
    const liveMuts: MutationData[] = prevMuts.map(m => ({ ...m }));

    const deriveGenomicCoordinate = (seqIndex: number, length = 1): string | undefined => {
      const chrom = params.genomicChrom.trim();
      const start = parseInt(params.genomicStart, 10);
      const end = parseInt(params.genomicEnd, 10);
      const strand = params.genomicStrand;
      if (!chrom || Number.isNaN(start) || Number.isNaN(end) || end < start || (strand !== "+" && strand !== "-")) return undefined;
      const seqLen = curSeq.length;
      const genomicSpan = end - start + 1;
      if (genomicSpan < seqLen) return undefined;
      const seqStart = seqIndex;
      const seqEnd = seqIndex + length - 1;
      if (seqStart < 0 || seqEnd >= seqLen) return undefined;
      const posAt = (idx: number) => (strand === "+" ? start + idx : end - idx);
      const posA = posAt(seqStart);
      const posB = posAt(seqEnd);
      const low = Math.min(posA, posB);
      const high = Math.max(posA, posB);
      if (low < start || high > end) return undefined;
      return length === 1 ? `${chrom}:${posA}` : `${chrom}:${low}-${high}`;
    };

    const applySubstitution = (i: number, newBase: string, type: "substitution") => {
      const origBase = curSeq[i];
      if (newBase === origBase) return;
      const cs = Math.floor(i / 3) * 3;
      const origCodon = curSeq.slice(cs, cs + 3);
      const arr = origCodon.split(""); arr[i - cs] = newBase;
      const newCodon = arr.join("");
      const cls = classifyCodonChange(origCodon, newCodon);
      const fromAA = CODON_MAP[origCodon] ?? "?";
      const toAA   = CODON_MAP[newCodon]  ?? "?";
      const conservation = estimateConservation(i, curSeq.length);
      const context: MutationContext = i < Math.floor(curSeq.length * 0.85) ? "coding" : "non-coding";
      const genomicCoordinate = deriveGenomicCoordinate(i);

      const hist = recurrenceHistory.current.get(i) ?? { bases: [], gens: [] };
      const isRecurrent = hist.bases.includes(newBase);
      hist.bases.push(newBase); hist.gens.push(g + 1);
      recurrenceHistory.current.set(i, hist);
      if (isRecurrent) recurrentCount++;

      const mutData: Omit<MutationData, "pathogenicity" | "isRecurrent"> = {
        generation: g + 1, position: i, type,
        original: origBase, mutated: newBase,
        originalCodon: origCodon, newCodon,
        aminoAcidChange: fromAA !== toAA ? `${fromAA}→${toAA}` : "synonymous",
        fromAA, toAA, context, classification: cls, conservation,
        effect: cls === "nonsense" ? "Premature stop codon" :
                cls === "frameshift" ? "Reading frame disrupted" :
                cls === "missense" ? `AA change: ${fromAA}→${toAA}` : "Silent substitution",
        genomicCoordinate,
      };

      const pathogenicity = buildPathogenicity(mutData, curSeq.length, [...prevMuts, ...genMuts]);
      seqArr[i] = newBase;
      const fullMut: MutationData = { ...mutData, pathogenicity, isRecurrent };
      genMuts.push(fullMut);
      liveMuts.push({ ...fullMut }); // substitutions don't shift indices — no remap needed
    };

    // Substitutions
    for (let i = 0; i < curSeq.length; i++) {
      if (rng.next() < effRate) {
        const origBase = curSeq[i];

        if (params.uvExposure && i < curSeq.length - 1) {
          const dinuc = curSeq[i] + curSeq[i + 1];
          const pyrimPairs = new Set(["TT","TC","CT","CC"]);
          if (pyrimPairs.has(dinuc) && rng.next() < params.uvDose * 0.00002) {
            const target3p = curSeq[i + 1];
            if (target3p === "C") applySubstitution(i + 1, "T", "substitution");
            else if (target3p === "T") applySubstitution(i + 1, "C", "substitution");
            continue;
          }
        }

        if (params.mutagen === "EMS" && origBase === "G" && rng.next() < effRate * 2) {
          applySubstitution(i, "A", "substitution"); continue;
        }
        if (params.mutagen === "HNO2") {
          if (origBase === "C" && rng.next() < effRate * 2) { applySubstitution(i, "T", "substitution"); continue; }
          if (origBase === "A" && rng.next() < effRate * 1.2) { applySubstitution(i, "G", "substitution"); continue; }
        }
        if (params.mutagen === "AFB1" && origBase === "G" && rng.next() < effRate * 1.8) {
          applySubstitution(i, "T", "substitution"); continue;
        }
        if (params.mutagen === "BaP" && origBase === "G" &&
            i > 0 && curSeq[i - 1] === "C" && rng.next() < effRate * 1.6) {
          applySubstitution(i, rng.next() > 0.5 ? "T" : "A", "substitution"); continue;
        }

        if (params.pH < 5.5 && (origBase === "A" || origBase === "G") && rng.next() < effRate * 1.5) {
          const randBase = BASES.filter(b => b !== origBase)[Math.floor(rng.next() * 3)];
          applySubstitution(i, randBase, "substitution"); continue;
        }
        if (params.pH > 8.5 && origBase === "C" && rng.next() < effRate * 1.8) {
          applySubstitution(i, "T", "substitution"); continue;
        }

        applySubstitution(i, getMutatedBase(origBase, rng), "substitution");
      }
    }

    // Indels (replication slippage) — length-changing, so remap liveMuts immediately after
    if (rng.next() < effRate * 0.08) {
      const pos = Math.floor(rng.next() * seqArr.length);
      const conservation = estimateConservation(pos, curSeq.length);
      if (rng.next() > 0.5 && seqArr.length < 1500) {
        const insBase = BASES[Math.floor(rng.next() * 4)];
        seqArr.splice(pos, 0, insBase);
        remapPositions(liveMuts, p => (p >= pos ? p + 1 : p));
        const context: MutationContext = pos < Math.floor(curSeq.length * 0.85) ? "coding" : "non-coding";
        const mutData: Omit<MutationData, "pathogenicity"> = {
          generation: g+1, position: pos, type:"insertion",
          original:"-", mutated: insBase, originalCodon:"—", newCodon:"—",
          aminoAcidChange:"frameshift", fromAA:"—", toAA:"—",
          context, classification:"frameshift", conservation,
          effect:"Insertion — +1 frameshift (replication slippage)",
          isRecurrent: false,
        };
        const pathogenicity = buildPathogenicity(mutData, curSeq.length, [...prevMuts, ...genMuts]);
        const fullMut: MutationData = { ...mutData, pathogenicity };
        genMuts.push(fullMut);
        liveMuts.push({ ...fullMut });
      } else if (seqArr.length > 9) {
        const del = seqArr.splice(pos, 1)[0];
        remapPositions(liveMuts, p => (p < pos ? p : p === pos ? null : p - 1));
        const context: MutationContext = pos < Math.floor(curSeq.length * 0.85) ? "coding" : "non-coding";
        const mutData: Omit<MutationData, "pathogenicity"> = {
          generation: g+1, position: pos, type:"deletion",
          original: del ?? "-", mutated:"-", originalCodon:"—", newCodon:"—",
          aminoAcidChange:"frameshift", fromAA:"—", toAA:"—",
          context, classification:"frameshift", conservation,
          effect:"Deletion — −1 frameshift (replication slippage)",
          isRecurrent: false,
        };
        const pathogenicity = buildPathogenicity(mutData, curSeq.length, [...prevMuts, ...genMuts]);
        const fullMut: MutationData = { ...mutData, pathogenicity };
        genMuts.push(fullMut);
        liveMuts.push({ ...fullMut });
      }
    }

    // Block CNV: 50–300bp duplication/deletion — length-changing, remap liveMuts immediately
    if (rng.next() < 0.04) {
      const blockLen = Math.floor(rng.next() * 251) + 50;
      const bStart   = Math.floor(rng.next() * Math.max(1, seqArr.length - blockLen));
      const conservation = estimateConservation(bStart, curSeq.length);
      const genomicCoordinate = deriveGenomicCoordinate(bStart, blockLen);
      if (rng.next() > 0.5 && seqArr.length < 2000) {
        const block = seqArr.slice(bStart, bStart + blockLen);
        seqArr.splice(bStart + blockLen, 0, ...block);
        remapPositions(liveMuts, p => (p >= bStart + blockLen ? p + blockLen : p));
        const mutData: Omit<MutationData, "pathogenicity"> = {
          generation: g+1, position: bStart, type:"insertion",
          original:`${blockLen}bp`, mutated:`${blockLen}bp×2`,
          originalCodon:"—", newCodon:"—",
          aminoAcidChange:"CNV duplication", fromAA:"—", toAA:"—",
          context:"coding", classification:"frameshift", conservation,
          effect:`Block duplication: ${blockLen}bp at pos ${bStart}`,
          genomicCoordinate,
          isRecurrent: false,
        };
        const pathogenicity = buildPathogenicity(mutData, curSeq.length, [...prevMuts, ...genMuts]);
        const fullMut: MutationData = { ...mutData, pathogenicity };
        genMuts.push(fullMut);
        liveMuts.push({ ...fullMut });
      } else if (seqArr.length - blockLen > 9) {
        seqArr.splice(bStart, blockLen);
        remapPositions(liveMuts, p => {
          if (p < bStart) return p;
          if (p >= bStart + blockLen) return p - blockLen;
          return null;
        });
        const mutData: Omit<MutationData, "pathogenicity"> = {
          generation: g+1, position: bStart, type:"deletion",
          original:`${blockLen}bp`, mutated:"—",
          originalCodon:"—", newCodon:"—",
          aminoAcidChange:"CNV deletion", fromAA:"—", toAA:"—",
          context:"coding", classification:"frameshift", conservation,
          effect:`Block deletion: ${blockLen}bp at pos ${bStart}`,
          genomicCoordinate,
          isRecurrent: false,
        };
        const pathogenicity = buildPathogenicity(mutData, curSeq.length, [...prevMuts, ...genMuts]);
        const fullMut: MutationData = { ...mutData, pathogenicity };
        genMuts.push(fullMut);
        liveMuts.push({ ...fullMut });
      }
    }

    // Structural variants: inversion (reorders within a fixed-length block) or
    // intrachromosomal translocation (excise + reinsert elsewhere) — both remap liveMuts.
    if (rng.next() < 0.02 && seqArr.length > 100) {
      const blockLen = Math.floor(rng.next() * 61) + 20;
      const bStart = Math.floor(rng.next() * Math.max(1, seqArr.length - blockLen));
      const conservation = estimateConservation(bStart, curSeq.length);
      const genomicCoordinate = deriveGenomicCoordinate(bStart, blockLen);

      if (rng.next() < 0.5) {
        // Inversion flips a double-stranded segment end-for-end; reading the same strand
        // 5'->3' through it yields the reverse COMPLEMENT of the original.
        const complement: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
        const block = seqArr.slice(bStart, bStart + blockLen);
        const inverted = block.slice().reverse().map(b => complement[b] ?? b);
        seqArr.splice(bStart, blockLen, ...inverted);
        // Length is unchanged, but positions INSIDE the block are now mirrored around its
        // midpoint — a substitution originally at bStart now sits at bStart+blockLen-1, etc.
        remapPositions(liveMuts, p => {
          if (p < bStart || p >= bStart + blockLen) return p;
          return bStart + (bStart + blockLen - 1 - p);
        });
        const mutData: Omit<MutationData, "pathogenicity"> = {
          generation: g+1, position: bStart, type:"inversion",
          original:`${blockLen}bp`, mutated:`${blockLen}bp inverted`,
          originalCodon:"—", newCodon:"—",
          aminoAcidChange:"Inversion", fromAA:"—", toAA:"—",
          context:"coding", classification:"structural", conservation,
          effect:`Block inversion: ${blockLen}bp at pos ${bStart}`,
          genomicCoordinate,
          isRecurrent: false,
        };
        const pathogenicity = buildPathogenicity(mutData, curSeq.length, [...prevMuts, ...genMuts]);
        const fullMut: MutationData = { ...mutData, pathogenicity };
        genMuts.push(fullMut);
        liveMuts.push({ ...fullMut });
      } else if (seqArr.length - blockLen > 30) {
        const block = seqArr.splice(bStart, blockLen);
        let insertAt = Math.floor(rng.next() * Math.max(1, seqArr.length));
        if (insertAt === bStart) insertAt = (insertAt + 10) % Math.max(1, seqArr.length);
        seqArr.splice(insertAt, 0, ...block);
        // Two-step remap: bases that were inside the excised block move to insertAt+offset
        // (their relative order is preserved, no reversal); everything else shifts as a
        // plain excision followed by a plain insertion at insertAt.
        remapPositions(liveMuts, p => {
          let intermediate: number | null;
          let movedOffset: number | null = null;
          if (p < bStart) intermediate = p;
          else if (p >= bStart + blockLen) intermediate = p - blockLen;
          else { intermediate = null; movedOffset = p - bStart; }
          if (movedOffset !== null) return insertAt + movedOffset;
          return intermediate! >= insertAt ? intermediate! + blockLen : intermediate!;
        });
        const newCoord = deriveGenomicCoordinate(insertAt, blockLen);
        const mutData: Omit<MutationData, "pathogenicity"> = {
          generation: g+1, position: bStart, type:"translocation",
          original:`${blockLen}bp`, mutated:`${blockLen}bp moved`,
          originalCodon:"—", newCodon:"—",
          aminoAcidChange:"Translocation", fromAA:"—", toAA:"—",
          context:"coding", classification:"structural", conservation,
          effect:`Block translocation: ${blockLen}bp from ${bStart} to ${insertAt}`,
          genomicCoordinate: genomicCoordinate ? `${genomicCoordinate} → ${newCoord ?? "unknown"}` : undefined,
          isRecurrent: false,
        };
        const pathogenicity = buildPathogenicity(mutData, curSeq.length, [...prevMuts, ...genMuts]);
        const fullMut: MutationData = { ...mutData, pathogenicity };
        genMuts.push(fullMut);
        liveMuts.push({ ...fullMut });
      }
    }

    const newSeq = seqArr.join("");
    const nextMuts = liveMuts; // fully remapped — safe to store and display directly
    const nextFitness = calculateFitness(nextMuts);

    setCurrentSequence(newSeq);
    setMutations(nextMuts);
    setFitness(nextFitness);
    setCurrentGen(prev => {
      const newGen = prev + 1;
      genRef.current = newGen;
      return newGen;
    });
    setGenStats(prev => [...prev, {
      generation: g + 1,
      fitness: nextFitness,
      mutationCount: genMuts.length,
      progress: ((g + 1) / params.numGenerations) * 100,
      cumulativeMutations: nextMuts.length,
      severity: makeSeverity(nextFitness),
      recurrentCount,
    }]);
  }, [params, computeEffectiveRate]);

  // Async API enrichment
  const enrichLastMutation = useCallback(async (mut: MutationData) => {
    if (mut.classification !== "missense" && mut.classification !== "nonsense") return;
    setApiLoading(true);
    try {
      const gene = fastaHeader.split(/\s+/)[0]?.replace(/[^A-Z0-9]/gi,"") ?? "UNKNOWN";
      const label = mut.aminoAcidChange.replace("→",">");

      let gnomadVariantId: string | null = null;
      if (mut.type === "substitution" && mut.genomicCoordinate && params.genomicChrom && params.genomicStart && params.genomicEnd && params.genomicStrand) {
        const [chrom, coordPart] = mut.genomicCoordinate.split(":");
        const genomicPos = coordPart ? parseInt(coordPart.split("-")[0], 10) : NaN;
        if (chrom && !Number.isNaN(genomicPos)) {
          const complementBase: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
          const refAllele = params.genomicStrand === "-" ? (complementBase[mut.original] ?? mut.original) : mut.original;
          const altAllele = params.genomicStrand === "-" ? (complementBase[mut.mutated] ?? mut.mutated) : mut.mutated;
          gnomadVariantId = `${chrom}-${genomicPos}-${refAllele}-${altAllele}`;
        }
      }

      const [clinvar, pubmed, uniprot, gnomad] = await Promise.all([
        queryClinVar(gene, label),
        queryPubMed(gene, mut.aminoAcidChange),
        queryUniProt(gene),
        gnomadVariantId ? queryGnomAD(gnomadVariantId) : Promise.resolve(null),
      ]);
      setMutations(prev => prev.map(m =>
        m.position === mut.position && m.generation === mut.generation
          ? { ...m, pathogenicity: { ...m.pathogenicity, clinvar, literature: pubmed, uniprot, gnomad } }
          : m
      ));
    } finally {
      setApiLoading(false);
    }
  }, [fastaHeader, params.genomicChrom, params.genomicStart, params.genomicEnd, params.genomicStrand]);

  useEffect(() => {
    if (!isRunning) return;
    if (speed === "instant") {
      for (let i = genRef.current; i < params.numGenerations; i++) {
        runOneGeneration();
      }
      setIsRunning(false);
      return;
    }
    const delay = speed === "fast" ? 150 : 900;
    const animate = (ts: number) => {
      if (ts - lastUpdateRef.current >= delay) {
        if (genRef.current >= params.numGenerations) {
          setIsRunning(false);
          return;
        }
        runOneGeneration();
        lastUpdateRef.current = ts;
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isRunning, speed, params.numGenerations, runOneGeneration]);

  useEffect(() => {
    const lastPathogenic = [...mutations].reverse().find(m =>
      m.classification === "missense" || m.classification === "nonsense"
    );
    if (lastPathogenic && !lastPathogenic.pathogenicity.clinvar) {
      enrichLastMutation(lastPathogenic);
    }
  }, [mutations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = () => {
    if (!sequence) { alert("Upload a FASTA file first."); return; }
    if (isRunning) { setIsRunning(false); return; }
    resetState();
    setTimeout(() => setIsRunning(true), 50);
  };

  const handleExport = () => {
    const data = { sequence, finalSequence: currentSequence, mutations, generationStats: genStats,
      summary: { totalMutations: mutations.length, fitness, generations: currentGen, seed: params.seed } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `helixmind-mutation-${Date.now()}.json`;
    a.click();
  };

  const scrollToMutation = (mut: MutationData) => {
    if (mut.positionStale) return; // no valid base to jump to — site was later deleted
    const el = posRefs.current.get(mut.position);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid #66c2ff";
      setTimeout(() => { el.style.outline = "none"; }, 1500);
    }
  };

  // Map CURRENT mutated positions for visual lookup. Stale entries (their original base
  // was later deleted by an indel/CNV) are excluded — there's no real base left to color.
  const mutationMap = useMemo(() => {
    const map = new Map<number, MutationData>();
    mutations.forEach(m => { if (!m.positionStale) map.set(m.position, m); });
    return map;
  }, [mutations]);

  // Derived statistics
  const totalMuts   = mutations.length;
  const substitutions = mutations.filter(m => m.type === "substitution").length;
  const tiCount     = mutations.filter(m => {
    const purines = new Set(["A","G"]);
    return m.type === "substitution" &&
      ((purines.has(m.original) && purines.has(m.mutated)) ||
       (!purines.has(m.original) && !purines.has(m.mutated)));
  }).length;
  const tvCount     = substitutions - tiCount;
  const titvRatio   = tvCount > 0 ? (tiCount / tvCount).toFixed(2) : tiCount > 0 ? "∞" : "—";
  const pathogenic  = mutations.filter(m => m.pathogenicity.score > 0.65).length;
  const uncertain   = mutations.filter(m => m.pathogenicity.score >= 0.40 && m.pathogenicity.score <= 0.65).length;
  const benign      = mutations.filter(m => m.pathogenicity.score < 0.40).length;
  const recurrentMuts = mutations.filter(m => m.isRecurrent);
  const resistanceMuts = mutations.filter(m => m.pathogenicity.drugResistance.length > 0);
  const allLiterature: (PubMedRef & { mutation: string })[] = mutations.flatMap(m =>
    m.pathogenicity.literature.map(l => ({ ...l, mutation: m.aminoAcidChange }))
  );
  const hasGenomicAnchor = Boolean(params.genomicChrom && params.genomicStart && params.genomicEnd && params.genomicStrand);
  const sequenceMapTooLarge = currentSequence.length > 5000;

  // Styles
  const card: React.CSSProperties = { border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:"18px 20px", background:"rgba(255,255,255,0.03)" };
  const infoBox: React.CSSProperties = { borderRadius:12, padding:"12px 14px", background:"rgba(4,17,31,0.9)", marginBottom:8 };
  const label13: React.CSSProperties = { fontSize:13, fontWeight:500, marginBottom:6, display:"block" };
  const inputStyle: React.CSSProperties = { width:"100%", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(4,17,31,0.95)", color:"#f6f8fb", padding:"10px 12px", fontSize:14 };
  const chipCls = (active: boolean): React.CSSProperties => ({
    padding:"6px 14px", border:`1px solid ${active?"#66c2ff":"rgba(255,255,255,0.1)"}`,
    background: active?"rgba(102,194,255,0.15)":"rgba(255,255,255,0.03)",
    borderRadius:999, cursor:"pointer", color: active?"#66c2ff":"#88a0b9", fontSize:13, fontWeight:600,
  });
  const acmgColor = (cls: ACMGClass) =>
    cls === "pathogenic" ? "#ff6450" :
    cls === "likely_pathogenic" ? "#ffa550" :
    cls === "uncertain" ? "#ffd166" :
    cls === "likely_benign" ? "#90d4a0" : "#66c2ff";

  return (
    <div style={{ minHeight:"100vh", background:"#07111f", color:"#f6f8fb", fontFamily:"system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ position:"fixed", left:0, top:0, bottom:0, width:68, background:"#04111f", borderRight:"1px solid rgba(255,255,255,0.07)", padding:"18px 10px", display:"flex", flexDirection:"column", gap:10, zIndex:10 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#66c2ff,#34d399)", display:"grid", placeItems:"center", fontWeight:800, color:"#04111f", fontSize:20 }}>H</div>
        <div style={{ fontSize:10, color:"#88a0b9", textAlign:"center", marginTop:4 }}>MutSim</div>
        {apiLoading && (
          <div style={{ marginTop:"auto", fontSize:9, color:"#66c2ff", textAlign:"center", lineHeight:1.4 }}>
            API<br/>query…
          </div>
        )}
      </aside>

      <div style={{ marginLeft:68, padding:"24px 28px", maxWidth:1500 }}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, color:"#66c2ff", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>HelixMind — Annotation & Intelligence Layer</div>
          <h1 style={{ fontSize:26, fontWeight:700, margin:0 }}>Mutation Simulator</h1>
          <div style={{ fontSize:13, color:"#88a0b9", marginTop:4 }}>
            AlphaMissense-style · ESM1b-style scoring · ClinVar · gnomAD · UniProt · PubMed · Recurrent Mutation Detection · AMR Drug Resistance
          </div>
          <div style={{ fontSize:11, color:"#6b8299", marginTop:6, lineHeight:1.5, maxWidth:760 }}>
            Pathogenicity estimates are computed from BLOSUM62 substitution scores, estimated conservation, and chemical-change
            heuristics — not live AlphaMissense or ESM1b model inference. Treat scores as a research-simulation heuristic,
            not a clinical or validated prediction.
          </div>
        </div>

        {/* Stat strip */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:10, marginBottom:24 }}>
          {[
            { v: totalMuts, l:"Total mutations" },
            { v: substitutions, l:"Substitutions" },
            { v: `${titvRatio}`, l:"Ti/Tv ratio (exp ~2)" },
            { v: pathogenic, l:"Pathogenic", c:"#ff6450" },
            { v: uncertain, l:"Uncertain", c:"#ffd166" },
            { v: benign, l:"Benign", c:"#66c2ff" },
            { v: fitness.toFixed(1), l:"Fitness score" },
          ].map(s => (
            <div key={s.l} style={{ ...infoBox, marginBottom:0, textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:700, color: s.c ?? "#f6f8fb" }}>{s.v}</div>
              <div style={{ fontSize:11, color:"#88a0b9", marginTop:3 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:24 }}>
          {/* LEFT COLUMN */}
          <div style={{ display:"grid", gap:24 }}>
            {/* FASTA upload */}
            <div style={card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <h2 style={{ margin:0, fontSize:18 }}>Sequence input</h2>
                <label htmlFor="fasta_upload" style={{ cursor:"pointer", padding:"9px 16px", background:"#66c2ff", color:"#04111f", borderRadius:999, fontWeight:700, fontSize:13 }}>
                  Browse FASTA
                  <input id="fasta_upload" type="file" accept=".fasta,.fa,.fna,.ffn,.faa" style={{ display:"none" }} onChange={handleFileChange} />
                </label>
              </div>
              <div style={{ border:"1px dashed rgba(102,194,255,0.35)", borderRadius:12, padding:16, minHeight:80, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center", color:"#88a0b9" }}>
                {fastaFile ? (
                  <div>
                    <div style={{ fontWeight:700, color:"#f6f8fb", marginBottom:4 }}>{fastaFile.name}</div>
                    <div style={{ fontSize:13 }}>{fastaHeader} · {sequence.length.toLocaleString()} bp · GC {((sequence.split("").filter(c=>c==="G"||c==="C").length/sequence.length)*100).toFixed(1)}%</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight:600, color:"#f6f8fb" }}>Drop a FASTA file or click browse</div>
                    <div style={{ fontSize:12, marginTop:4 }}>Headers and sequences are parsed automatically</div>
                  </div>
                )}
              </div>

              {/* Sequence Display Panel */}
              {currentSequence && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={label13}>Live Sequence Map</span>
                    <span style={{ fontSize: 11, color: "#88a0b9" }}>
                      {sequenceMapTooLarge ? "Sequence too large to render per-base view" : "Hover base for details"}
                    </span>
                  </div>
                  {sequenceMapTooLarge ? (
                    <div style={{ padding: 16, textAlign: "center", color: "#88a0b9", fontSize: 12, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
                      Per-base rendering is disabled above 5,000 bp to avoid freezing the browser with tens of thousands of
                      DOM nodes. Use the variant log below, or the 🔍 jump links, to inspect specific positions.
                    </div>
                  ) : (
                    <div style={{
                      maxHeight: 180, overflowY: "auto", background: "rgba(4,17,31,0.95)", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10, padding: 12, fontFamily: "monospace", fontSize: 13, lineHeight: 1.8, wordBreak: "break-all"
                    }}>
                      {currentSequence.split("").map((base, idx) => {
                        const mut = mutationMap.get(idx);
                        const isMutated = Boolean(mut);
                        const bgColor = mut ? acmgColor(mut.pathogenicity.classification) : "transparent";
                        const textColor = mut ? "#04111f" : "#f6f8fb";
                        return (
                          <span
                            key={idx}
                            ref={el => { if (el) posRefs.current.set(idx, el); }}
                            title={mut ? `Pos ${idx + 1}: ${mut.original}→${mut.mutated} (${mut.pathogenicity.classification})` : `Pos ${idx + 1}: ${base}`}
                            style={{
                              backgroundColor: bgColor,
                              color: textColor,
                              fontWeight: isMutated ? 800 : 400,
                              padding: "1px 2px",
                              borderRadius: 2,
                              display: "inline-block",
                              cursor: isMutated ? "pointer" : "default",
                              transition: "all 0.2s ease"
                            }}
                          >
                            {base}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Optional genomic anchor */}
              <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <span style={label13}>Chromosome (optional, for gnomAD AF)</span>
                  <input type="text" placeholder="e.g. 7" value={params.genomicChrom} style={inputStyle}
                    onChange={e => setParams(p=>({...p,genomicChrom:e.target.value.trim()}))} />
                </div>
                <div>
                  <span style={label13}>Genomic strand</span>
                  <select value={params.genomicStrand} style={inputStyle}
                    onChange={e => setParams(p=>({...p,genomicStrand:e.target.value as "+"|"-"}))}>
                    <option value="+">+</option>
                    <option value="-">-</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop:8, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <span style={label13}>Genomic start position (GRCh38, optional)</span>
                  <input type="text" placeholder="e.g. 55019017" value={params.genomicStart} style={inputStyle}
                    onChange={e => setParams(p=>({...p,genomicStart:e.target.value.trim()}))} />
                </div>
                <div>
                  <span style={label13}>Genomic end position (GRCh38, optional)</span>
                  <input type="text" placeholder="e.g. 55021322" value={params.genomicEnd} style={inputStyle}
                    onChange={e => setParams(p=>({...p,genomicEnd:e.target.value.trim()}))} />
                </div>
              </div>
              {!hasGenomicAnchor && (
                <div style={{ fontSize:11, color:"#88a0b9", marginTop:6 }}>
                  Without a complete genomic range and strand, gnomAD AF can't be honestly looked up (requires genomic anchor)
                  — this tool won't guess. Start must always be the lower genomic coordinate and end the higher one (standard
                  Ensembl/RefSeq/UCSC convention) — strand alone indicates reading direction. Also assumes the uploaded
                  sequence is a single contiguous genomic span with no introns/splicing.
                </div>
              )}
            </div>

            {/* Generation trajectory */}
            <div style={card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <h2 style={{ margin:0, fontSize:18 }}>Generation trajectory</h2>
                <div style={{ color:"#66c2ff", fontWeight:600, fontSize:14 }}>{currentGen}/{params.numGenerations} gen</div>
              </div>
              <div style={{ height:220, background:"rgba(4,17,31,0.9)", borderRadius:12, border:"1px solid rgba(255,255,255,0.07)", padding:14, overflowY:"auto" }}>
                {genStats.length > 0 ? (
                  <div style={{ display:"grid", gap:10 }}>
                    {genStats.map(s => (
                      <div key={s.generation} style={{ display:"grid", gridTemplateColumns:"72px 1fr 80px 70px", alignItems:"center", gap:10 }}>
                        <div style={{ color:"#66c2ff", fontWeight:700, fontSize:13 }}>Gen {s.generation}</div>
                        <div style={{ height:8, borderRadius:4, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                          <div style={{ width:`${s.progress}%`, height:"100%", background:`linear-gradient(90deg,#66c2ff,${s.fitness>75?"#4ade80":"#ff6450"})`, borderRadius:4 }} />
                        </div>
                        <div style={{ fontSize:12, color:"#f6f8fb", textAlign:"right" }}>{s.fitness.toFixed(1)} fit</div>
                        <div style={{ fontSize:11, color: s.recurrentCount > 0 ? "#ffd166" : "#88a0b9" }}>
                          {s.recurrentCount > 0 ? `⟲ ×${s.recurrentCount}` : `+${s.mutationCount} mut`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"#88a0b9" }}>
                    Start a run to see the multi-generation fitness trajectory
                  </div>
                )}
              </div>
            </div>

            {/* Variant log with tabs */}
            <div style={card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ display:"flex", gap:6 }}>
                  {(["variants","recurrent","resistance","literature"] as const).map(t => (
                    <button key={t} style={{ ...chipCls(activeTab===t), padding:"5px 12px", fontSize:12 }} onClick={() => setActiveTab(t)}>
                      {t === "recurrent" ? `⟲ Recurrent (${recurrentMuts.length})` :
                       t === "resistance" ? `⚠ Resistance (${resistanceMuts.length})` :
                       t === "literature" ? `📄 Literature (${allLiterature.length})` : "Variants"}
                    </button>
                  ))}
                </div>
                {mutations.length > 0 && (
                  <button onClick={handleExport} style={{ padding:"7px 12px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:999, background:"transparent", color:"#f6f8fb", cursor:"pointer", fontSize:12, fontWeight:500 }}>
                    Export JSON
                  </button>
                )}
              </div>

              <div style={{ maxHeight:420, overflowY:"auto", display:"grid", gap:10 }}>
                {activeTab === "variants" && (mutations.length > 0 ? [...mutations].reverse().slice(0,8).map((m, i) => (
                  <div key={i} style={{ border:`1px solid rgba(255,255,255,0.07)`, borderRadius:12, padding:12, background: m.pathogenicity.score > 0.65 ? "rgba(255,100,80,0.07)" : m.pathogenicity.score > 0.40 ? "rgba(255,200,100,0.06)" : "rgba(255,255,255,0.02)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <div>
                        <strong style={{ color:"#66c2ff" }}>Gen {m.generation}</strong>
                        {m.positionStale ? (
                          <span style={{ color:"#88a0b9", fontSize:12, marginLeft:8 }} title="This site was later removed by an indel or deletion — no current base to jump to">
                            {m.type} · originally pos {m.position + 1} (site since deleted)
                          </span>
                        ) : (
                          <span
                            onClick={() => scrollToMutation(m)}
                            style={{ color:"#66c2ff", fontSize:12, marginLeft:8, cursor:"pointer", textDecoration:"underline" }}
                            title="Click to locate on sequence map"
                          >
                            {m.type} · pos {m.position + 1} 🔍
                          </span>
                        )}
                        {m.isRecurrent && <span style={{ marginLeft:8, fontSize:11, color:"#ffd166", fontWeight:600 }}>⟲ RECURRENT SITE</span>}
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, color: acmgColor(m.pathogenicity.classification), padding:"2px 8px", borderRadius:4, background:"rgba(0,0,0,0.3)" }}>
                        {m.pathogenicity.classification.replace("_"," ").toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize:13, marginBottom:4 }}>
                      <span style={{ color:"#88a0b9" }}>{m.original}→{m.mutated}</span>
                      {m.aminoAcidChange !== "synonymous" && m.aminoAcidChange !== "frameshift" && m.aminoAcidChange !== "CNV duplication" && m.aminoAcidChange !== "CNV deletion" &&
                        <span style={{ marginLeft:8, color:"#f6f8fb" }}>{m.aminoAcidChange}</span>}
                      <span style={{ marginLeft:8, fontSize:12, color:"#88a0b9" }}>{m.classification}</span>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, fontSize:11, color:"#88a0b9" }}>
                      <div>AM proxy: <strong style={{ color:"#f6f8fb" }}>{(m.pathogenicity.alphaMissense*100).toFixed(0)}%</strong></div>
                      <div>ESM1b proxy: <strong style={{ color:"#f6f8fb" }}>{(m.pathogenicity.esm1b*100).toFixed(0)}%</strong></div>
                      <div>Conservation: <strong style={{ color:"#f6f8fb" }}>{(m.conservation*100).toFixed(0)}%</strong></div>
                    </div>
                    {m.pathogenicity.clinvar && (
                      <div style={{ marginTop:6, fontSize:11, padding:"4px 8px", background:"rgba(102,194,255,0.08)", borderRadius:6 }}>
                        ClinVar #{m.pathogenicity.clinvar.id}: <strong>{m.pathogenicity.clinvar.significance}</strong> · {m.pathogenicity.clinvar.condition}
                      </div>
                    )}
                    {m.pathogenicity.uniprot && (
                      <div style={{ marginTop:6, fontSize:11, padding:"4px 8px", background:"rgba(102,194,255,0.08)", borderRadius:6 }}>
                        UniProt {m.pathogenicity.uniprot.accession}: {m.pathogenicity.uniprot.feature} — {m.pathogenicity.uniprot.description}
                      </div>
                    )}
                    {m.genomicCoordinate && (
                      <div style={{ marginTop:6, fontSize:11, padding:"4px 8px", background:"rgba(255,255,255,0.06)", borderRadius:6, color:"#88a0b9" }}>
                        Genomic coordinate: {m.genomicCoordinate}
                      </div>
                    )}
                    {m.pathogenicity.gnomad && (
                      <div style={{ marginTop:6, fontSize:11, padding:"4px 8px", background:"rgba(102,194,255,0.08)", borderRadius:6 }}>
                        gnomAD AF: {m.pathogenicity.gnomad.alleleFrequency ?? "N/A"} · popmax {m.pathogenicity.gnomad.popmax}
                      </div>
                    )}
                    {m.pathogenicity.evidence.slice(0,2).map((ev, j) => (
                      <div key={j} style={{ fontSize:11, color:"#88a0b9", marginTop:2 }}>• {ev}</div>
                    ))}
                  </div>
                )) : <div style={{ color:"#88a0b9", textAlign:"center", padding:"24px 0" }}>No mutations yet. Upload a FASTA and run the simulator.</div>)}

                {activeTab === "recurrent" && (recurrentMuts.length > 0 ? recurrentMuts.map((m, i) => (
                  <div key={i} style={{ ...infoBox, border:"1px solid rgba(255,209,102,0.2)" }}>
                    <div style={{ fontSize:12, color:"#ffd166", fontWeight:700, marginBottom:4 }}>⟲ Recurrent mutation — position {m.position+1}</div>
                    <div style={{ fontSize:13 }}>{m.original}→{m.mutated} · Gen {m.generation} · {m.classification}</div>
                    <div style={{ fontSize:11, color:"#88a0b9", marginTop:4 }}>
                      This position has been mutated to the same base more than once within this simulated lineage —
                      a mutational hotspot signature. (Note: this is distinct from convergent evolution, which refers to
                      independent lineages arriving at the same substitution — this simulator only ever runs one lineage.)
                    </div>
                  </div>
                )) : <div style={{ color:"#88a0b9", textAlign:"center", padding:"24px 0" }}>No recurrent mutations detected yet.</div>)}

                {activeTab === "resistance" && (resistanceMuts.length > 0 ? resistanceMuts.flatMap((m, i) =>
                  m.pathogenicity.drugResistance.map((dr, j) => (
                    <div key={`${i}-${j}`} style={{ ...infoBox, border:`1px solid ${dr.effect==="resistance"?"rgba(255,100,80,0.25)":"rgba(100,255,150,0.2)"}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{dr.drug}</div>
                        <span style={{ fontSize:11, fontWeight:700, color: dr.effect==="resistance"?"#ff6450":"#66e88a", padding:"2px 7px", borderRadius:4, background:"rgba(0,0,0,0.3)" }}>
                          {dr.effect.replace("_"," ").toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:"#88a0b9" }}>{dr.mechanism}</div>
                      <div style={{ fontSize:11, color:"#66c2ff", marginTop:4 }}>Evidence: {dr.evidence} · Variant: {m.aminoAcidChange}</div>
                    </div>
                  ))
                ) : <div style={{ color:"#88a0b9", textAlign:"center", padding:"24px 0" }}>No drug resistance mutations detected.</div>)}

                {activeTab === "literature" && (allLiterature.length > 0 ? allLiterature.map((ref, i) => (
                  <div key={i} style={infoBox}>
                    <div style={{ fontSize:12, color:"#66c2ff", marginBottom:2 }}>PMID {ref.pmid} · {ref.year}</div>
                    <div style={{ fontSize:13 }}>{ref.title}</div>
                    <div style={{ fontSize:11, color:"#88a0b9", marginTop:4 }}>Related to: {ref.mutation}</div>
                    <a href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#66c2ff", textDecoration:"none" }}>
                      → PubMed
                    </a>
                  </div>
                )) : <div style={{ color:"#88a0b9", textAlign:"center", padding:"24px 0" }}>Literature references appear here after missense/nonsense variants are detected and enriched via PubMed.</div>)}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display:"grid", gap:20 }}>
            {/* Parameters */}
            <div style={card}>
              <h2 style={{ margin:"0 0 14px", fontSize:18 }}>Simulation parameters</h2>
              <div style={{ display:"grid", gap:12, maxHeight:540, overflowY:"auto", paddingRight:4 }}>
                {/* Temperature */}
                <div>
                  <span style={label13}>Temperature</span>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" value={params.temperature} style={{ ...inputStyle, flex:1 }}
                      onChange={e => {
                        const v = +e.target.value;
                        const min = params.tempUnit==="F"?14:-10, max = params.tempUnit==="F"?212:100;
                        if (v<min||v>max) setErrors(p=>({...p,temperature:`${min}–${max}°${params.tempUnit}`}));
                        else { setErrors(p=>({...p,temperature:""})); setParams(p=>({...p,temperature:v})); }
                      }} />
                    <select value={params.tempUnit} style={{ ...inputStyle, width:70 }}
                      onChange={e => setParams(p=>({...p,tempUnit:e.target.value as "C"|"F"}))}>
                      <option value="C">°C</option><option value="F">°F</option>
                    </select>
                  </div>
                  {errors.temperature && <div style={{ fontSize:11, color:"#ff7b7b", marginTop:3 }}>Range: {errors.temperature}</div>}
                  <div style={{ fontSize:10, color:"#6b8299", marginTop:2 }}>Q10-style heuristic (~2x rate per 10°C) — not calibrated to a specific published mutation-rate dataset.</div>
                </div>

                {/* pH */}
                <div>
                  <span style={label13}>pH — {params.pH.toFixed(1)}
                    <span style={{ fontSize:10, color: params.pH<5.5?"#ffa550":params.pH>8.5?"#66c2ff":"#88a0b9", marginLeft:6 }}>
                      {params.pH<5.5?"Depurination (acid)":params.pH>8.5?"Deamination (alkaline)":"Physiological"}
                    </span>
                  </span>
                  <input type="range" min="0" max="14" step="0.1" value={params.pH} style={{ width:"100%" }}
                    onChange={e => setParams(p=>({...p,pH:+e.target.value}))} />
                  <div style={{ fontSize:10, color:"#6b8299", marginTop:2 }}>Simplified: real deamination kinetics are U-shaped across pH (accelerated at both extremes), not cleanly split by direction.</div>
                </div>

                {/* Mutation rate */}
                <div>
                  <span style={label13}>Base substitution rate · {params.substitutionRate.toExponential(1)}/site</span>
                  <input type="range" min="0.000001" max="0.001" step="0.000001" value={params.substitutionRate} style={{ width:"100%" }}
                    onChange={e => setParams(p=>({...p,substitutionRate:+e.target.value}))} />
                  <div style={{ fontSize:10, color:"#88a0b9", marginTop:2 }}>Scaled for simulation visibility. Biological: ~10⁻⁹/site/replication.</div>
                </div>

                {/* Generations */}
                <div>
                  <span style={label13}>Generation trajectory</span>
                  <div style={{ display:"flex", gap:6 }}>
                    {([10,50,100] as const).map(g => (
                      <button key={g} style={{ ...chipCls(params.numGenerations===g), flex:1 }}
                        onClick={() => setParams(p=>({...p,numGenerations:g}))}>
                        {g} gen
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed */}
                <div>
                  <span style={label13}>Simulation speed</span>
                  <div style={{ display:"flex", gap:6 }}>
                    {(["animated","fast","instant"] as const).map(s => (
                      <button key={s} style={{ ...chipCls(speed===s), flex:1, textTransform:"capitalize" }}
                        onClick={() => setSpeed(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nutrients / Oxygen */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <span style={label13}>Nutrients</span>
                    <select value={params.nutrients} style={inputStyle}
                      onChange={e => setParams(p=>({...p,nutrients:e.target.value}))}>
                      {["Low","Medium","High","Excess"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={label13}>Oxygen</span>
                    <select value={params.oxygen} style={inputStyle}
                      onChange={e => setParams(p=>({...p,oxygen:e.target.value}))}>
                      {["Anaerobic (None)","Low","Normal (21%)","High"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {/* UV exposure */}
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:params.uvExposure?6:0 }}>
                    <span style={{ fontSize:13, fontWeight:500 }}>UV exposure (CPD dimers)</span>
                    <input type="checkbox" checked={params.uvExposure}
                      onChange={e => setParams(p=>({...p,uvExposure:e.target.checked}))} style={{ cursor:"pointer" }} />
                  </div>
                  {params.uvExposure && (
                    <div>
                      <span style={{ fontSize:12, color:"#88a0b9" }}>Dose: {params.uvDose} J/m²</span>
                      <input type="range" min="1" max="100" step="1" value={params.uvDose} style={{ width:"100%", marginTop:4 }}
                        onChange={e => setParams(p=>({...p,uvDose:+e.target.value}))} />
                    </div>
                  )}
                </div>

                {/* Chemical mutagen */}
                <div>
                  <span style={label13}>Chemical mutagen</span>
                  <select value={params.mutagen} style={inputStyle}
                    onChange={e => setParams(p=>({...p,mutagen:e.target.value as typeof params.mutagen}))}>
                    <option value="None">None</option>
                    <option value="EMS">EMS — G→A (O6-ethylguanine)</option>
                    <option value="HNO2">HNO₂ — C→T, A→G (deamination)</option>
                    <option value="AFB1">Aflatoxin B1 — G→T (N7-Gua adduct)</option>
                    <option value="BaP">Benzo[a]pyrene — G→T/A at CpG</option>
                  </select>
                </div>

                {/* Seed */}
                <div>
                  <span style={label13}>Reproducibility seed</span>
                  <input type="number" value={params.seed} style={inputStyle}
                    onChange={e => setParams(p=>({...p,seed:+e.target.value}))} />
                  <div style={{ fontSize:10, color:"#88a0b9", marginTop:2 }}>Same seed + same params = identical run.</div>
                </div>
              </div>

              <div style={{ display:"flex", gap:10, marginTop:16 }}>
                <button onClick={handleStart} disabled={!sequence}
                  style={{ flex:1, border:"none", borderRadius:12, padding:"12px 14px", background: sequence?"#66c2ff":"rgba(102,194,255,0.2)", color: sequence?"#04111f":"#88a0b9", fontWeight:700, cursor: sequence?"pointer":"not-allowed", fontSize:14 }}>
                  {isRunning ? "⏸ Pause" : "▶ Start"}
                </button>
                <button onClick={()=>resetState()}
                  style={{ flex:1, border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"12px 14px", background:"rgba(255,255,255,0.03)", color:"#f6f8fb", fontWeight:700, cursor:"pointer", fontSize:14 }}>
                  ↺ Reset
                </button>
              </div>
            </div>

            {/* Fitness & scoring */}
            <div style={card}>
              <h2 style={{ margin:"0 0 14px", fontSize:18 }}>Fitness & scoring engines</h2>
              <div style={{ ...infoBox, textAlign:"center", marginBottom:12 }}>
                <div style={{ fontSize:30, fontWeight:800, color: fitness>75?"#66c2ff":fitness>50?"#ffd166":"#ff6450" }}>{fitness.toFixed(1)}</div>
                <div style={{ fontSize:12, color:"#88a0b9", marginTop:2 }}>Fitness — epistasis-weighted, conservation-scaled (unvalidated heuristic constants)</div>
              </div>
              <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.07)", marginBottom:12, overflow:"hidden" }}>
                <div style={{ width:`${fitness}%`, height:"100%", background:`linear-gradient(90deg,#ff6450,#ffd166,#66c2ff)`, borderRadius:3 }} />
              </div>

              {/* ACMG breakdown */}
              <div style={{ ...infoBox, marginBottom:8 }}>
                <div style={{ fontSize:12, color:"#88a0b9", marginBottom:6 }}>Variant classification tiers (proprietary heuristic — not an official ACMG or AlphaMissense mapping)</div>
                {(["pathogenic","likely_pathogenic","uncertain","likely_benign","benign"] as ACMGClass[]).map(cls => {
                  const count = mutations.filter(m=>m.pathogenicity.classification===cls).length;
                  return (
                    <div key={cls} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:acmgColor(cls), flexShrink:0 }} />
                      <div style={{ fontSize:12, color:"#f6f8fb", flex:1 }}>{cls.replace("_"," ")}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:acmgColor(cls) }}>{count}</div>
                    </div>
                  );
                })}
              </div>

              {/* Model scores for last mutation */}
              {mutations.length > 0 && (() => {
                const last = mutations[mutations.length - 1];
                return (
                  <div style={infoBox}>
                    <div style={{ fontSize:12, color:"#88a0b9", marginBottom:6 }}>Last variant — dual model scores (heuristic proxies, see disclosure above)</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:12 }}>
                      <div>
                        <div style={{ color:"#88a0b9" }}>AlphaMissense-style proxy</div>
                        <div style={{ fontSize:18, fontWeight:700, color: last.pathogenicity.alphaMissense>0.65?"#ff6450":"#66c2ff" }}>
                          {(last.pathogenicity.alphaMissense*100).toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <div style={{ color:"#88a0b9" }}>ESM1b-style proxy</div>
                        <div style={{ fontSize:18, fontWeight:700, color: last.pathogenicity.esm1b>0.65?"#ff6450":"#66c2ff" }}>
                          {(last.pathogenicity.esm1b*100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    {last.pathogenicity.drugResistance.length > 0 && (
                      <div style={{ marginTop:8, padding:"6px 8px", background:"rgba(255,100,80,0.1)", borderRadius:6, fontSize:11 }}>
                        ⚠ {last.pathogenicity.drugResistance[0].drug}: {last.pathogenicity.drugResistance[0].effect.replace("_"," ")}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Research context */}
            <div style={card}>
              <h2 style={{ margin:"0 0 14px", fontSize:18 }}>Research context</h2>
              <div style={{ display:"grid", gap:8 }}>
                {[
                  { label:"Evidence sources", value:"ClinVar · gnomAD (requires genomic anchor) · UniProt · PubMed (live API)" },
                  { label:"Scoring models", value:"AlphaMissense-style & ESM1b-style heuristic proxies (BLOSUM62 + conservation) — NOT live model inference" },
                  { label:"Resistance DB", value:"CARD · PharmGKB · DGIdb — a small curated subset, not a full database mirror" },
                  { label:"Ti/Tv ratio", value:`Observed: ${titvRatio} · Reference: ~2.0 genome-wide (coding regions often skew closer to ~3.0)` },
                  { label:"Recurrent mutation events", value:`${recurrentMuts.length} detected — same-site recurrence within this lineage, not convergent evolution` },
                  { label:"API status", value: apiLoading ? "Querying NCBI / gnomAD / UniProt…" : mutations.length > 0 ? "Enrichment complete" : "Awaiting variants" },
                ].map(row => (
                  <div key={row.label} style={infoBox}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{row.label}</div>
                    <div style={{ fontSize:11, color:"#88a0b9" }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

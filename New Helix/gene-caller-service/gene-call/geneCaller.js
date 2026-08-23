// geneCaller.js
// callBacterialGenes now runs REAL Prodigal via Docker (see runProdigalDocker
// below). callEukaryoticGenes is still a stub — AUGUSTUS integration is a
// separate, larger task (species parameter files, splice-aware parsing) —
// see the project notes for why that's sequenced after bacterial.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const util = require("util");
const execFileAsync = util.promisify(execFile);

const PRODIGAL_DOCKER_IMAGE = "staphb/prodigal:latest";

const CODON_TABLE = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L", CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M", GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S", CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T", GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*", CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K", GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W", CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R", GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

function reverseComplement(seq) {
  const comp = { A: "T", T: "A", C: "G", G: "C", N: "N" };
  return seq.split("").reverse().map((b) => comp[b] || "N").join("");
}

function translate(cds) {
  let protein = "";
  for (let i = 0; i + 3 <= cds.length; i += 3) {
    const aa = CODON_TABLE[cds.slice(i, i + 3)];
    if (!aa || aa === "*") break;
    protein += aa;
  }
  return protein;
}

/**
 * Runs the REAL Prodigal binary inside a Docker container.
 * -p meta: metagenomic mode — no training required, works on short/single
 * sequences (normal mode needs a long genome to build a training model first,
 * which a single test gene doesn't have enough data for).
 */
async function runProdigalDocker(sequence) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prodigal-"));
  const inputPath = path.join(tmpDir, "input.fasta");
  const proteinPath = path.join(tmpDir, "proteins.faa");

  fs.writeFileSync(inputPath, `>query\n${sequence}\n`);

  try {
    await execFileAsync("docker", [
      "run", "--rm",
      "-v", `${tmpDir}:/data`,
      PRODIGAL_DOCKER_IMAGE,
      "prodigal",
      "-i", "/data/input.fasta",
      "-a", "/data/proteins.faa",
      "-f", "gff",
      "-p", "meta",
    ]);
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (err.code === "ENOENT") {
      throw new Error("Docker not found. Install Docker Desktop and make sure it's running.");
    }
    throw new Error(`Prodigal (Docker) failed: ${err.message}`);
  }

  const proteinFasta = fs.existsSync(proteinPath) ? fs.readFileSync(proteinPath, "utf-8") : "";
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return parseProdigalFaa(proteinFasta, sequence);
}

/**
 * Parses Prodigal's .faa output. Header format per gene call looks like:
 *   >query_1 # 1 # 450 # 1 # ID=1_1;partial=00;start_type=ATG;...
 * Fields after the id: start # end # strand (1 = +, -1 = -) # metadata
 */
function parseProdigalFaa(proteinFasta, originalSequence) {
  const genes = [];
  const entries = proteinFasta.split(">").filter(Boolean);

  for (const entry of entries) {
    const lines = entry.split("\n");
    const header = lines[0];
    const protein = lines.slice(1).join("").replace(/\*$/, "").trim();
    const parts = header.split("#").map((p) => p.trim());
    if (parts.length < 4) continue;

    const start = parseInt(parts[1], 10);
    const end = parseInt(parts[2], 10);
    const strand = parts[3] === "1" ? "+" : "-";

    const rawCds = originalSequence.slice(start - 1, end);
    const cds = strand === "+" ? rawCds : reverseComplement(rawCds);

    genes.push({
      start,
      end,
      strand,
      cds,
      protein,
      confidence: "high", // real Prodigal call — validated gene-finding, not a heuristic
    });
  }

  return genes;
}

function callBacterialGenes(sequence) {
  return runProdigalDocker(sequence);
}

// TODO (real implementation): shell out to AUGUSTUS/GlimmerHMM with an
// appropriate species parameter set, parse predicted exons, splice them
// together into a CDS before translating. Mark confidence "low"/"medium"
// since ab initio eukaryotic calling is inherently less certain.
// Sequenced AFTER bacterial deliberately — see project notes.
function callEukaryoticGenes(sequence) {
  const start = sequence.indexOf("ATG");
  if (start === -1) return [];
  const cds = sequence.slice(start);
  const protein = translate(cds);
  return [
    {
      start: start + 1,
      end: start + protein.length * 3 + 3,
      strand: "+",
      cds: cds.slice(0, protein.length * 3 + 3),
      protein,
      confidence: "low", // stub for splice-aware calling — not real yet
    },
  ];
}

async function callGenes(sequence, domain) {
  if (domain === "bacterial") return callBacterialGenes(sequence);
  if (domain === "eukaryotic") return callEukaryoticGenes(sequence);
  // "unknown" — fall back to the same real Prodigal call, marked low confidence
  // since we don't actually know the domain is bacterial
  const genes = await callBacterialGenes(sequence);
  return genes.map((g) => ({ ...g, confidence: "low" }));
}

module.exports = { callGenes };
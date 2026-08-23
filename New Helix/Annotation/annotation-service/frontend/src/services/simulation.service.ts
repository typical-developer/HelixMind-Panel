import { readFile, readFileSync } from "node:fs";
import { parseFASTA } from "../utils/bioParsers.js";
import { createRNG } from "../utils/rng.js";
import { throw_custom_error } from "../utils/error.js";
import { FastaFiles } from "../infrastructure/db/Schema/FastaFiles.js";

// Helper: Classify if a mutation hits a Gene (CDS), Promoter, etc.
const classifyMutation = (position: number, annotations: any[]) => {
    // Requirements #1 & #2: Backend auto-detects coding regions
    const match = annotations.find(f => position >= f.start - 1 && position < f.end);
    return match 
        ? { feature: match.name, type: match.type, isCoding: match.type === "CDS" || match.type === "gene" }
        : { feature: "intergenic", type: "intergenic", isCoding: false };
};

export const detectMutations = (querySeq: string, refSeq: string) => {
    const mutations = [];
    // To Do
    // Basic alignment logic: Compare position by position
    // In a real scenario, use a library like 'bioseq' for Smith-Waterman alignment
    for (let i = 0; i < Math.max(querySeq.length, refSeq.length); i++) {
        if (querySeq[i] !== refSeq[i]) {
            mutations.push({
                pos: i + 1,
                ref: refSeq[i] || '-',
                alt: querySeq[i] || '-',
                type: !refSeq[i] ? 'insertion' : (!querySeq[i] ? 'deletion' : 'substitution')
            });
        }
    }
    return mutations;
};

export const runMutationSimulation = (params: any) => {
    const { sequence, seed, numGenerations, mutationRates, annotations = [] } = params;
    
    // Requirement #4: Input Validation Warnings
    const warnings: string[] = [];
    if (!sequence || sequence.length === 0) throw new Error("Empty sequence provided.");
    if (sequence.length < 200) warnings.push("Extremely short sequence (<200bp); simulation may be unstable.");
    const nRatio = (sequence.match(/N/g) || []).length / sequence.length;
    if (nRatio > 0.1) warnings.push("High 'N' count detected; results may be scientifically inaccurate.");

    const rng = createRNG(seed);
    const nucleotides = ['A', 'T', 'G', 'C'];
    
    const referenceSeq = sequence; // Fixed reference for comparison logic
    let workingSeq = sequence;
    const allMutations = [];
    const genStats = [];

    const { substitutionRate: sub, insertionRate: ins, deletionRate: del } = mutationRates;
    const totalRate = sub + ins + del;

    for (let gen = 0; gen < numGenerations; gen++) {
        let seqArray = workingSeq.split('');
        const mutationPositions = new Set<number>();
        // Poisson-like distribution for mutation counts per generation
        const expectedCount = Math.floor(seqArray.length * totalRate);

        for (let i = 0; i < expectedCount; i++) {
            mutationPositions.add(Math.floor(rng() * seqArray.length));
        }

        const sortedPos = Array.from(mutationPositions).sort((a, b) => a - b);
        let offset = 0;
        let genMutationCount = 0;

        for (const basePos of sortedPos) {
            let pos = basePos + offset;
            if (pos < 0 || pos >= seqArray.length) continue;

            const r = rng();
            const normalized = totalRate > 0 ? r / totalRate : 0;
            
            let type: 'substitution' | 'insertion' | 'deletion' = 'substitution';
            if (normalized > (sub / totalRate)) {
                type = normalized > (sub + ins) / totalRate ? 'deletion' : 'insertion';
            }

            const classification = classifyMutation(basePos, annotations);

            if (classification.type === 'substitution') {
                const originalBase = seqArray[pos];
                const others = nucleotides.filter(n => n !== originalBase);
                seqArray[pos] = others[Math.floor(rng() * 3)];
                
                // Track Mutation vs Reference (Requirement #1)
                allMutations.push({
                    generation: gen + 1,
                    position: basePos + 1,
                    change: `${originalBase}→${seqArray[pos]}`,
                    ...classification
                });
            } 
            else if (classification.type === 'insertion') {
                const newBase = nucleotides[Math.floor(rng() * 4)];
                seqArray.splice(pos, 0, newBase);
                offset++;
                allMutations.push({
                    generation: gen + 1,
                    position: basePos + 1,
                    change: `+${newBase}`,
                    ...classification
                });
            } 
            else if (classification.type === 'deletion') {
                const deletedBase = seqArray[pos];
                seqArray.splice(pos, 1);
                offset--;
                allMutations.push({
                    generation: gen + 1,
                    position: basePos + 1,
                    change: `-${deletedBase}`,
                    ...classification
                });
            }
            genMutationCount++;
        }

        workingSeq = seqArray.join('');

        // Requirement #5: Export Stats (JSON)
        genStats.push({
            generation: gen + 1,
            populationSize: workingSeq.length,
            mutationCount: genMutationCount,
            codingDensity: annotations.length > 0 ? (allMutations.filter(m => m.isCoding).length / (allMutations.length || 1)) : 0
        });
    }

    return { 
        referenceSeq: referenceSeq.substring(0, 100) + "...", 
        currentSeq: workingSeq, 
        mutationLog: allMutations,
        stats: genStats,
        warnings,
        summary: {
            totalMutations: allMutations.length,
            finalLength: workingSeq.length,
            avgMutationsPerGen: (allMutations.length / numGenerations).toFixed(2)
        }
    };
};

export async function parseFASTAService(fasta_files: Express.Multer.File[], user_id: string, shouldSave: boolean = true) {
    if (!fasta_files || fasta_files.length <= 0) {
        throw new Error("Custom Error: No fasta passed")
    }

    const fasta_outputs: {
        sequences: Record<string, string>;
        count: number;
    }[] = [];

    const fasta_promises = fasta_files.map(async (fasta_file) => {
        const fasta = fasta_file.path;

        const fasta_txt = await readFileSync(fasta, "utf-8");

        const response = parseFASTA(fasta_txt)

        fasta_outputs.push({
            sequences: response,
            count: Object.keys(response).length
        });
    });

    await Promise.all(fasta_promises);

    const filePaths = fasta_files.map((fasta_file) => { return {
        file: fasta_file.path,
        user_id
    } });

    const new_fastas = await FastaFiles.bulkCreate(filePaths);

    return fasta_outputs;
}

// Standard Genetic Code for synonymous mutation checking
export const CODON_MAP: Record<string, string> = {
    'ATA':'I', 'ATC':'I', 'ATT':'I', 'ATG':'M', 'ACA':'T', 'ACC':'T', 'ACG':'T', 'ACT':'T',
    'AAC':'N', 'AAT':'N', 'AAA':'K', 'AAG':'K', 'AGC':'S', 'AGT':'S', 'AGA':'R', 'AGG':'R',
    'CTA':'L', 'CTC':'L', 'CTG':'L', 'CTT':'L', 'CCA':'P', 'CCC':'P', 'CCG':'P', 'CCT':'P',
    'CAC':'H', 'CAT':'H', 'CAA':'Q', 'CAG':'Q', 'CGA':'R', 'CGC':'R', 'CGG':'R', 'CGT':'R',
    'GTA':'V', 'GTC':'V', 'GTG':'V', 'GTT':'V', 'GCA':'A', 'GCC':'A', 'GCG':'A', 'GCT':'A',
    'GAC':'D', 'GAT':'D', 'GAA':'E', 'GAG':'E', 'GGA':'G', 'GGC':'G', 'GGG':'G', 'GGT':'G',
    'TCA':'S', 'TCC':'S', 'TCG':'S', 'TCT':'S', 'TTC':'F', 'TTT':'F', 'TTA':'L', 'TTG':'L',
    'TAC':'Y', 'TAT':'Y', 'TAA':'', 'TAG':'', 'TGC':'C', 'TGT':'C', 'TGA':'_', 'TGG':'W',
};

export class SeededRandom {
    private seed: number = 0;

    constructor(seed: number) { this.seed = seed; }

    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// 1. IMPROVED FITNESS: Checks for Synonymous vs Missense
export const calculateFitness = (seq: string, mutations: {type: "substitution" | "insertion" | "deletion", context: "coding" | "non-coding", aminoAcidChange: string}[]) => {
    let fitness = 100;
    
    mutations.forEach(m => {
        if (m.type === 'substitution' && m.context === 'coding') {
            // Non-synonymous (Missense) is penalized, Synonymous (Silent) is not
            if (m.aminoAcidChange && m.aminoAcidChange !== 'none') fitness -= 1.5;
        } else if (m.type === 'insertion' || m.type === 'deletion') {
            // Frameshifts are devastating
            fitness -= 10.0;
        }
    });

    // Penalize stop codons
    const stopCodons = ['TAA', 'TAG', 'TGA'];
    for (let i = 0; i < seq.length - 2; i += 3) {
        if (stopCodons.includes(seq.substr(i, 3))) fitness -= 5;
    }
    return Math.max(0, fitness);
};

// 2. KIMURA 2-PARAMETER MODEL: Transitions vs Transversions
export const getMutatedBase = (original: string, rng: SeededRandom) => {
    const transitions: Record<string, string> = { 'A': 'G', 'G': 'A', 'C': 'T', 'T': 'C' };
    const transversions: Record<string, string[]> = { 
        'A': ['C', 'T'], 'G': ['C', 'T'], 'C': ['A', 'G'], 'T': ['A', 'G'] 
    };
    
    // Transitions are statistically ~2x more likely in nature
    if (rng.next() < 0.66) { 
        return transitions[original];
    } else {
        const choices = transversions[original];
        return choices[Math.floor(rng.next() * choices.length)];
    }
};
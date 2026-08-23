import { Request, Response } from "express";
import {
  detectMutations,
  parseFASTAService,
} from "../services/simulation.service.js";
import { ResponseSchema } from "../types/index.js";
import {
  calculateFitness,
  CODON_MAP,
  getMutatedBase,
  SeededRandom,
} from "../services/simulation.service.js";
import { FastaFiles } from "../infrastructure/db/Schema/FastaFiles.js";
import { readFileSync } from "node:fs";
import { FastaFileInstance } from "../types/fastas.type.js";
import { parseFASTA } from "../utils/bioParsers.js";
import path from "node:path";

// 1. FASTA Parser Controller
export const parseFastaController = async (req: Request, res: Response) => {
  let fasta_files = req.files as Express.Multer.File[];
  let user_id = req.headers.user_id as string;

  if (!user_id) {
    return res.status(401).json({
      status: "error",
      error: "Unauthorized request",
    } as ResponseSchema);
  }

  const fasta_outputs = await parseFASTAService(fasta_files, user_id);

  res.status(200).json({
    status: "success",
    payload: fasta_outputs,
  } as ResponseSchema);
};

// 2. GFF Parser Controller
export const parseGffController = async (req: Request, res: Response) => {
  console.log(req.files, req.file);
  // const { content } = req.body;
  // if (!content) return res.status(400).json({ error: "No GFF content provided" });

  // const features = parseGFF(content);
  // res.json({
  //     features,
  //     count: features.length
  // });

  res.status(200).json({
    respponse: "Testing",
  });
};

// 3. Simulation Engine Controller
export const simulateController = async (req: Request, res: Response) => {
  try {
    let fasta_files = req.files as Express.Multer.File[];
    let user_id = req.headers.user_id as string;

    if (!user_id) {
      return res.status(401).json({
        status: "error",
        error: "Unauthorized request",
      } as ResponseSchema);
    }

    const fasta_outputs = await parseFASTAService(fasta_files, user_id);

    const sequence = Object.values(fasta_outputs[0].sequences)[0];

    // console.log(sequence);

    let { params } = req.body;
    params = JSON.parse(params);

    const rng = new SeededRandom(params.seed || Date.now());

    // 3. ENVIRONMENTAL LINKAGE: Temperature affects mutation rate (Arrhenius-like scaling)
    const tempCelsius =
      params.tempUnit === "F"
        ? ((params.temperature - 32) * 5) / 9
        : params.temperature;
    const tempFactor = Math.pow(1.1, (tempCelsius - 37) / 5);
    const effectiveSubRate = params.substitutionRate * tempFactor;

    let currentSeq = sequence;
    const allMutations: {
      generation: number;
      position: number;
      type: "insertion" | "deletion" | "substitution";
      original: any;
      mutated: string;
      aminoAcidChange: string;
      context: "coding" | "non-coding";
    }[] = [];
    const fitnessHistory = [];

    for (let gen = 1; gen <= params.numGenerations; gen++) {
      console.log("In here");
      const seqArray = currentSeq.split("");

      for (let i = 0; i < currentSeq.length; i++) {
        if (rng.next() < effectiveSubRate) {
          const originalBase = seqArray[i];
          const newBase = getMutatedBase(originalBase, rng);

          // Determine Amino Acid Change
          let aaChange = "none";
          const codonStart = Math.floor(i / 3) * 3;
          const originalCodon: string = currentSeq.substr(codonStart, 3);
          if (originalCodon.length === 3) {
            const tempCodon = originalCodon.split("");
            tempCodon[i % 3] = newBase;
            const newCodon: string = tempCodon.join("");
            if (CODON_MAP[originalCodon] !== CODON_MAP[newCodon]) {
              aaChange = `${CODON_MAP[originalCodon]}->${CODON_MAP[newCodon]}`;
            }
          }

          seqArray[i] = newBase;
          allMutations.push({
            generation: gen,
            position: i,
            type: "substitution",
            original: originalBase,
            mutated: newBase,
            aminoAcidChange: aaChange,
            context: i < currentSeq.length - 100 ? "coding" : "non-coding",
          });
        }
      }
      currentSeq = seqArray.join("");
      fitnessHistory.push({
        generation: gen,
        fitness: calculateFitness(currentSeq, allMutations),
      });
    }

    console.log({
      finalSequence: currentSeq,
      mutations: allMutations,
      fitnessHistory,
      hotspots: [], // logic remains the same as previous
    });

    res.json({
      status: "success",
      payload: {
        finalSequence: currentSeq,
        mutations: allMutations,
        fitnessHistory,
        hotspots: [], // logic remains the same as previous
      },
    } as ResponseSchema);
  } catch (error: any) {
    res.status(500).json({ error: `Simulation failed: ${error.message}` });
  }
};

export const checkMutation = async (req: Request, res: Response) => {
  let user_id = req.headers.user_id as string;

  if (!user_id) {
    return res.status(401).json({
      status: "error",
      error: "Unauthorized request",
    } as ResponseSchema);
  }

  const files = req.files as
    | {
        ref_fasta_files: Express.Multer.File[];
        query_fasta_files: Express.Multer.File[];
      }
    | undefined;

  const ref_fasta_files = files!.ref_fasta_files;
  const query_fasta_files = files!.query_fasta_files;

  if (
    !ref_fasta_files ||
    ref_fasta_files.length <= 0 ||
    !query_fasta_files ||
    query_fasta_files.length <= 0
  ) {
    res.status(400).json({
      status: "error",
      error:
        "Missing required fasta file inputs: please provide both reference and query files.",
    } as ResponseSchema);
    return;
  }

  const { seq_id } = req.body;

  if (!seq_id) {
    return res.status(400).json({
      status: "error",
      error:
        "Please provide the sequence ID (header) you wish to analyze from the query file.",
    });
  }

  const ref_seq = Object.values(
    (await parseFASTAService(ref_fasta_files, user_id))[0].sequences
  )[0];

  if (!ref_seq) {
    res.status(422).json({
      status: "error",
      error:
        "Invalid input, no sequence could be read from the reference fasta file",
    } as ResponseSchema);
    return;
  }

  const query_seq = (await parseFASTAService(query_fasta_files, user_id))[0]
    .sequences[seq_id];

  if (!query_seq) {
    res.status(422).json({
      status: "error",
      error:
        "Invalid input, no sequence could be found for the desired sequece id in the query fasta file passed",
    } as ResponseSchema);
    return;
  }

  console.log("Query Seq:", ref_seq, "Ref Seq:", query_seq);

  const response = detectMutations(query_seq, ref_seq);

  console.log(response);

  res.status(200).json({
    status: "success",
    payload: response,
  } as ResponseSchema);
};

export const previouslyReadFastas = async (req: Request, res: Response) => {
  let user_id = req.headers.user_id as string;

  if (!user_id) {
    return res.status(401).json({
      status: "error",
      error: "Unauthorized request",
    } as ResponseSchema);
  }

  const fasta_files = (await FastaFiles.findAll({
    where: {
      user_id,
    },
    order: [["createdAt", "DESC"]], // Here is your requested Order By
  })) as unknown as FastaFileInstance[];

  return res.status(200).json({
    status: "success",
    payload: fasta_files.map(fasta_file => {
      return { fasta_id: fasta_file.id, user_id: "", file: fasta_file.file.replaceAll(path.resolve(process.cwd(), "src/uploads/fastas/"), ""), createdAt: fasta_file.createdAt}
    }) 
  } as ResponseSchema)
};

export const previoslyReadFasta = async (req: Request, res: Response) => {
  const { fasta_id } = req.params as Record<string, string>;

  if (fasta_id.trim().length <= 0) {
    return res.status(400).json({
      status: "error",
      error: "No fasta file id passed to read from",
    } as ResponseSchema);
  }

  let user_id = req.headers.user_id as string;

  if (!user_id) {
    return res.status(401).json({
      status: "error",
      error: "Unauthorized request",
    } as ResponseSchema);
  }

  const fasta_file = (await FastaFiles.findOne({
    where: {
      user_id,
      id: fasta_id,
    },
    order: [["createdAt", "DESC"]], // Here is your requested Order By
  })) as unknown as FastaFileInstance;

  if (!fasta_file) {
    return res.status(404).json({
      status: "error",
      error: "No fasta file found",
    } as ResponseSchema);
  }

  try {
    const file = await readFileSync(fasta_file.file as string, "utf-8");

    const fasta_outputs: {
      sequences: Record<string, string>;
      count: number;
    }[] = [];

    const response = parseFASTA(file);

    fasta_outputs.push({
      sequences: response,
      count: Object.keys(response).length,
    });

    return fasta_outputs;
  } catch (error) {
    return res.status(404).json({
      status: "error",
      error: "Fasta file no longer exists",
    } as ResponseSchema);
  }
};

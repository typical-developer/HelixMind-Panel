import { Router } from 'express';
import { checkMutation, parseFastaController, parseGffController, previoslyReadFasta, previouslyReadFastas, simulateController } from '../controller/fastas.controller.js';
import { uploadFasta } from '../middlewares/upload.middleware.js';

const fastaRouters = Router();

// Endpoint 1: Convert FASTA text to JSON
fastaRouters.post("/parse-fasta", uploadFasta.array("fasta-file", 5), parseFastaController);

// Endpoint 2: Convert GFF text to JSON features
fastaRouters.post("/parse-gff", uploadFasta.array("fasta-file", 5), parseGffController);

fastaRouters.post("/check-mutation", checkMutation);

// Gets
fastaRouters.get("/fastas", previouslyReadFastas);

fastaRouters.get("/fasta/:fasta_id", previoslyReadFasta);

export {fastaRouters};
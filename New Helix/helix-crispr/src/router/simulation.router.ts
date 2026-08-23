import { Router } from "express";
import { uploadFasta } from "../middlewares/upload.middleware.js";
import { simulateController } from "../controller/fastas.controller.js";

const simRouter = Router();

// Endpoint 3: Run the heavy lifting simulation
simRouter.post("/simulate", uploadFasta.array("fasta-file", 5), simulateController);

export {simRouter};
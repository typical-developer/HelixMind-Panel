// server.js
// Standalone gene-caller service. Zero knowledge of HelixMind/React —
// on purpose, so it can be built and tested in isolation, then wired
// into DNAScanner later as a single fetch() call.

const express = require("express");
const cors = require("cors");
const { callGenes } = require("./geneCaller");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // sequences can be long

const VALID_DOMAINS = ["bacterial", "eukaryotic", "unknown"];

app.post("/call-genes", async (req, res) => {
  const { sequence, domain } = req.body || {};

  if (!sequence || typeof sequence !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'sequence' (expected string)." });
  }
  if (!domain || !VALID_DOMAINS.includes(domain)) {
    return res.status(400).json({
      error: `Missing or invalid 'domain'. Expected one of: ${VALID_DOMAINS.join(", ")}.`,
    });
  }

  try {
    const genes = await callGenes(sequence.toUpperCase().replace(/\s/g, ""), domain);
    const toolUsed =
      domain === "bacterial" ? "prodigal (stub)" :
      domain === "eukaryotic" ? "augustus (stub)" :
      "prodigal-fallback (stub)"; // "unknown" domain actually runs the bacterial heuristic internally
    res.json({ domain, tool: toolUsed, genes });
  } catch (err) {
    console.error("Gene calling failed:", err);
    res.status(500).json({ error: "Gene calling failed internally. See server logs." });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4500;
app.listen(PORT, () => {
  console.log(`Gene caller service (stub) running at http://localhost:${PORT}`);
  console.log(`Test with: POST http://localhost:${PORT}/call-genes`);
});
"""
HelixMind — Anomaly Scoring Engine
backend/core/scoring.py

Three anomaly classes:
  Class A — Statistical (GC content, CAI codon adaptation, sequence complexity)
  Class B — Resistance pattern rarity (BV-BRC derived co-occurrence matrix)
  Class C — Mobile genetic element signatures (IS elements, integrons)

Scientific basis:
  GC content:    NCBI genome statistics per species
  CAI:           Sharp & Li 1987, species-specific RSCU tables
  Co-occurrence: BV-BRC/PATRIC AMR phenotype database (build with scripts/build_cooccurrence_matrix.py)
  MGE:           ISfinder database conserved sequences
"""

import json
import logging
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Severity thresholds
# ---------------------------------------------------------------------------

SEVERITY_THRESHOLDS = {
    "HIGH":   0.75,
    "MEDIUM": 0.40,
    "LOW":    0.15,
}

# ---------------------------------------------------------------------------
# GC content baselines
# Source: NCBI genome statistics, computed from complete genomes
# ---------------------------------------------------------------------------

GC_BASELINES = {
    "escherichia coli":            {"mean": 0.508, "sd": 0.012},
    "klebsiella pneumoniae":       {"mean": 0.571, "sd": 0.011},
    "staphylococcus aureus":       {"mean": 0.328, "sd": 0.009},
    "mycobacterium tuberculosis":  {"mean": 0.655, "sd": 0.008},
    "salmonella":                  {"mean": 0.520, "sd": 0.011},
    "pseudomonas aeruginosa":      {"mean": 0.666, "sd": 0.013},
    "acinetobacter baumannii":     {"mean": 0.390, "sd": 0.015},
    "campylobacter jejuni":        {"mean": 0.306, "sd": 0.010},
    "helicobacter pylori":         {"mean": 0.385, "sd": 0.012},
    "neisseria gonorrhoeae":       {"mean": 0.525, "sd": 0.009},
    "enterococcus faecalis":       {"mean": 0.374, "sd": 0.010},
    "enterococcus faecium":        {"mean": 0.381, "sd": 0.011},
    "default":                     {"mean": 0.500, "sd": 0.020},
}

# ---------------------------------------------------------------------------
# MGE signatures — conserved sequences from ISfinder database
# ---------------------------------------------------------------------------

MGE_SIGNATURES = {
    "IS1":        r"TGATAATCT.{8,12}TGATGATCT",
    "IS3":        r"AGTTGTGGA.{6,10}TCCACAACT",
    "IS26":       r"TGGAAACGA.{6,10}TCGTTTCCA",
    "IS6100":     r"GCAAAGCCC.{6,10}GGGCTTTGC",
    "Tn3":        r"TGATAATCT.{8,16}TGGATAATCT",
    "Tn10":       r"CTGACTCTT.{8,12}AAGAGTCAG",
    "IntI1":      r"GCCATGGAG.{10,20}CTCGATCCC",
    "IntI2":      r"TTTATTTGA.{10,20}TCAAATAAA",
    "ISCR1":      r"GAAGCCGAT.{8,12}ATCGGCTTC",
    "oriT_IncF":  r"GCGCAACGA.{6,10}TCGTTGCGC",
    "oriT_IncI":  r"TGTGGATCC.{6,10}GGATCCACA",
}


# ---------------------------------------------------------------------------
# Data loaders — load from files built by setup scripts
# ---------------------------------------------------------------------------

def _load_cooccurrence_matrix() -> dict:
    """Load BV-BRC derived co-occurrence matrix. Falls back to empty dict."""
    matrix_file = DATA_DIR / "cooccurrence_matrix.json"
    if matrix_file.exists():
        try:
            data = json.loads(matrix_file.read_text())
            raw  = data.get("matrix", {})
            # Convert to frozenset-keyed dict for O(1) lookup
            return {
                frozenset({v["class_a"], v["class_b"]}): v["prevalence"]
                for v in raw.values()
                if "class_a" in v and "class_b" in v
            }
        except Exception as e:
            logger.warning("Failed to load co-occurrence matrix: %s", e)
    else:
        logger.warning(
            "Co-occurrence matrix not found at %s. "
            "Run: python3 scripts/build_cooccurrence_matrix.py",
            matrix_file,
        )
    return {}


def _load_cai_weights(organism: Optional[str]) -> dict:
    """Load CAI weights for an organism. Falls back to E. coli."""
    cai_file = DATA_DIR / "codon_usage_tables.json"
    if not cai_file.exists():
        logger.warning(
            "CAI tables not found at %s. "
            "Run: python3 scripts/build_cai_tables.py",
            cai_file,
        )
        return {}

    try:
        data     = json.loads(cai_file.read_text())
        orgs     = data.get("organisms", {})
        key      = (organism or "").lower()
        org_data = orgs.get(key) or orgs.get("default") or {}
        return org_data.get("cai_weights", {})
    except Exception as e:
        logger.warning("Failed to load CAI weights: %s", e)
        return {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def score_sequence(
    sequence: str,
    hits: list[dict],
    organism: Optional[str] = None,
) -> dict:
    """
    Run all anomaly scorers. Returns a structured anomaly report.
    All scorers are non-fatal — failures return NONE severity.
    """
    flags = []
    seq   = sequence.upper()

    # Load reference data
    cooccurrence = _load_cooccurrence_matrix()
    cai_weights  = _load_cai_weights(organism)

    # Class A — Statistical
    flags.append(_gc_content_anomaly(seq, organism))
    flags.append(_cai_anomaly(seq, cai_weights, organism))
    flags.append(_sequence_complexity_anomaly(seq))

    # Class B — Resistance pattern rarity
    if hits and cooccurrence:
        flags.extend(_resistance_cooccurrence_anomalies(hits, cooccurrence))
    elif hits and not cooccurrence:
        logger.info("Skipping co-occurrence scoring — matrix not built yet")

    # Class C — Mobile genetic elements
    flags.extend(_mge_signature_scan(seq))

    flagged   = [f for f in flags if f["flagged"]]
    composite = _composite_score(flags)
    severity  = _severity_label(composite)

    return {
        "anomaly_score":    round(composite, 4),
        "anomaly_severity": severity,
        "flags":            flagged,
        "all_checks":       len(flags),
        "flagged_checks":   len(flagged),
        "summary":          _build_summary(flagged, composite, severity),
    }


# ---------------------------------------------------------------------------
# Class A — Statistical anomalies
# ---------------------------------------------------------------------------

def _gc_content_anomaly(seq: str, organism: Optional[str] = None) -> dict:
    """
    Z-score based GC content anomaly using species-specific mean and SD.
    Flags sequences >2 SD from species mean.
    Source: NCBI genome statistics.
    """
    gc       = (seq.count("G") + seq.count("C")) / len(seq) if seq else 0.0
    key      = (organism or "").lower()
    baseline = GC_BASELINES.get(key, GC_BASELINES["default"])
    mean, sd = baseline["mean"], baseline["sd"]

    z_score  = abs(gc - mean) / sd if sd > 0 else 0.0
    score    = min(z_score / 4.0, 1.0)   # normalize: z=4 -> score=1.0
    flagged  = z_score > 2.0             # flag at >2 SD (p<0.05)

    direction = "high" if gc > mean else "low"

    return _flag(
        type_="gc_content",
        score=score,
        flagged=flagged,
        detail=(
            f"GC content {gc*100:.1f}% deviates {z_score:.1f} SD from "
            f"{organism or 'reference'} mean ({mean*100:.1f}% ± {sd*100:.1f}%). "
            f"Unusually {direction} GC suggests potential horizontal gene transfer."
        ) if flagged else (
            f"GC content {gc*100:.1f}% within expected range "
            f"({mean*100:.1f}% ± {sd*100:.1f}% for {organism or 'reference'})."
        ),
        evidence={
            "observed_gc": round(gc, 4),
            "expected_mean": mean,
            "expected_sd": sd,
            "z_score": round(z_score, 3),
            "direction": direction,
        },
    )


def _cai_anomaly(seq: str, cai_weights: dict, organism: Optional[str] = None) -> dict:
    """
    Codon Adaptation Index (CAI) anomaly detection.
    Low CAI indicates sequence is not optimized for the host — potential HGT.
    Method: Sharp & Li 1987 (Nucleic Acids Res. 15(3):1281-95)
    """
    if not cai_weights:
        return _flag(
            "codon_adaptation_index", 0.0, False,
            "CAI reference tables not loaded — run build_cai_tables.py.",
            {"cai": None, "status": "tables_missing"},
        )

    codons = [seq[i:i+3] for i in range(0, len(seq) - 2, 3)
              if len(seq[i:i+3]) == 3 and seq[i:i+3] not in ("TAA", "TAG", "TGA")]

    if len(codons) < 50:
        return _flag("codon_adaptation_index", 0.0, False,
                     "Sequence too short for CAI analysis (need ≥150 bp).",
                     {"cai": None, "codon_count": len(codons)})

    # CAI = geometric mean of per-codon weights
    log_sum = sum(
        math.log(cai_weights.get(codon, 0.5))   # 0.5 for unknown codons
        for codon in codons
    )
    cai = math.exp(log_sum / len(codons))

    # CAI thresholds:
    # >0.8: highly adapted (endogenous gene)
    # 0.6-0.8: moderately adapted
    # <0.6: poorly adapted (potentially foreign)
    score   = max(0.0, (0.70 - cai) / 0.30)   # score rises as CAI drops below 0.70
    score   = min(score, 1.0)
    flagged = cai < 0.60

    return _flag(
        type_="codon_adaptation_index",
        score=score,
        flagged=flagged,
        detail=(
            f"CAI score {cai:.3f} is below threshold (0.60) for "
            f"{organism or 'reference organism'}. "
            f"Low CAI indicates this sequence may not be optimized for the host — "
            f"consistent with horizontal gene transfer from a different species."
        ) if flagged else (
            f"CAI score {cai:.3f} indicates sequence is reasonably adapted "
            f"to {organism or 'reference organism'} codon usage."
        ),
        evidence={
            "cai":         round(cai, 4),
            "threshold":   0.60,
            "codon_count": len(codons),
            "reference":   "Sharp & Li 1987",
        },
    )


def _sequence_complexity_anomaly(seq: str) -> dict:
    """
    DUST-inspired low complexity detection.
    Flags homopolymers (8+ bp) and simple tandem repeats.
    Low complexity regions near resistance genes indicate recombination hotspots.
    """
    homopolymers = re.findall(r"([ATCG])\1{7,}", seq)
    tandems      = re.findall(r"([ATCG]{2,4})\1{4,}", seq)
    total        = len(homopolymers) + len(tandems)
    score        = min(total / 5.0, 1.0)
    flagged      = total >= 2

    return _flag(
        type_="sequence_complexity",
        score=score,
        flagged=flagged,
        detail=(
            f"Low complexity: {len(homopolymers)} homopolymer run(s), "
            f"{len(tandems)} tandem repeat(s). "
            f"Low complexity flanking resistance genes is associated with "
            f"recombination hotspots and genomic instability."
        ) if flagged else "Sequence complexity within normal range.",
        evidence={
            "homopolymer_runs": len(homopolymers),
            "tandem_repeats":   len(tandems),
        },
    )


# ---------------------------------------------------------------------------
# Class B — Resistance co-occurrence rarity
# ---------------------------------------------------------------------------

def _resistance_cooccurrence_anomalies(
    hits: list[dict],
    cooccurrence: dict,
) -> list[dict]:
    """
    Flag unusual resistance class combinations using BV-BRC derived
    co-occurrence frequencies from clinical isolates.
    Pairs with <5% prevalence are flagged.
    """
    flags = []

    classes = sorted({
        cls.strip()
        for hit in hits
        for cls in hit.get("resistance_class", "").split(",")
        if cls.strip() and cls.strip() not in ("Unknown", "")
    })

    if len(classes) < 2:
        return flags

    for i in range(len(classes)):
        for j in range(i + 1, len(classes)):
            cls_a, cls_b = classes[i], classes[j]
            pair         = frozenset({cls_a, cls_b})
            prevalence   = cooccurrence.get(pair)

            if prevalence is None:
                score, flagged = 0.70, True
                detail = (
                    f"Co-occurrence of {cls_a} + {cls_b} resistance not present "
                    f"in BV-BRC reference data — potentially novel combination. "
                    f"Verify against current literature."
                )
                evidence = {"pair": [cls_a, cls_b], "prevalence": None,
                            "status": "not_in_reference", "source": "BV-BRC"}

            elif prevalence < 0.05:
                score   = min((0.05 - prevalence) / 0.05, 1.0)
                flagged = True
                detail  = (
                    f"Rare co-occurrence: {cls_a} + {cls_b} found together in "
                    f"{prevalence*100:.2f}% of {cooccurrence.get('total_genomes', 'reference')} "
                    f"BV-BRC clinical isolates. May indicate acquisition of multiple resistance elements."
                )
                evidence = {"pair": [cls_a, cls_b], "prevalence": prevalence,
                            "status": "rare", "source": "BV-BRC"}

            else:
                score, flagged = 0.0, False
                detail  = (
                    f"{cls_a} + {cls_b} co-occurrence is common in clinical isolates "
                    f"({prevalence*100:.1f}% of BV-BRC genomes)."
                )
                evidence = {"pair": [cls_a, cls_b], "prevalence": prevalence,
                            "status": "common", "source": "BV-BRC"}

            flags.append(_flag(
                type_=f"cooccurrence_{cls_a}_{cls_b}".replace(" ", "_").replace("-", "_"),
                score=score,
                flagged=flagged,
                detail=detail,
                evidence=evidence,
            ))

    return flags


# ---------------------------------------------------------------------------
# Class C — Mobile genetic elements
# ---------------------------------------------------------------------------

def _mge_signature_scan(seq: str) -> list[dict]:
    """
    Scan for ISfinder-derived conserved sequences flanking mobile elements.
    Resistance genes flanked by IS elements / integrons are likely transferable.
    Source: ISfinder database (https://isfinder.biotoul.fr/)
    """
    found = []
    for mge_name, pattern in MGE_SIGNATURES.items():
        try:
            if re.search(pattern, seq):
                found.append(mge_name)
        except re.error:
            continue

    score   = min(len(found) / 3.0, 1.0)
    flagged = len(found) > 0

    return [_flag(
        type_="mobile_genetic_elements",
        score=score,
        flagged=flagged,
        detail=(
            f"MGE signatures detected: {', '.join(found)}. "
            f"Resistance genes flanked by mobile elements are candidates for "
            f"horizontal transfer. Consider plasmid profiling."
        ) if flagged else "No mobile genetic element signatures detected.",
        evidence={
            "elements_found": found,
            "count":          len(found),
            "source":         "ISfinder database",
        },
    )]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _flag(type_: str, score: float, flagged: bool, detail: str, evidence: dict) -> dict:
    return {
        "type":     type_,
        "severity": _severity_label(score) if flagged else "NONE",
        "score":    round(score, 4),
        "flagged":  flagged,
        "detail":   detail,
        "evidence": evidence,
    }


def _severity_label(score: float) -> str:
    if score >= SEVERITY_THRESHOLDS["HIGH"]:   return "HIGH"
    if score >= SEVERITY_THRESHOLDS["MEDIUM"]: return "MEDIUM"
    if score >= SEVERITY_THRESHOLDS["LOW"]:    return "LOW"
    return "NONE"


def _composite_score(flags: list[dict]) -> float:
    if not flags:
        return 0.0
    weights      = [f["score"] * (2.0 if f["flagged"] else 0.5) for f in flags]
    total_weight = sum(2.0 if f["flagged"] else 0.5 for f in flags)
    return min(sum(weights) / total_weight, 1.0) if total_weight > 0 else 0.0


def _build_summary(flagged: list[dict], composite: float, severity: str) -> str:
    if not flagged:
        return "No anomalies detected. Sequence patterns within expected ranges."
    types = [f["type"].replace("_", " ") for f in flagged]
    return (
        f"{severity} anomaly score ({composite:.2f}). "
        f"{len(flagged)} flag(s): {', '.join(types)}. "
        f"Review flagged regions before clinical interpretation."
    )
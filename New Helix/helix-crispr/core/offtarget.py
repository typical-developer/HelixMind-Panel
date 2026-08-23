"""
Off-target risk assessment for CRISPR guide RNAs.

Two tiers:
  Tier 1 — Heuristic (instant, no external calls)
    Seed region GC, homopolymers, sequence complexity, self-complementarity
    Use: pre-filter before showing results

  Tier 2 — CRISPOR API (async, ~10–20s per guide)
    Submits to crispor.tefor.net, parses MIT specificity score + off-target counts
    Use: for top-ranked guides that pass Tier 1
    Note: Replace with local Bowtie2 + hg38 index in production v2

CFD (Cutting Frequency Determination) scoring based on:
  Doench et al. 2016, Nature Biotechnology
"""

import re
import hashlib
import requests
from .pam import reverse_complement


# ── CFD mismatch penalty matrix ───────────────────────────────────────────────
# Source: Doench et al. 2016 (Supplementary Table 19)
# Key: "rN:dN" where rN = RNA base, dN = DNA base at mismatch position
# Value: fraction of on-target activity retained
CFD_MISMATCH_PENALTIES: dict[str, float] = {
    "rA:dA": 0.0,  "rA:dC": 0.0,  "rA:dG": 0.0,   # A mismatches
    "rC:dA": 0.0,  "rC:dC": 0.0,  "rC:dT": 0.0,   # C mismatches
    "rG:dA": 0.100,"rG:dC": 0.100,"rG:dT": 0.100, # G mismatches
    "rU:dA": 0.067,"rU:dC": 0.250,"rU:dG": 0.100, # U (T in guide) mismatches
}

# Position-based weights: PAM-proximal positions penalised more
# Index 0 = PAM-distal (position 1), index 19 = PAM-proximal (position 20)
CFD_POSITION_WEIGHTS = [
    0.000, 0.000, 0.014, 0.000, 0.000,   # pos 1-5
    0.395, 0.317, 0.000, 0.389, 0.079,   # pos 6-10
    0.445, 0.508, 0.613, 0.851, 0.732,   # pos 11-15
    0.828, 0.615, 0.804, 0.685, 0.583,   # pos 16-20 (PAM-proximal)
]


def calculate_cfd_score(guide: str, offtarget: str) -> float:
    """
    Calculate CFD score for a guide vs off-target sequence.
    Both should be 20nt, same orientation.
    Returns 0.0–1.0 (1.0 = perfect match = maximum cutting).
    """
    if len(guide) != 20 or len(offtarget) != 20:
        return 0.0

    score = 1.0
    for i, (g, t) in enumerate(zip(guide.upper(), offtarget.upper())):
        if g != t:
            # Convert DNA guide base to RNA equivalent
            rna_base = g.replace('T', 'U')
            key = f"r{rna_base}:d{t}"
            penalty = CFD_MISMATCH_PENALTIES.get(key, 0.0)
            position_weight = CFD_POSITION_WEIGHTS[i]
            score *= (1.0 - position_weight * (1.0 - penalty))

    return round(score, 4)


def heuristic_offtarget(guide_seq: str) -> dict:
    """
    Tier 1: instant heuristic risk assessment.
    No network calls. Based on sequence composition.
    """
    seq  = guide_seq.upper()
    seed = seq[-12:]  # PAM-proximal seed region

    seed_gc = (seed.count('G') + seed.count('C')) / len(seed)
    total_gc = (seq.count('G') + seq.count('C')) / len(seq)

    # Repetitiveness — low complexity = more likely to find matches genome-wide
    dinucs = [seq[i:i+2] for i in range(len(seq)-1)]
    complexity = len(set(dinucs)) / len(dinucs) if dinucs else 1.0

    # Homopolymer stretches
    has_homopolymer = any(nuc * 4 in seq for nuc in "ACGT")

    # Seed region GC drives off-target binding
    seed_gc_risk = seed_gc > 0.70

    # Low complexity = more repetitive = more off-target sites
    complexity_risk = complexity < 0.50

    # Risk scoring
    risk_score = 0
    if seed_gc_risk:      risk_score += 3
    if has_homopolymer:   risk_score += 2
    if complexity_risk:   risk_score += 2
    if total_gc > 0.75:   risk_score += 1

    risk_label = "HIGH" if risk_score >= 4 else "MEDIUM" if risk_score >= 2 else "LOW"

    return {
        "tier":              "heuristic",
        "risk_level":        risk_label,
        "risk_score":        risk_score,
        "seed_gc":           round(seed_gc, 3),
        "seed_gc_risk":      seed_gc_risk,
        "sequence_complexity": round(complexity, 3),
        "has_homopolymer":   has_homopolymer,
        "total_gc":          round(total_gc, 3),
        "note": (
            "Heuristic estimate only. "
            "Submit top guides for full genome alignment."
        ),
    }


def crispor_offtarget(guide_seq: str, genome: str = "hg38", timeout: int = 25) -> dict:
    """
    Tier 2: CRISPOR public API off-target analysis.
    Submits guide + NGG PAM to crispor.tefor.net and parses result.
    Returns MIT specificity score and off-target counts by mismatch count.

    Args:
        guide_seq: 20nt guide sequence (no PAM)
        genome: reference genome — hg38, mm10, dm6, ce11, etc.
        timeout: request timeout in seconds

    Returns dict with mit_score, offtarget_counts, raw_hits list
    """
    CRISPOR_URL = "https://crispor.tefor.net/crispor.py"

    # CRISPOR expects guide + PAM in the sequence field
    submission_seq = guide_seq.upper() + "NGG"

    try:
        # Step 1: Submit
        resp = requests.post(
            CRISPOR_URL,
            data={
                "seq":     submission_seq,
                "org":     genome,
                "pam":     "NGG",
                "batchId": "",
            },
            timeout=timeout,
            headers={"User-Agent": "HelixMind-CRISPR/1.0"},
        )
        resp.raise_for_status()
        html = resp.text

        # Step 2: Parse MIT specificity score
        mit_match = re.search(
            r'MIT Specificity Score[^\d]*(\d+(?:\.\d+)?)',
            html,
            re.IGNORECASE,
        )
        mit_score = float(mit_match.group(1)) if mit_match else None

        # Step 3: Parse off-target counts per mismatch level
        # CRISPOR shows "X off-targets with N mismatches"
        ot_pattern = re.findall(
            r'(\d+)\s+off.target[s]?\s+with\s+(\d+)\s+mismatch',
            html,
            re.IGNORECASE,
        )
        offtarget_counts = {
            f"{mm}_mismatch": int(count)
            for count, mm in ot_pattern
        }

        # Step 4: Parse individual hits if available
        hit_pattern = re.findall(
            r'([A-Za-z0-9_.]+):(\d+)[^\t]*\t([ACGT]+)\t(\d+)\smm',
            html,
        )
        raw_hits = [
            {
                "locus":      f"{chrom}:{pos}",
                "sequence":   seq_hit,
                "mismatches": int(mm),
                "cfd_score":  calculate_cfd_score(guide_seq, seq_hit),
            }
            for chrom, pos, seq_hit, mm in hit_pattern[:20]  # cap at 20 hits
        ]

        # Annotate risk
        total_ots = sum(offtarget_counts.values())
        if total_ots == 0:
            risk_level = "LOW"
        elif total_ots <= 5:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        return {
            "tier":             "crispor_api",
            "genome":           genome,
            "mit_score":        mit_score,
            "mit_risk":         _mit_risk(mit_score),
            "offtarget_counts": offtarget_counts,
            "total_offtargets": total_ots,
            "risk_level":       risk_level,
            "top_hits":         sorted(raw_hits, key=lambda x: x["cfd_score"], reverse=True),
            "source":           "crispor.tefor.net",
        }

    except requests.Timeout:
        return {
            "tier":    "crispor_api",
            "status":  "timeout",
            "message": "CRISPOR request timed out. Try again or use local Bowtie2.",
        }
    except requests.RequestException as e:
        return {
            "tier":    "crispor_api",
            "status":  "error",
            "message": str(e),
        }


def _mit_risk(mit_score: float | None) -> str:
    """Interpret MIT specificity score (0–100, higher = more specific = lower risk)."""
    if mit_score is None:
        return "UNKNOWN"
    if mit_score >= 80:
        return "LOW"
    if mit_score >= 50:
        return "MEDIUM"
    return "HIGH"
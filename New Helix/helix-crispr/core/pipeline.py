"""
HelixMind CRISPR Design Pipeline
Orchestrates: guide extraction → scoring → off-target → PAM landscape
"""

from .pam import extract_guides, get_pam_landscape, PAM_CONFIG
from .scoring import score_guide
from .offtarget import heuristic_offtarget, crispor_offtarget


def run_crispr_pipeline(
    sequence: str,
    cas_variant: str = "SpCas9",
    top_n: int = 10,
    guide_length: int = 20,
    offtarget_tier: str = "heuristic",   # "heuristic" | "crispor" | "none"
    genome: str = "hg38",
) -> dict:
    """
    Full CRISPR guide design pipeline.

    Args:
        sequence:       Input DNA sequence (FASTA or raw)
        cas_variant:    SpCas9 | SaCas9 | AsCas12a | LbCas12a | Cas13d
        top_n:          Number of top guides to return
        guide_length:   Guide RNA length (default 20nt)
        offtarget_tier: Level of off-target analysis
        genome:         Reference genome for CRISPOR tier

    Returns:
        Full result dict ready for API response
    """

    # ── 1. Validate inputs ────────────────────────────────────────────────
    if cas_variant not in PAM_CONFIG:
        return {
            "error": f"Unknown variant '{cas_variant}'. "
                     f"Supported: {list(PAM_CONFIG.keys())}"
        }

    if len(sequence.strip()) < 23:
        return {
            "error": "Sequence too short. Minimum 23nt required for guide design."
        }

    if len(sequence) > 50_000:
        return {
            "error": "Sequence exceeds 50kb limit. Split into smaller segments."
        }

    # ── 2. Extract all candidate guides ──────────────────────────────────
    try:
        candidates = extract_guides(sequence, cas_variant, guide_length)
    except ValueError as e:
        return {"error": str(e)}

    if not candidates:
        return {
            "error": (
                f"No valid PAM sites found for {cas_variant} in this sequence. "
                f"Try a different Cas variant or a longer input sequence."
            ),
            "pam_landscape": get_pam_landscape(sequence),
        }

    # ── 3. Score all candidates ───────────────────────────────────────────
    scored = [score_guide(g) for g in candidates]

    # ── 4. Split passing vs filtered ─────────────────────────────────────
    passing = [g for g in scored if g["passes_filter"]]
    filtered_out = [g for g in scored if not g["passes_filter"]]

    if not passing:
        # Return all with scores but note they all failed filters
        passing = scored
        filter_warning = (
            "All candidates failed quality filters. "
            "Showing unfiltered results — review flags carefully."
        )
    else:
        filter_warning = None

    # ── 5. Rank by CRISPRscan score ───────────────────────────────────────
    ranked = sorted(passing, key=lambda x: x["crisprscan"], reverse=True)
    top = ranked[:top_n]

    # ── 6. Off-target analysis on top guides ─────────────────────────────
    for guide in top:
        if offtarget_tier == "none":
            guide["offtarget"] = {"tier": "skipped"}

        elif offtarget_tier == "heuristic":
            guide["offtarget"] = heuristic_offtarget(guide["guide"])

        elif offtarget_tier == "crispor":
            # Heuristic first for instant display, then CRISPOR enriches it
            guide["offtarget"] = heuristic_offtarget(guide["guide"])
            if guide["offtarget"]["risk_level"] != "HIGH":
                # Only submit non-obvious guides to CRISPOR
                crispor_result = crispor_offtarget(guide["guide"], genome)
                if crispor_result.get("status") != "error":
                    guide["offtarget"].update(crispor_result)

    # ── 7. PAM landscape ──────────────────────────────────────────────────
    pam_landscape = get_pam_landscape(sequence)

    # ── 8. Summary statistics ─────────────────────────────────────────────
    scores = [g["crisprscan"] for g in passing]
    top_scores = [g["crisprscan"] for g in top]

    summary = {
        "total_candidates": len(candidates),
        "passing_filters":  len(passing),
        "filtered_out":     len(filtered_out),
        "score_mean":       round(sum(scores) / len(scores), 4) if scores else 0,
        "score_max":        round(max(scores), 4) if scores else 0,
        "score_min":        round(min(scores), 4) if scores else 0,
        "top_score":        round(top_scores[0], 4) if top_scores else 0,
        "grade_distribution": _grade_distribution(passing),
        "filter_warning":   filter_warning,
    }

    return {
        "cas_variant":    cas_variant,
        "input_length":   len(sequence.strip()),
        "guide_length":   guide_length,
        "genome":         genome,
        "offtarget_tier": offtarget_tier,
        "summary":        summary,
        "top_guides":     top,
        "all_guides":     ranked,          # full ranked list for frontend table
        "pam_landscape":  pam_landscape,
    }


def _grade_distribution(guides: list[dict]) -> dict:
    dist = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for g in guides:
        grade = g.get("grade", "D")
        dist[grade] = dist.get(grade, 0) + 1
    return dist
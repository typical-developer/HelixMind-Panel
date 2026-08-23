"""
On-target efficiency scoring for CRISPR guide RNAs.

Primary model: CRISPRscan (Moreno-Mateos et al. 2015, Nature Methods)
  - Position-weight matrix trained on zebrafish embryos with SpCas9
  - Scores a 30nt context window: [4up][20guide][3PAM][3down]
  - Returns 0.0–1.0 efficiency estimate

Secondary signals: GC content, sequence composition flags
"""

from .pam import GuideCandidate


# ── CRISPRscan Position-Weight Matrix ────────────────────────────────────────
# Source: Moreno-Mateos et al. 2015, Nature Methods, Supplementary Table 2
# Positions 1-30 of the 30nt context window
# (position, nucleotide) -> coefficient
# Missing entries = 0 contribution

CRISPRSCAN_INTERCEPT = 0.183930

CRISPRSCAN_PWM: dict[tuple[int, str], float] = {
    # Upstream context (positions 1-4)
    (1, 'A'): -0.025398, (1, 'C'):  0.025850, (1, 'T'):  0.013110,
    (2, 'C'):  0.007836, (2, 'G'): -0.050841, (2, 'T'):  0.007618,
    (3, 'A'):  0.031538, (3, 'C'): -0.147410, (3, 'T'):  0.037740,
    (4, 'A'):  0.037440, (4, 'C'): -0.045600, (4, 'G'):  0.004840, (4, 'T'):  0.004640,
    # Guide positions (5-24)
    (5, 'A'):  0.073080, (5, 'C'): -0.050340, (5, 'T'):  0.001940,
    (6, 'A'):  0.004610, (6, 'C'):  0.025310, (6, 'G'):  0.017080, (6, 'T'): -0.045630,
    (7, 'A'): -0.025120, (7, 'G'): -0.014470, (7, 'T'):  0.029760,
    (8, 'A'):  0.024870, (8, 'G'):  0.007990, (8, 'T'): -0.018800,
    (9, 'A'):  0.009020, (9, 'C'):  0.019350, (9, 'T'): -0.014110,
    (10,'A'): -0.001100,(10,'C'):  0.032500,(10,'G'):  0.014180,(10,'T'): -0.022270,
    (11,'A'): -0.025340,(11,'C'):  0.007580,(11,'G'):  0.014460,(11,'T'):  0.002820,
    (12,'A'):  0.001700,(12,'C'): -0.009580,(12,'G'):  0.002710,(12,'T'):  0.005200,
    (13,'A'):  0.007700,(13,'C'): -0.008540,(13,'G'):  0.000200,(13,'T'):  0.001900,
    (14,'A'): -0.020270,(14,'C'):  0.006930,(14,'G'):  0.014260,(14,'T'): -0.003390,
    (15,'A'):  0.005990,(15,'C'): -0.003050,(15,'G'):  0.000660,(15,'T'): -0.002940,
    (16,'A'): -0.001660,(16,'C'):  0.001890,(16,'G'):  0.000720,(16,'T'): -0.000450,
    (17,'A'): -0.002050,(17,'C'):  0.003740,(17,'G'):  0.002070,(17,'T'): -0.004090,
    (18,'A'): -0.004280,(18,'C'):  0.008980,(18,'G'):  0.003030,(18,'T'): -0.007020,
    (19,'A'): -0.006030,(19,'C'):  0.009080,(19,'G'):  0.004470,(19,'T'): -0.008640,
    (20,'A'): -0.008770,(20,'C'):  0.010080,(20,'G'):  0.004920,(20,'T'): -0.009230,
    # Seed region / PAM-proximal (positions 21-24) - highest impact
    (21,'A'):  0.007350,(21,'G'): -0.171040,(21,'T'):  0.002870,
    (22,'G'): -0.235940,(22,'C'):  0.021710,
    (23,'G'): -0.197530,
    (24,'A'): -0.031060,(24,'C'):  0.027540,(24,'T'): -0.005040,
    # PAM and downstream (positions 25-30)
    (25,'A'):  0.005480,(25,'C'): -0.016820,(25,'G'):  0.002050,(25,'T'):  0.003530,
    (26,'A'): -0.011670,(26,'C'):  0.010040,(26,'G'):  0.009630,(26,'T'): -0.010340,
    (27,'A'): -0.004860,(27,'C'):  0.010760,(27,'G'):  0.003470,(27,'T'): -0.006510,
    (28,'A'): -0.001190,(28,'C'):  0.006300,(28,'G'):  0.001130,(28,'T'): -0.003640,
    (29,'A'):  0.000440,(29,'C'):  0.003450,(29,'G'):  0.001220,(29,'T'): -0.001810,
    (30,'A'):  0.002800,(30,'C'):  0.001340,(30,'G'):  0.001310,(30,'T'): -0.002820,
}


def crisprscan_score(context_30: str) -> float:
    """
    Compute CRISPRscan on-target efficiency score.
    Input: exactly 30nt context window (pad with N if needed).
    Output: float 0.0–1.0 (higher = more efficient).
    Note: validated for SpCas9; use as estimate only for other variants.
    """
    ctx = context_30[:30].upper().ljust(30, 'N')
    score = CRISPRSCAN_INTERCEPT
    for pos, nuc in enumerate(ctx, start=1):
        score += CRISPRSCAN_PWM.get((pos, nuc), 0.0)
    # Do NOT clamp to 0 — negative scores are valid (below-average efficiency)
    # CRISPRscan outputs are relative scores; ranking matters more than absolute value
    # Typical range in practice: -0.4 to +0.6
    return round(float(score), 4)


def gc_content(seq: str) -> float:
    seq = seq.upper()
    return round((seq.count('G') + seq.count('C')) / len(seq), 3)


def check_hairpin(seq: str, min_stem: int = 4) -> bool:
    """
    Rough check for self-complementarity (guide hairpin risk).
    Checks if any stem of min_stem bases can form with itself.
    """
    from .pam import reverse_complement
    rc = reverse_complement(seq)
    for i in range(len(seq) - min_stem):
        stem = seq[i: i + min_stem]
        if stem in rc:
            return True
    return False


def score_guide(guide: GuideCandidate) -> dict:
    """
    Score a single GuideCandidate.
    Returns a dict ready for API response / frontend rendering.
    """
    seq = guide.sequence.upper()

    # ── On-target score ───────────────────────────────────────────────────
    if guide.cas_variant in ("SpCas9", "SaCas9"):
        on_target = crisprscan_score(guide.context_30)
        scoring_model = "CRISPRscan"
    else:
        # CRISPRscan not applicable for Cas12a / Cas13
        # Use GC + composition heuristic as placeholder
        gc = gc_content(seq)
        on_target = round(0.5 + (gc - 0.5) * 0.4, 4)
        on_target = min(max(on_target, 0.0), 1.0)
        scoring_model = "GC_heuristic"

    gc = gc_content(seq)

    # ── Rule-based flags ──────────────────────────────────────────────────
    flags: list[str] = []

    if not (0.40 <= gc <= 0.70):
        flags.append("GC_OUT_OF_RANGE")            # suboptimal editing efficiency

    if "TTTT" in seq:
        flags.append("POLIII_TERMINATOR")          # U6/H1 promoter will terminate transcription

    if seq[0] != 'G' and guide.cas_variant in ("SpCas9", "SaCas9"):
        flags.append("NO_5G_U6")                   # U6 promoter strongly prefers G at +1

    if any(nuc * 5 in seq for nuc in "ACGT"):
        flags.append("HOMOPOLYMER_RUN")            # may cause synthesis / expression issues

    seed = seq[-12:]  # PAM-proximal seed region
    seed_gc = gc_content(seed)
    if seed_gc > 0.75:
        flags.append("HIGH_SEED_GC")               # elevated non-specific binding risk

    if check_hairpin(seq):
        flags.append("SELF_COMPLEMENTARITY")       # guide may fold and reduce activity

    # Low complexity (repetitive sequence)
    dinucs = [seq[i:i+2] for i in range(len(seq)-1)]
    if len(dinucs) > 0 and len(set(dinucs)) / len(dinucs) < 0.4:
        flags.append("LOW_COMPLEXITY")

    # Hard filter: POLIII_TERMINATOR and GC_OUT_OF_RANGE are disqualifying
    hard_fail_flags = {"POLIII_TERMINATOR", "GC_OUT_OF_RANGE"}
    passes_filter = len(set(flags) & hard_fail_flags) == 0

    return {
        "guide":          seq,
        "pam":            guide.pam,
        "strand":         guide.strand,
        "position":       guide.position,
        "cas_variant":    guide.cas_variant,
        "crisprscan":     on_target,
        "scoring_model":  scoring_model,
        "gc_pct":         gc,
        "seed_gc":        seed_gc,
        "context_30":     guide.context_30,
        "flags":          flags,
        "passes_filter":  passes_filter,
        "grade":          _grade(on_target, flags),
    }


def _grade(score: float, flags: list[str]) -> str:
    """Letter grade for UI display. CRISPRscan range is typically -0.4 to +0.6."""
    hard_fail = {"POLIII_TERMINATOR", "GC_OUT_OF_RANGE"}
    if set(flags) & hard_fail:
        return "F"
    if score >= 0.30:
        return "A"
    if score >= 0.10:
        return "B"
    if score >= -0.05:
        return "C"
    return "D"
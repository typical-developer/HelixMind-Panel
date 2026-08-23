import re
from dataclasses import dataclass, field


@dataclass
class GuideCandidate:
    sequence: str        # 20nt protospacer
    pam: str             # PAM sequence
    strand: str          # '+' or '-'
    position: int        # 0-based position on input sequence
    context_30: str      # 4up + 20guide + 3PAM + 3down = 30nt for CRISPRscan
    cas_variant: str
    guide_length: int = 20


# PAM configuration per Cas variant
# pattern: regex to match PAM
# side: whether PAM is 3' or 5' of protospacer
# pam_len: length of PAM sequence
PAM_CONFIG = {
    "SpCas9":   {"pattern": r"[ACGT]GG",       "side": "3prime", "pam_len": 3},
    "SaCas9":   {"pattern": r"[ACGT]GAAA[TG]", "side": "3prime", "pam_len": 6},
    "AsCas12a": {"pattern": r"TTT[ACGT]",       "side": "5prime", "pam_len": 4},
    "LbCas12a": {"pattern": r"TTT[ACGT]",       "side": "5prime", "pam_len": 4},
    "Cas13d":   {"pattern": None,               "side": "none",   "pam_len": 0},
}

IUPAC = {
    'R': '[AG]', 'Y': '[CT]', 'S': '[GC]', 'W': '[AT]',
    'K': '[GT]', 'M': '[AC]', 'B': '[CGT]', 'D': '[AGT]',
    'H': '[ACT]', 'V': '[ACG]', 'N': '[ACGT]',
}


def reverse_complement(seq: str) -> str:
    comp = str.maketrans("ACGTacgt", "TGCAtgca")
    return seq.translate(comp)[::-1]


def sanitize_sequence(seq: str) -> str:
    """
    Strip whitespace, newlines, numbers (FASTA format).
    Expand IUPAC ambiguity codes.
    Raise on invalid characters.
    """
    seq = seq.upper().strip()
    # Remove FASTA header line if present
    if seq.startswith(">"):
        lines = seq.split("\n")
        seq = "".join(lines[1:])
    # Remove whitespace and digits
    seq = re.sub(r"[\s\d]", "", seq)
    # Reject U (RNA) - convert to T
    seq = seq.replace("U", "T")
    # Validate
    valid = set("ACGTNRYSWKMBDHV")
    invalid = set(seq) - valid
    if invalid:
        raise ValueError(f"Invalid characters in sequence: {invalid}")
    return seq


def build_context_30(s: str, guide_start: int, guide_len: int, pam_side: str, pam_len: int) -> str:
    """
    Build 30nt context window for CRISPRscan:
      3prime PAM: [4nt upstream][20nt guide][3nt PAM][3nt downstream]
      5prime PAM: [4nt upstream][4nt PAM][20nt guide][3nt downstream] -- still 30nt window
    Returns left-padded/right-padded with 'N' if sequence runs out.
    """
    if pam_side == "3prime":
        start = guide_start - 4
        end   = guide_start + guide_len + pam_len + 3
    else:
        # For 5prime PAM (Cas12a), context starts at PAM
        start = guide_start - pam_len - 4
        end   = guide_start + guide_len + 3

    left_pad  = max(0, -start)
    right_pad = max(0, end - len(s))
    start     = max(0, start)
    end       = min(len(s), end)

    ctx = ("N" * left_pad) + s[start:end] + ("N" * right_pad)
    return ctx[:30].ljust(30, "N")


def extract_guides(
    sequence: str,
    cas_variant: str,
    guide_len: int = 20
) -> list[GuideCandidate]:
    """
    Extract all valid guide RNA candidates from a DNA sequence.
    Scans both strands. Returns list of GuideCandidate objects.
    """
    if cas_variant not in PAM_CONFIG:
        raise ValueError(
            f"Unknown Cas variant '{cas_variant}'. "
            f"Supported: {list(PAM_CONFIG.keys())}"
        )

    seq    = sanitize_sequence(sequence)
    config = PAM_CONFIG[cas_variant]
    candidates: list[GuideCandidate] = []

    # ── Cas13: no PAM, tile every position on + strand only ──────────────
    if config["pattern"] is None:
        for i in range(len(seq) - guide_len + 1):
            guide_seq = seq[i: i + guide_len]
            # Skip guides with >4 consecutive T (Pol III terminator)
            if "TTTTT" in guide_seq:
                continue
            ctx = build_context_30(seq, i, guide_len, "3prime", 0)
            candidates.append(GuideCandidate(
                sequence=guide_seq,
                pam="N/A",
                strand="+",
                position=i,
                context_30=ctx,
                cas_variant=cas_variant,
                guide_length=guide_len,
            ))
        return candidates

    pam_len  = config["pam_len"]
    pam_side = config["side"]
    pattern  = re.compile(config["pattern"])

    # ── Scan both strands ─────────────────────────────────────────────────
    for strand, s in [("+", seq), ("-", reverse_complement(seq))]:
        if pam_side == "3prime":
            # Guide comes first, then PAM
            # Need guide_len + pam_len chars minimum
            for i in range(len(s) - guide_len - pam_len + 1):
                pam_seq = s[i + guide_len: i + guide_len + pam_len]
                if pattern.fullmatch(pam_seq):
                    guide_seq = s[i: i + guide_len]
                    # Skip guides with N (ambiguous bases)
                    if "N" in guide_seq:
                        continue
                    ctx = build_context_30(s, i, guide_len, pam_side, pam_len)
                    # Map position back to original + strand
                    if strand == "+":
                        orig_pos = i
                    else:
                        orig_pos = len(seq) - i - guide_len
                    candidates.append(GuideCandidate(
                        sequence=guide_seq,
                        pam=pam_seq,
                        strand=strand,
                        position=orig_pos,
                        context_30=ctx,
                        cas_variant=cas_variant,
                        guide_length=guide_len,
                    ))

        else:
            # PAM comes first (Cas12a), then guide
            for i in range(len(s) - pam_len - guide_len + 1):
                pam_seq = s[i: i + pam_len]
                if pattern.fullmatch(pam_seq):
                    guide_seq = s[i + pam_len: i + pam_len + guide_len]
                    if "N" in guide_seq:
                        continue
                    ctx = build_context_30(s, i + pam_len, guide_len, pam_side, pam_len)
                    if strand == "+":
                        orig_pos = i + pam_len
                    else:
                        orig_pos = len(seq) - i - pam_len - guide_len
                    candidates.append(GuideCandidate(
                        sequence=guide_seq,
                        pam=pam_seq,
                        strand=strand,
                        position=orig_pos,
                        context_30=ctx,
                        cas_variant=cas_variant,
                        guide_length=guide_len,
                    ))

    return candidates


def get_pam_landscape(sequence: str) -> dict:
    """
    Count how many valid PAM sites exist for each Cas variant.
    Used for 'which Cas tool should I use for this target?' UI.
    """
    seq = sanitize_sequence(sequence)
    landscape = {}

    for variant, config in PAM_CONFIG.items():
        if config["pattern"] is None:
            landscape[variant] = {
                "count": "N/A",
                "note": "No PAM required (RNA-targeting)",
                "coverage_pct": 100.0,
            }
            continue

        pattern  = re.compile(config["pattern"])
        pam_len  = config["pam_len"]
        rc_seq   = reverse_complement(seq)
        fwd_hits = len(pattern.findall(seq))
        rev_hits = len(pattern.findall(rc_seq))
        total    = fwd_hits + rev_hits
        possible = max(len(seq) - 20 - pam_len + 1, 1)

        landscape[variant] = {
            "count": total,
            "forward": fwd_hits,
            "reverse": rev_hits,
            "coverage_pct": round(total / possible * 100, 1),
            "recommended": total > 0,
        }

    return landscape
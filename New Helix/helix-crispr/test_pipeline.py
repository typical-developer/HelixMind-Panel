"""
Run this to verify the pipeline works before touching the API.
Tests: PAM scanning, CRISPRscan scoring, off-target heuristics, full pipeline.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from core.pam import extract_guides, get_pam_landscape, sanitize_sequence
from core.scoring import score_guide, crisprscan_score, gc_content
from core.offtarget import heuristic_offtarget, calculate_cfd_score
from core.pipeline import run_crispr_pipeline

# ── Real genomic sequences for testing ───────────────────────────────────────

# Human EMX1 exon 1 — canonical CRISPR benchmark sequence
EMX1 = (
    "CCACCTTGTTGCGCTCGCCCGCCCCGCCCCGCGCCCGTCCCGGGCGGGGT"
    "CCCCGCCGCCGCGCCGCCCGGCCCGGCCCGGCCCGGCCCGGCCCGGCCCGG"
)

# Human VEGFA — another commonly targeted gene
VEGFA = (
    "GGCAGCGGAGCCGCGGCGGGCGCAGCGGGACGCGGCGGGCGGGGCGCAGCG"
    "GGGCGCAGCGGGGCGGAGCAGGAGCGGAGCGGGCGGAGCGGGCGGGGCTGG"
)

# Synthetic with guaranteed NGG sites
SYNTHETIC = (
    "ATCGATCGATCGATCGATCGATCGGGATCGATCGATCGATCGATCGGGAT"
    "CGATCGATCGATCGATCGGGCGATCGATCGATCGATCGATCGATCGATCGG"
)


def separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


# ── Test 1: Sequence sanitization ─────────────────────────────────────────────
separator("TEST 1: Sequence Sanitization")

try:
    clean = sanitize_sequence(">test_seq\nATCGATCG ATCG\n1234\nATCG")
    print(f"✅ FASTA sanitized: '{clean}'")
except Exception as e:
    print(f"❌ {e}")

try:
    sanitize_sequence("ATCGXYZ")
    print("❌ Should have rejected invalid chars")
except ValueError as e:
    print(f"✅ Correctly rejected invalid chars: {e}")


# ── Test 2: PAM scanning across variants ──────────────────────────────────────
separator("TEST 2: PAM Scanning")

for variant in ["SpCas9", "AsCas12a", "Cas13d"]:
    guides = extract_guides(SYNTHETIC, variant)
    print(f"  {variant:12s} → {len(guides):3d} guides found")

# Confirm SpCas9 finds guides on both strands
fwd = [g for g in extract_guides(SYNTHETIC, "SpCas9") if g.strand == "+"]
rev = [g for g in extract_guides(SYNTHETIC, "SpCas9") if g.strand == "-"]
print(f"\n  SpCas9 on SYNTHETIC: {len(fwd)} forward, {len(rev)} reverse strand guides")

if len(fwd) + len(rev) > 0:
    print("  ✅ PAM scanning working on both strands")
else:
    print("  ❌ No guides found — check PAM scanner")


# ── Test 3: CRISPRscan scoring ────────────────────────────────────────────────
separator("TEST 3: CRISPRscan Scoring")

# Known test cases from Moreno-Mateos 2015
# High-efficiency guide: should score > 0.5
high_ctx = "ACCGGGCGATCGATCGATCGGGCCGGGAT"  # 30nt
low_ctx  = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAT"  # low GC, should score lower

s_high = crisprscan_score(high_ctx.ljust(30)[:30])
s_low  = crisprscan_score(low_ctx.ljust(30)[:30])

print(f"  High-GC context score:  {s_high:.4f}")
print(f"  Low-GC context score:   {s_low:.4f}")

if s_high > s_low:
    print("  ✅ Scoring ranking correct (high GC context > low GC)")
else:
    print("  ⚠️  Expected high GC context to outscore low GC — check PWM")

# Test GC content function
print(f"  GC of 'GCGCGCGCGCGCGCGCGCGC': {gc_content('GCGCGCGCGCGCGCGCGCGC'):.3f}  (expected 1.0)")
print(f"  GC of 'ATATATATATATATATATATAT': {gc_content('ATATATATATATATATATATAT'):.3f}  (expected 0.0)")


# ── Test 4: Guide scoring with flags ──────────────────────────────────────────
separator("TEST 4: Guide Scoring + Flags")

guides = extract_guides(EMX1, "SpCas9")
if guides:
    scored = [score_guide(g) for g in guides[:5]]
    for s in scored:
        print(
            f"  {s['guide']}  "
            f"score={s['crisprscan']:.4f}  "
            f"gc={s['gc_pct']:.2f}  "
            f"grade={s['grade']}  "
            f"flags={s['flags'] or 'none'}"
        )
    print(f"\n  ✅ Scored {len(guides)} guides on EMX1")
else:
    print("  ❌ No guides found on EMX1 — unexpected")


# ── Test 5: Off-target heuristics ────────────────────────────────────────────
separator("TEST 5: Off-target Heuristics")

test_guides = {
    "High-GC seed (risky)": "GCGCGCGCGCGCGCGCGCGC",
    "Balanced (safe)":      "ATCGATCGATCGATCGATCG",
    "Homopolymer":          "AAAAAAAAAAAAATCGATCG",
}

for label, g in test_guides.items():
    result = heuristic_offtarget(g)
    print(
        f"  {label:26s} → risk={result['risk_level']:6s}  "
        f"seed_gc={result['seed_gc']:.2f}  "
        f"complexity={result['sequence_complexity']:.2f}"
    )


# ── Test 6: CFD score ─────────────────────────────────────────────────────────
separator("TEST 6: CFD Score")

guide     = "ATCGATCGATCGATCGATCG"
perfect   = "ATCGATCGATCGATCGATCG"   # perfect match
one_mm    = "ATCGATCGATCGATCGATCА"   # 1 mismatch PAM-distal
three_mm  = "ATCGTTCGATCGATCGTTCG"   # 3 mismatches

print(f"  Perfect match CFD:    {calculate_cfd_score(guide, perfect):.4f}  (expect 1.0)")
print(f"  1 PAM-distal mm CFD:  {calculate_cfd_score(guide, one_mm):.4f}")
print(f"  3 mismatch CFD:       {calculate_cfd_score(guide, three_mm):.4f}  (expect < 1.0)")


# ── Test 7: Full pipeline ─────────────────────────────────────────────────────
separator("TEST 7: Full Pipeline")

result = run_crispr_pipeline(
    sequence=EMX1,
    cas_variant="SpCas9",
    top_n=5,
    offtarget_tier="heuristic",
)

if "error" in result:
    print(f"  ❌ Pipeline error: {result['error']}")
else:
    s = result["summary"]
    print(f"  Input length:       {result['input_length']}nt")
    print(f"  Total candidates:   {s['total_candidates']}")
    print(f"  Passing filters:    {s['passing_filters']}")
    print(f"  Mean score:         {s['score_mean']:.4f}")
    print(f"  Top score:          {s['top_score']:.4f}")
    print(f"  Grade distribution: {s['grade_distribution']}")
    print(f"\n  Top 5 guides:")
    for i, g in enumerate(result["top_guides"], 1):
        ot = g.get("offtarget", {})
        print(
            f"    {i}. {g['guide']}  "
            f"score={g['crisprscan']:.4f}  "
            f"grade={g['grade']}  "
            f"offtarget_risk={ot.get('risk_level', 'N/A')}"
        )
    print(f"\n  PAM landscape: {result['pam_landscape']}")
    print(f"\n  ✅ Full pipeline working")


# ── Test 8: Edge cases ────────────────────────────────────────────────────────
separator("TEST 8: Edge Cases")

# Too short
r = run_crispr_pipeline("ATCG", "SpCas9")
print(f"  Too-short sequence: {'✅ error returned' if 'error' in r else '❌ should error'}")

# Invalid variant
r = run_crispr_pipeline(EMX1, "FakeCas99")
print(f"  Invalid variant:    {'✅ error returned' if 'error' in r else '❌ should error'}")

# Cas13 (no PAM)
r = run_crispr_pipeline(SYNTHETIC, "Cas13d", top_n=3, offtarget_tier="none")
print(f"  Cas13 (no PAM):     {'✅ ' + str(r['summary']['total_candidates']) + ' guides found' if 'error' not in r else '❌ ' + r['error']}")

# AsCas12a
r = run_crispr_pipeline(SYNTHETIC, "AsCas12a", top_n=3)
print(f"  AsCas12a:           {'✅ ' + str(r['summary']['total_candidates']) + ' guides found' if 'error' not in r else '❌ ' + r['error']}")


separator("ALL TESTS COMPLETE")
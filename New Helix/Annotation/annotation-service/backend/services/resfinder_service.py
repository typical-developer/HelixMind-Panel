"""
HelixMind — ResFinder Annotation Service
Self-hosted resistance gene detection. No rate limits, <2s latency.
"""

import asyncio
import json
import logging
import os
import sys
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy import to avoid circular deps
async def _enrich_hits_with_literature(hits):
    try:
        from services.pubmed_service import enrich_hits
        return await enrich_hits(hits)
    except Exception as e:
        logger.warning("PubMed enrichment failed (non-fatal): %s", e)
        return hits

RESFINDER_DB   = Path(os.getenv("RESFINDER_DB_PATH",   "./databases/resfinder_db"))
POINTFINDER_DB = Path(os.getenv("POINTFINDER_DB_PATH", "./databases/pointfinder_db"))

POINTFINDER_ORGANISMS = {
    "escherichia coli", "klebsiella pneumoniae", "salmonella",
    "campylobacter jejuni", "campylobacter coli", "staphylococcus aureus",
    "enterococcus faecalis", "enterococcus faecium", "helicobacter pylori",
    "mycobacterium tuberculosis", "neisseria gonorrhoeae",
}


class ResFinderError(Exception):
    pass


async def analyze_sequence(
    sequence: str,
    organism: Optional[str] = None,
    identity_threshold: float = 0.90,
    min_coverage: float = 0.60,
) -> dict:
    _validate_sequence(sequence)
    _validate_dbs()

    use_pointfinder = organism is not None and organism.lower() in POINTFINDER_ORGANISMS

    with tempfile.TemporaryDirectory() as tmpdir:
        fasta_path = _write_fasta(sequence, Path(tmpdir))
        output_dir = Path(tmpdir) / "output"
        output_dir.mkdir()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _run_resfinder_sync,
            str(fasta_path),
            str(output_dir),
            organism or "other",
            identity_threshold,
            min_coverage,
            use_pointfinder,
        )

        results = _parse_results(output_dir, identity_threshold, min_coverage, use_pointfinder)
        results["hits"] = await _enrich_hits_with_literature(results["hits"])

        # Class A/B/C anomaly scoring
        try:
            from core.scoring import score_sequence
            results["anomalies"] = score_sequence(
                sequence=sequence,
                hits=results["hits"],
                organism=organism,
            )
        except Exception as e:
            logger.warning("Anomaly scoring failed (non-fatal): %s", e)
            results["anomalies"] = None

        return results


async def stream_analyze_sequence(sequence, organism=None, identity_threshold=0.90, min_coverage=0.60):
    try:
        yield {"status": "running", "message": "ResFinder analysis started"}
        results = await analyze_sequence(sequence, organism, identity_threshold, min_coverage)
        for hit in results["hits"]:
            yield {"status": "hit", "data": hit}
            await asyncio.sleep(0)
        yield {
            "status": "complete",
            "summary": {
                "hit_count":           results["hit_count"],
                "resistance_classes":  results["resistance_classes"],
                "db_version":          results["db_version"],
                "pointfinder_enabled": results["pointfinder_enabled"],
                "analysis_meta":       results["analysis_meta"],
            },
        }
    except ResFinderError as e:
        logger.error("ResFinder analysis failed: %s", e)
        yield {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_sequence(sequence: str) -> None:
    if len(sequence) < 100:
        raise ResFinderError("Sequence too short — minimum 100 bp required")
    if len(sequence) > 10_000_000:
        raise ResFinderError("Sequence too long — maximum 10 Mbp supported")
    valid_chars = set("ATCGatcgNnRrYySsWwKkMmBbDdHhVv-")
    invalid = set(sequence) - valid_chars
    if invalid:
        raise ResFinderError(f"Invalid characters in sequence: {invalid}")


def _validate_dbs() -> None:
    if not RESFINDER_DB.exists():
        raise ResFinderError(f"ResFinder DB not found at {RESFINDER_DB}")
    if not POINTFINDER_DB.exists():
        raise ResFinderError(f"PointFinder DB not found at {POINTFINDER_DB}")


def _write_fasta(sequence: str, directory: Path) -> Path:
    fasta_path = directory / "input.fasta"
    fasta_path.write_text(f">helixmind_query\n{sequence}\n")
    return fasta_path


def _run_resfinder_sync(fasta, outdir, organism, threshold, min_coverage, use_pointfinder) -> None:
    """
    ResFinder's main() reads sys.argv via argparse internally.
    We set sys.argv ourselves and restore it after.
    """
    from resfinder.run_resfinder import main as resfinder_main

    argv = [
        "run_resfinder.py",
        "-ifa", fasta,
        "-o", outdir,
        "-s", organism,
        "-db_res", str(RESFINDER_DB),
        "-db_point", str(POINTFINDER_DB),
        "-t", str(threshold),
        "-l", str(min_coverage),
        "--acquired",
    ]
    if use_pointfinder:
        argv.append("--point")

    old_argv = sys.argv
    try:
        sys.argv = argv
        resfinder_main()
    finally:
        sys.argv = old_argv


def _parse_results(
    output_dir: Path,
    identity_threshold: float,
    min_coverage: float,
    pointfinder_enabled: bool,
) -> dict:
    """
    Parse from input.json — the structured output ResFinder generates.
    Gives us:
      - Clean AMR class labels (amr_classes field, e.g. "beta-lactam")
      - PubMed IDs per hit (pmids field) — free literature references
      - Resistant/not-resistant per drug
      - Chromosomal point mutations from PointFinder
    """
    json_path = output_dir / "input.json"
    if not json_path.exists():
        logger.warning("input.json not found — falling back to empty results")
        return _empty_results(identity_threshold, min_coverage, pointfinder_enabled)

    data = json.loads(json_path.read_text())

    # Build drug → amr_classes lookup from phenotypes block
    drug_to_classes = {}
    for drug, pheno in data.get("phenotypes", {}).items():
        drug_to_classes[drug] = pheno.get("amr_classes", [])

    hits = []

    # ── Acquired resistance genes ──────────────────────────────────────────
    for key, region in data.get("seq_regions", {}).items():
        if not region.get("gene"):
            continue
        if "PointFinder" in str(region.get("ref_database", [])):
            continue  # handled separately below

        gene_name   = region.get("name", "")
        identity    = region.get("identity", 0.0) / 100.0
        coverage    = region.get("coverage", 0.0) / 100.0
        pmids       = region.get("pmids", [])
        notes       = region.get("notes", [])
        phenotypes  = region.get("phenotypes", [])  # list of drug names

        # Collect unique AMR classes across all drugs this gene confers resistance to
        amr_classes = sorted({
            cls
            for drug in phenotypes
            for cls in drug_to_classes.get(drug, [])
        })

        hits.append({
            "gene":             gene_name,
            "accession":        region.get("ref_acc", ""),
            "identity":         round(identity, 4),
            "coverage":         round(coverage, 4),
            "resistance_class": ", ".join(amr_classes) if amr_classes else "Unknown",
            "resistance_drugs": phenotypes,
            "position": {
                "start": region.get("query_start_pos", 0),
                "end":   region.get("query_end_pos", 0),
            },
            "pmids":      pmids,       # ← literature references, free from JSON
            "notes":      notes,       # e.g. ["Class A"]
            "confidence": _confidence_tier(identity, coverage),
            "source":     "acquired",
        })

    # ── Chromosomal point mutations (PointFinder) ──────────────────────────
    if pointfinder_enabled:
        for key, variation in data.get("seq_variations", {}).items():
            if not variation.get("variation"):
                continue
            gene_name  = variation.get("gene_id", "")
            phenotypes = variation.get("phenotypes", [])
            amr_classes = sorted({
                cls
                for drug in phenotypes
                for cls in drug_to_classes.get(drug, [])
            })
            hits.append({
                "gene":             gene_name,
                "mutation":         variation.get("substitution", ""),
                "resistance_class": ", ".join(amr_classes) if amr_classes else "Unknown",
                "resistance_drugs": phenotypes,
                "pmids":            variation.get("pmids", []),
                "confidence":       "HIGH",
                "source":           "chromosomal",
                "identity":         1.0,
                "coverage":         1.0,
            })

    # Unique clean class names across all hits
    resistance_classes = sorted({
        cls.strip()
        for hit in hits
        for cls in hit["resistance_class"].split(", ")
        if cls.strip() and cls.strip() != "Unknown"
    })

    return {
        "hits":                hits,
        "resistance_classes":  resistance_classes,
        "hit_count":           len(hits),
        "db_version":          _get_db_version(),
        "pointfinder_enabled": pointfinder_enabled,
        "analysis_meta": {
            "identity_threshold": identity_threshold,
            "min_coverage":       min_coverage,
            "note": (
                f"ResFinder DB (acquired resistance genes)"
                f"{' + PointFinder (chromosomal point mutations)' if pointfinder_enabled else ''}. "
                f"Hits reported at >={identity_threshold*100:.0f}% identity "
                f"and >={min_coverage*100:.0f}% coverage."
            ),
        },
    }


def _empty_results(identity_threshold, min_coverage, pointfinder_enabled):
    return {
        "hits": [], "resistance_classes": [], "hit_count": 0,
        "db_version": _get_db_version(), "pointfinder_enabled": pointfinder_enabled,
        "analysis_meta": {"identity_threshold": identity_threshold, "min_coverage": min_coverage},
    }


def _confidence_tier(identity: float, coverage: float) -> str:
    if identity >= 0.99 and coverage >= 0.90:
        return "HIGH"
    if identity >= 0.90 and coverage >= 0.60:
        return "MEDIUM"
    return "LOW"


def _get_db_version() -> str:
    for fname in ("CHANGELOG.md", "VERSION"):
        f = RESFINDER_DB / fname
        if f.exists():
            return f.read_text().splitlines()[0].strip("# ").strip()
    return "resfinder_db (version unknown)"
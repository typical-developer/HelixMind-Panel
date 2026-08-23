"""
HelixMind — Build Co-occurrence Matrix from BV-BRC (PATRIC)
scripts/build_cooccurrence_matrix.py

Two-call approach: fetch Resistant + Susceptible separately
(BV-BRC API rejects open queries without a phenotype filter).

Correct denominator:
  prevalence = co_resistant / genomes_tested_for_both_classes
"""

import asyncio
import json
import logging
from collections import defaultdict
from itertools import combinations
from pathlib import Path

import httpx

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BV_BRC_API  = "https://www.bv-brc.org/api/genome_amr/"
OUTPUT_DIR  = Path(__file__).parent.parent / "backend" / "core" / "data"
OUTPUT_FILE = OUTPUT_DIR / "cooccurrence_matrix.json"

DRUG_TO_CLASS = {
    "ampicillin": "beta-lactam", "amoxicillin": "beta-lactam",
    "amoxicillin/clavulanic acid": "beta-lactam", "piperacillin": "beta-lactam",
    "piperacillin/tazobactam": "beta-lactam", "cephalothin": "beta-lactam",
    "cefazolin": "beta-lactam", "cefoxitin": "beta-lactam",
    "ceftriaxone": "beta-lactam", "ceftazidime": "beta-lactam",
    "cefepime": "beta-lactam", "cefotaxime": "beta-lactam",
    "cefuroxime": "beta-lactam", "cephalexin": "beta-lactam",
    "meropenem": "carbapenem", "imipenem": "carbapenem",
    "ertapenem": "carbapenem", "doripenem": "carbapenem",
    "gentamicin": "aminoglycoside", "tobramycin": "aminoglycoside",
    "amikacin": "aminoglycoside", "streptomycin": "aminoglycoside",
    "kanamycin": "aminoglycoside", "neomycin": "aminoglycoside",
    "ciprofloxacin": "fluoroquinolone", "levofloxacin": "fluoroquinolone",
    "moxifloxacin": "fluoroquinolone", "norfloxacin": "fluoroquinolone",
    "ofloxacin": "fluoroquinolone", "enrofloxacin": "fluoroquinolone",
    "tetracycline": "tetracycline", "doxycycline": "tetracycline",
    "minocycline": "tetracycline", "tigecycline": "tetracycline",
    "sulfamethoxazole": "sulfonamide", "sulfisoxazole": "sulfonamide",
    "trimethoprim": "trimethoprim", "trimethoprim/sulfamethoxazole": "trimethoprim",
    "erythromycin": "macrolide", "azithromycin": "macrolide",
    "clarithromycin": "macrolide",
    "colistin": "colistin", "polymyxin b": "colistin",
    "vancomycin": "glycopeptide", "teicoplanin": "glycopeptide",
    "chloramphenicol": "phenicol", "florfenicol": "phenicol",
    "rifampicin": "rifamycin", "rifampin": "rifamycin",
    "linezolid": "oxazolidinone",
}


async def fetch_phenotype(phenotype_label: str, limit: int = 25000) -> list[dict]:
    """Fetch records for a specific phenotype label."""
    url = (
        f"{BV_BRC_API}"
        f"?eq(resistant_phenotype,{phenotype_label})"
        f"&select(genome_id,antibiotic,resistant_phenotype)"
        f"&limit({limit})"
    )
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url, headers={"Accept": "application/json"})
        response.raise_for_status()
        data = response.json()
        logger.info("Fetched %d %s records", len(data), phenotype_label)
        return data


def compute_cooccurrence(all_records: list[dict]) -> dict:
    """
    Group by genome. Track tested classes and resistant classes per genome.
    Prevalence = co_resistant / tested_for_both (correct conditional probability).
    """
    # genome_id -> class -> phenotype ("resistant" | "susceptible")
    genome_data: dict[str, dict[str, str]] = defaultdict(dict)

    for record in all_records:
        genome_id  = record.get("genome_id", "").strip()
        antibiotic = record.get("antibiotic", "").lower().strip()
        phenotype  = record.get("resistant_phenotype", "").strip()

        if not genome_id or not antibiotic:
            continue

        amr_class = DRUG_TO_CLASS.get(antibiotic)
        if not amr_class:
            continue

        # Resistant beats susceptible — don't overwrite R with S
        if genome_data[genome_id].get(amr_class) != "resistant":
            if phenotype in ("Resistant", "resistant", "R"):
                genome_data[genome_id][amr_class] = "resistant"
            elif phenotype in ("Susceptible", "susceptible", "S", "Sensitive"):
                genome_data[genome_id][amr_class] = "susceptible"

    logger.info("Processed %d genomes", len(genome_data))

    # Count pair co-occurrences with correct denominator
    pair_stats: dict[str, dict] = defaultdict(lambda: {"tested": 0, "co_resistant": 0})

    for genome_id, class_phenotypes in genome_data.items():
        classes = sorted(class_phenotypes.keys())
        for pair in combinations(classes, 2):
            key = f"{pair[0]}|{pair[1]}"
            pair_stats[key]["tested"] += 1
            if (class_phenotypes[pair[0]] == "resistant" and
                    class_phenotypes[pair[1]] == "resistant"):
                pair_stats[key]["co_resistant"] += 1

    # Build matrix — minimum 10 genomes tested for the pair
    matrix = {}
    for pair_key, stats in pair_stats.items():
        if stats["tested"] < 10:
            continue
        cls_a, cls_b = pair_key.split("|")
        prevalence   = stats["co_resistant"] / stats["tested"]
        matrix[pair_key] = {
            "class_a":      cls_a,
            "class_b":      cls_b,
            "co_resistant": stats["co_resistant"],
            "tested":       stats["tested"],
            "prevalence":   round(prevalence, 6),
        }

    # Log top 15
    top = sorted(matrix.values(), key=lambda x: x["prevalence"], reverse=True)[:15]
    logger.info("Top 15 co-occurrence pairs (correct denominator):")
    for p in top:
        logger.info(
            "  %-20s + %-20s = %5.1f%% (%d/%d tested)",
            p["class_a"], p["class_b"],
            p["prevalence"] * 100,
            p["co_resistant"], p["tested"],
        )

    return matrix


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Two separate calls — BV-BRC rejects open queries without a phenotype filter
    resistant   = await fetch_phenotype("Resistant",   limit=25000)
    susceptible = await fetch_phenotype("Susceptible", limit=25000)
    all_records = resistant + susceptible

    logger.info("Total records: %d (%d R + %d S)",
                len(all_records), len(resistant), len(susceptible))

    matrix = compute_cooccurrence(all_records)
    rare   = sum(1 for v in matrix.values() if v["prevalence"] < 0.05)
    common = sum(1 for v in matrix.values() if v["prevalence"] >= 0.20)

    output = {
        "metadata": {
            "source":        "BV-BRC (PATRIC) AMR phenotype database",
            "source_url":    "https://www.bv-brc.org/api/genome_amr/",
            "method":        "co_resistant / genomes_tested_for_both_classes",
            "total_records": len(all_records),
            "resistant":     len(resistant),
            "susceptible":   len(susceptible),
        },
        "matrix": matrix,
    }

    OUTPUT_FILE.write_text(json.dumps(output, indent=2))

    print(f"\n✅ Co-occurrence matrix rebuilt")
    print(f"   Records:       {len(all_records)} ({len(resistant)} R + {len(susceptible)} S)")
    print(f"   Pairs:         {len(matrix)}")
    print(f"   Rare  (<5%):   {rare}")
    print(f"   Common (≥20%): {common}")
    print(f"   Output:        {OUTPUT_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
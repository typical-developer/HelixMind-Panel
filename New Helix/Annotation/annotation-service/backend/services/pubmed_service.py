"""
HelixMind — PubMed Enrichment Service

Enriches raw PMIDs from ResFinder hits with full paper metadata
via NCBI EFetch API. Results are cached in-memory to avoid
redundant API calls across requests.

No API key required for low volume (<3 req/s).
Register for an API key at https://www.ncbi.nlm.nih.gov/account/
to get 10 req/s — set as NCBI_API_KEY env var.
"""

import asyncio
import logging
import xml.etree.ElementTree as ET
from typing import Optional

import httpx

from core.config import NCBI_API_KEY

logger = logging.getLogger(__name__)

EFETCH_URL    = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
PUBMED_BASE   = "https://pubmed.ncbi.nlm.nih.gov"

# In-memory cache — PMID metadata doesn't change, safe to cache indefinitely
_cache: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def enrich_pmids(pmids: list[str]) -> dict[str, dict]:
    """
    Fetch metadata for a list of PMIDs. Returns a dict keyed by PMID.
    Already-cached PMIDs are returned immediately without an API call.

    Returns:
        {
            "15388431": {
                "pmid": "15388431",
                "title": "...",
                "authors": "Salverda et al.",
                "journal": "J Bacteriol",
                "year": "2004",
                "abstract": "...",
                "url": "https://pubmed.ncbi.nlm.nih.gov/15388431"
            },
            ...
        }
    """
    if not pmids:
        return {}

    # Split into cached vs needs fetching
    cached   = {p: _cache[p] for p in pmids if p in _cache}
    to_fetch = [p for p in pmids if p not in _cache]

    if not to_fetch:
        return cached

    fetched = await _fetch_batch(to_fetch)

    # Update cache
    _cache.update(fetched)

    return {**cached, **fetched}


async def enrich_hits(hits: list[dict]) -> list[dict]:
    """
    Attach full literature metadata to each hit's pmids list.
    Modifies hits in-place, returns the enriched list.
    """
    # Collect all unique PMIDs across all hits
    all_pmids = list({pmid for hit in hits for pmid in hit.get("pmids", [])})

    if not all_pmids:
        return hits

    metadata = await enrich_pmids(all_pmids)

    for hit in hits:
        hit["literature"] = [
            metadata[pmid]
            for pmid in hit.get("pmids", [])
            if pmid in metadata
        ]

    return hits


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_batch(pmids: list[str]) -> dict[str, dict]:
    """
    Fetch up to 20 PMIDs in a single EFetch call (XML format).
    NCBI recommends batching — don't fire one request per PMID.
    """
    params = {
        "db":      "pubmed",
        "id":      ",".join(pmids),
        "rettype": "xml",
        "retmode": "xml",
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(EFETCH_URL, params=params)
            response.raise_for_status()
            return _parse_pubmed_xml(response.text)

    except httpx.TimeoutException:
        logger.warning("PubMed EFetch timed out for PMIDs: %s", pmids)
        return _fallback_stubs(pmids)
    except httpx.HTTPStatusError as e:
        logger.warning("PubMed EFetch HTTP error: %s", e)
        return _fallback_stubs(pmids)
    except Exception as e:
        logger.warning("PubMed EFetch unexpected error: %s", e)
        return _fallback_stubs(pmids)


def _parse_pubmed_xml(xml_text: str) -> dict[str, dict]:
    """
    Parse NCBI PubMed XML into clean metadata dicts.
    Handles missing fields gracefully — not all articles have abstracts.
    """
    results = {}

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.warning("Failed to parse PubMed XML: %s", e)
        return results

    for article in root.findall(".//PubmedArticle"):
        try:
            pmid = article.findtext(".//PMID", default="").strip()
            if not pmid:
                continue

            # Title
            title = article.findtext(".//ArticleTitle", default="").strip()

            # Authors — "Last FM, Last FM, ..." truncated to first author + et al.
            authors_el = article.findall(".//Author")
            author_str = _format_authors(authors_el)

            # Journal
            journal = article.findtext(".//Journal/Title", default="").strip()
            if not journal:
                journal = article.findtext(".//MedlineTA", default="").strip()

            # Year — try multiple paths
            year = (
                article.findtext(".//PubDate/Year")
                or article.findtext(".//PubDate/MedlineDate", "")[:4]
                or ""
            ).strip()

            # Abstract — may be structured (multiple AbstractText elements)
            abstract_parts = article.findall(".//AbstractText")
            if abstract_parts:
                abstract = " ".join(
                    (el.get("Label", "") + ": " + (el.text or "")).strip()
                    if el.get("Label") else (el.text or "")
                    for el in abstract_parts
                ).strip()
            else:
                abstract = ""

            results[pmid] = {
                "pmid":     pmid,
                "title":    title or f"Article PMID:{pmid}",
                "authors":  author_str,
                "journal":  journal,
                "year":     year,
                "abstract": abstract[:500] + "..." if len(abstract) > 500 else abstract,
                "url":      f"{PUBMED_BASE}/{pmid}",
            }

        except Exception as e:
            logger.warning("Error parsing PubMed article: %s", e)
            continue

    return results


def _format_authors(author_elements) -> str:
    """Format author list as 'Last FM, Last FM, ...' with et al. if >3 authors."""
    names = []
    for author in author_elements[:3]:
        last  = author.findtext("LastName", default="")
        init  = author.findtext("Initials", default="")
        if last:
            names.append(f"{last} {init}".strip())

    if not names:
        return "Unknown authors"

    result = ", ".join(names)
    if len(author_elements) > 3:
        result += " et al."

    return result


def _fallback_stubs(pmids: list[str]) -> dict[str, dict]:
    """Return minimal stubs when the API is unreachable — don't crash the hit."""
    return {
        pmid: {
            "pmid":     pmid,
            "title":    f"Article PMID:{pmid}",
            "authors":  "",
            "journal":  "",
            "year":     "",
            "abstract": "",
            "url":      f"{PUBMED_BASE}/{pmid}",
        }
        for pmid in pmids
    }
"""
HelixMind — Annotation API Routes
Resistance gene profiling via self-hosted ResFinder.

Mount in main.py:
    from routes.annotation import router as annotation_router
    app.include_router(annotation_router)
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from services.resfinder_service import (
    analyze_sequence,
    stream_analyze_sequence,
    ResFinderError,
    POINTFINDER_ORGANISMS,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/annotation", tags=["annotation"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class AnnotationRequest(BaseModel):
    sequence: str = Field(
        ...,
        description="Raw nucleotide sequence (ATCG + IUPAC ambiguity codes)",
        min_length=100,
        max_length=10_000_000,
    )
    organism: Optional[str] = Field(
        None,
        description=(
            "Species name for PointFinder (chromosomal point mutations). "
            f"Supported: {', '.join(sorted(POINTFINDER_ORGANISMS))}"
        ),
        examples=["escherichia coli", "klebsiella pneumoniae"],
    )
    identity_threshold: float = Field(
        0.90,
        ge=0.50,
        le=1.00,
        description="Minimum % identity to report a hit (0.5–1.0)",
    )
    min_coverage: float = Field(
        0.60,
        ge=0.10,
        le=1.00,
        description="Minimum % gene coverage to report a hit (0.1–1.0)",
    )

    @field_validator("sequence")
    @classmethod
    def clean_sequence(cls, v: str) -> str:
        # Strip whitespace, newlines, FASTA headers
        cleaned = ""
        for line in v.splitlines():
            if line.startswith(">"):
                continue
            cleaned += line.strip()
        return cleaned.upper()

    @field_validator("organism")
    @classmethod
    def normalize_organism(cls, v: Optional[str]) -> Optional[str]:
        return v.lower().strip() if v else None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/resistance",
    summary="Resistance gene profile (sync)",
    description=(
        "Run ResFinder against a sequence and return the full resistance profile. "
        "Use /resistance/stream for real-time results on long sequences."
    ),
)
async def get_resistance_profile(req: AnnotationRequest):
    try:
        results = await analyze_sequence(
            sequence=req.sequence,
            organism=req.organism,
            identity_threshold=req.identity_threshold,
            min_coverage=req.min_coverage,
        )
        return {"status": "complete", **results}

    except ResFinderError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error in resistance analysis")
        raise HTTPException(status_code=500, detail="Analysis failed — check server logs")


@router.post(
    "/resistance/stream",
    summary="Resistance gene profile (streaming SSE)",
    description=(
        "Stream resistance hits as they are found. "
        "Returns Server-Sent Events. Each event is a JSON object with a 'status' field:\n"
        "- running: analysis started\n"
        "- hit: one resistance gene found (data field contains the hit)\n"
        "- complete: analysis done (summary field contains totals)\n"
        "- error: something went wrong (message field)"
    ),
    response_class=StreamingResponse,
)
async def stream_resistance_profile(req: AnnotationRequest):
    async def sse_generator():
        async for event in stream_analyze_sequence(
            sequence=req.sequence,
            organism=req.organism,
            identity_threshold=req.identity_threshold,
            min_coverage=req.min_coverage,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering for SSE
        },
    )


@router.get(
    "/organisms",
    summary="List PointFinder-supported organisms",
    description="Returns organisms that support chromosomal point mutation screening.",
)
async def list_supported_organisms():
    return {
        "pointfinder_organisms": sorted(POINTFINDER_ORGANISMS),
        "note": (
            "All other organisms will still screen for acquired resistance genes. "
            "Chromosomal point mutations require organism selection."
        ),
    }


@router.get(
    "/health",
    summary="Service health check",
    description="Verify ResFinder databases are mounted and accessible.",
)
async def health_check():
    from services.resfinder_service import RESFINDER_DB, POINTFINDER_DB

    resfinder_ok   = RESFINDER_DB.exists()
    pointfinder_ok = POINTFINDER_DB.exists()

    status = "healthy" if (resfinder_ok and pointfinder_ok) else "degraded"

    return {
        "status":          status,
        "resfinder_db":    {"path": str(RESFINDER_DB),   "available": resfinder_ok},
        "pointfinder_db":  {"path": str(POINTFINDER_DB), "available": pointfinder_ok},
    }

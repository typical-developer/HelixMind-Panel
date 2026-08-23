from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, field_validator
from core.pipeline import run_crispr_pipeline
from core.pam import PAM_CONFIG, get_pam_landscape, sanitize_sequence

router = APIRouter(prefix="/api/crispr", tags=["CRISPR"])


# ── Request / Response models ─────────────────────────────────────────────────

class DesignRequest(BaseModel):
    sequence: str = Field(..., description="DNA sequence (FASTA or raw, max 50kb)")
    cas_variant: str = Field("SpCas9", description="Cas variant")
    top_n: int = Field(10, ge=1, le=50, description="Number of top guides to return")
    guide_length: int = Field(20, ge=17, le=24, description="Guide RNA length in nt")
    offtarget_tier: str = Field(
        "heuristic",
        description="Off-target analysis tier: none | heuristic | crispor"
    )
    genome: str = Field("hg38", description="Reference genome for CRISPOR tier")

    @field_validator("cas_variant")
    @classmethod
    def validate_cas_variant(cls, v):
        if v not in PAM_CONFIG:
            raise ValueError(
                f"Unknown variant '{v}'. Supported: {list(PAM_CONFIG.keys())}"
            )
        return v

    @field_validator("offtarget_tier")
    @classmethod
    def validate_offtarget_tier(cls, v):
        if v not in ("none", "heuristic", "crispor"):
            raise ValueError("offtarget_tier must be 'none', 'heuristic', or 'crispor'")
        return v

    @field_validator("sequence")
    @classmethod
    def validate_sequence(cls, v):
        if len(v.strip()) < 23:
            raise ValueError("Sequence too short. Minimum 23nt required.")
        if len(v) > 100_000:
            raise ValueError("Sequence too long. Maximum 50kb.")
        return v


class PAMScanRequest(BaseModel):
    sequence: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/design")
async def design_guides(req: DesignRequest):
    """
    Main endpoint: design and score guide RNAs for a given sequence + Cas variant.
    Returns top guides ranked by on-target efficiency.
    """
    result = run_crispr_pipeline(
        sequence=req.sequence,
        cas_variant=req.cas_variant,
        top_n=req.top_n,
        guide_length=req.guide_length,
        offtarget_tier=req.offtarget_tier,
        genome=req.genome,
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/pam-scan")
async def scan_pam_sites(req: PAMScanRequest):
    """
    Scan a sequence for PAM sites across all supported Cas variants.
    Returns counts and coverage per variant — helps choose the right tool.
    """
    try:
        sanitized = sanitize_sequence(req.sequence)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    landscape = get_pam_landscape(sanitized)
    return {
        "sequence_length": len(sanitized),
        "pam_landscape":   landscape,
        "recommended": [
            v for v, data in landscape.items()
            if isinstance(data.get("count"), int) and data["count"] > 0
        ],
    }


@router.get("/variants")
async def list_variants():
    """List all supported Cas variants with their PAM requirements."""
    return {
        "variants": [
            {
                "name":       v,
                "pam":        cfg["pattern"] or "None (RNA-targeting)",
                "pam_side":   cfg["side"],
                "target_type": "RNA" if cfg["pattern"] is None else "DNA",
            }
            for v, cfg in PAM_CONFIG.items()
        ]
    }


@router.get("/health")
async def health():
    return {"status": "ok", "service": "HelixMind CRISPR Engine"}
"""
HelixMind Annotation Service Configuration

Centralized configuration for database paths, thresholds, and API keys.
All backend components read from this module.
"""

from pathlib import Path
import os


# ─────────────────────────────────────────────────────────────────────────
# Database Configuration
# ─────────────────────────────────────────────────────────────────────────

# Paths relative to docker-compose.yml at annotation-service root
# In containers, these are mounted at /databases/
RESFINDER_DB = Path(
    os.getenv("RESFINDER_DB_PATH", "../databases/resfinder_db")
)
POINTFINDER_DB = Path(
    os.getenv("POINTFINDER_DB_PATH", "../databases/pointfinder_db")
)


# ─────────────────────────────────────────────────────────────────────────
# ResFinder Analysis Thresholds
# ─────────────────────────────────────────────────────────────────────────

DEFAULT_IDENTITY_THRESHOLD = float(
    os.getenv("IDENTITY_THRESHOLD", "0.90")
)
DEFAULT_MIN_COVERAGE = float(
    os.getenv("MIN_COVERAGE", "0.60")
)


# ─────────────────────────────────────────────────────────────────────────
# PubMed / NCBI Configuration
# ─────────────────────────────────────────────────────────────────────────

NCBI_API_KEY = os.getenv("NCBI_API_KEY", "")
NCBI_EMAIL = os.getenv("NCBI_EMAIL", "noreply@helixmind.io")
PUBMED_BATCH_SIZE = int(os.getenv("PUBMED_BATCH_SIZE", "10"))
PUBMED_CACHE_TTL = int(os.getenv("PUBMED_CACHE_TTL", "3600"))  # 1 hour


# ─────────────────────────────────────────────────────────────────────────
# Service Configuration
# ─────────────────────────────────────────────────────────────────────────

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = ENVIRONMENT == "development"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


# ─────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────

def validate_config():
    """Validate that all required config values are available."""
    errors = []
    
    if not RESFINDER_DB.exists():
        errors.append(f"ResFinder DB not found at {RESFINDER_DB}")
    
    if not POINTFINDER_DB.exists():
        errors.append(f"PointFinder DB not found at {POINTFINDER_DB}")
    
    if not (0 <= DEFAULT_IDENTITY_THRESHOLD <= 1):
        errors.append(f"Identity threshold must be 0-1, got {DEFAULT_IDENTITY_THRESHOLD}")
    
    if not (0 <= DEFAULT_MIN_COVERAGE <= 1):
        errors.append(f"Min coverage must be 0-1, got {DEFAULT_MIN_COVERAGE}")
    
    if errors:
        raise ValueError("Configuration errors:\n" + "\n".join(errors))

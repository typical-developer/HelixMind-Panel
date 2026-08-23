FROM python:3.11-slim

LABEL org.opencontainers.image.title="HelixMind ResFinder Worker"

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    kma \
    ncbi-blast+ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────────────────────────
COPY services/ ./services/
COPY routes/   ./routes/
COPY main.py   .

# ── Database directories ──────────────────────────────────────────────────────
RUN mkdir -p /databases/resfinder_db /databases/pointfinder_db

# ── Entrypoint: index DBs if not yet indexed, then start server ───────────────
COPY services/resfinder/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV RESFINDER_DB_PATH=/databases/resfinder_db
ENV POINTFINDER_DB_PATH=/databases/pointfinder_db
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/api/annotation/health || exit 1

EXPOSE 8001
ENTRYPOINT ["/entrypoint.sh"]

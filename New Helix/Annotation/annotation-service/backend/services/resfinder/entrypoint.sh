#!/bin/bash
set -e

echo "🧬 HelixMind ResFinder Worker starting..."

# ── Index ResFinder DB if not already indexed ─────────────────────────────────
if [ ! -f "$RESFINDER_DB_PATH/kma_indexing/all.name" ]; then
    echo "⚙ Indexing ResFinder DB (first run, takes ~30s)..."
    cd "$RESFINDER_DB_PATH" && python3 INSTALL.py
    echo "✓ ResFinder DB indexed"
else
    echo "✓ ResFinder DB already indexed"
fi

# ── Index PointFinder DB if not already indexed ───────────────────────────────
if [ ! -f "$POINTFINDER_DB_PATH/e.coli/all.name" ]; then
    echo "⚙ Indexing PointFinder DB (first run, takes ~20s)..."
    cd "$POINTFINDER_DB_PATH" && python3 INSTALL.py
    echo "✓ PointFinder DB indexed"
else
    echo "✓ PointFinder DB already indexed"
fi

echo "🚀 Starting API server..."
exec uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4 --loop uvloop

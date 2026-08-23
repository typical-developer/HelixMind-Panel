#!/usr/bin/env bash
# HelixMind — ResFinder Database Setup
# Run this once before starting the stack.
#
# Usage: chmod +x setup_dbs.sh && ./setup_dbs.sh

set -euo pipefail

DATABASES_DIR="./databases"
RESFINDER_DB_URL="https://bitbucket.org/genomicepidemiology/resfinder_db.git"
POINTFINDER_DB_URL="https://bitbucket.org/genomicepidemiology/pointfinder_db.git"

echo "🧬 HelixMind — ResFinder DB Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p "$DATABASES_DIR"

# ── ResFinder DB ──────────────────────────────────────────────────────────────
if [ -d "$DATABASES_DIR/resfinder_db/.git" ]; then
  echo "✓ ResFinder DB exists — pulling latest..."
  git -C "$DATABASES_DIR/resfinder_db" pull --quiet
else
  echo "⬇ Cloning ResFinder DB (~200MB)..."
  git clone --depth 1 "$RESFINDER_DB_URL" "$DATABASES_DIR/resfinder_db"
fi

# ── PointFinder DB ────────────────────────────────────────────────────────────
if [ -d "$DATABASES_DIR/pointfinder_db/.git" ]; then
  echo "✓ PointFinder DB exists — pulling latest..."
  git -C "$DATABASES_DIR/pointfinder_db" pull --quiet
else
  echo "⬇ Cloning PointFinder DB (~50MB)..."
  git clone --depth 1 "$POINTFINDER_DB_URL" "$DATABASES_DIR/pointfinder_db"
fi

# ── Index DBs with KMA (required for ResFinder queries) ──────────────────────
echo ""
echo "⚙ Indexing ResFinder DB with KMA..."
(cd "$DATABASES_DIR/resfinder_db" && python3 INSTALL.py)

echo "⚙ Indexing PointFinder DB with KMA..."
(cd "$DATABASES_DIR/pointfinder_db" && python3 INSTALL.py)

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Databases ready:"
echo "   ResFinder:   $DATABASES_DIR/resfinder_db"
echo "   PointFinder: $DATABASES_DIR/pointfinder_db"
echo ""
echo "Next: docker-compose up -d"

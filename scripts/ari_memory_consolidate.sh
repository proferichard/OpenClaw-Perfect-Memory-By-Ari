#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WORKSPACE="${REPO_ROOT}"
ANALYZE="$WORKSPACE/projects/ari-memory/src/analyze.js"
BRIDGE="$WORKSPACE/projects/ari-memory/src/bridge.js"
OUT="$WORKSPACE/memory/$(date -u +%Y-%m-%d)-ari-memory-summary.md"

node "$ANALYZE" daily-summary > "$OUT"
SUMMARY_LINE="$(grep '^\- total:' "$OUT" | head -n1 | sed 's/^[- ]*//')"
node "$BRIDGE" remember "Resumen memoria diario generado: ${SUMMARY_LINE}" >/dev/null || true

echo "ari-memory consolidate ok -> $OUT"
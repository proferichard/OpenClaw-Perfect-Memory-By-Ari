#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WORKSPACE="${REPO_ROOT}"
ANALYZE="$WORKSPACE/projects/ari-memory/src/analyze.js"
OUT="$WORKSPACE/memory/$(date -u +%Y-%m-%d)-ari-memory-contradictions.md"

node "$ANALYZE" contradictions > "$OUT"

echo "ari-memory contradictions check ok -> $OUT"
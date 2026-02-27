#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BRIDGE="${REPO_ROOT}/src/bridge.js"
WORKSPACE="${REPO_ROOT}"

remember() {
  local txt="$1"
  if [ -n "${txt// }" ]; then
    node "$BRIDGE" remember "$txt" >/dev/null || true
  fi
}

# Ingest curated long-term memory bullets
if [ -f "$WORKSPACE/MEMORY.md" ]; then
  awk '/^- \*\*/ || /^- / {print}' "$WORKSPACE/MEMORY.md" | while IFS= read -r line; do
    clean="$(echo "$line" | sed -E 's/^[- ]+//')"
    remember "$clean"
  done
fi

# Ingest recent daily memory notes (today + yesterday if present)
TODAY="$(date -u +%Y-%m-%d)"
YDAY="$(date -u -d 'yesterday' +%Y-%m-%d 2>/dev/null || true)"
for d in "$TODAY" "$YDAY"; do
  f="$WORKSPACE/memory/${d}.md"
  [ -f "$f" ] || continue
  awk '/^- / {print}' "$f" | while IFS= read -r line; do
    clean="$(echo "$line" | sed -E 's/^[- ]+//')"
    remember "$clean"
  done
done

echo "ari-memory ingest ok"
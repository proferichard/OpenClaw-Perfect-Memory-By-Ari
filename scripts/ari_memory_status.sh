#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PID_FILE="${REPO_ROOT}/memory/ari-memory-api.pid"

PID="$(ss -ltnp 2>/dev/null | awk '/127.0.0.1:7787/ { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART+4, RLENGTH-4); exit } }')"
if [ -n "$PID" ]; then
  echo "$PID" > "$PID_FILE"
  echo "ari-memory running (pid $PID)"
  curl -s http://127.0.0.1:7787/health || true
  echo
else
  echo "ari-memory stopped"
fi
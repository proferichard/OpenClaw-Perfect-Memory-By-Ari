#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PID_FILE="${REPO_ROOT}/memory/ari-memory-api.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "ari-memory not running (no pid file)"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "ari-memory stopped (pid $PID)"
else
  # fallback: kill process listening on port
  PORT_PID="$(ss -ltnp 2>/dev/null | awk '/127.0.0.1:7787/ { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART+4, RLENGTH-4); exit } }')"
  if [ -n "$PORT_PID" ]; then
    kill "$PORT_PID" || true
    echo "ari-memory stopped (fallback port pid $PORT_PID)"
  else
    echo "stale pid file, cleaning"
  fi
fi

rm -f "$PID_FILE"
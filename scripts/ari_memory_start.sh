#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APP_DIR="${REPO_ROOT}"
PID_FILE="${REPO_ROOT}/memory/ari-memory-api.pid"
LOG_FILE="${REPO_ROOT}/memory/ari-memory-api.log"

EXISTING_PID="$(ss -ltnp 2>/dev/null | awk '/127.0.0.1:7787/ { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART+4, RLENGTH-4); exit } }')"
if [ -n "$EXISTING_PID" ]; then
  echo "$EXISTING_PID" > "$PID_FILE"
  echo "ari-memory already running (pid $EXISTING_PID)"
  exit 0
fi

cd "$APP_DIR"
nohup node src/server.js >> "$LOG_FILE" 2>&1 &
PID=$!
sleep 1
if kill -0 "$PID" 2>/dev/null; then
  echo "$PID" > "$PID_FILE"
  echo "ari-memory started (pid $PID)"
else
  echo "ari-memory failed to start; check $LOG_FILE"
  exit 1
fi
#!/usr/bin/env bash
set -euo pipefail

SERVER_PID=""
NGROK_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  for pid in "$SERVER_PID" "$NGROK_PID"; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 is not installed." >&2
    echo "  Install it with: $2" >&2
    exit 1
  fi
}

require node "https://nodejs.org or your version manager"
require ngrok "brew install ngrok"

PORT="${PORT:-3000}"
NGROK_API="${NGROK_API:-http://127.0.0.1:4040}"

ngrok http "$PORT" --log /dev/null >/dev/null 2>&1 &
NGROK_PID=$!

node --env-file-if-exists=.env --import tsx src/server.ts &
SERVER_PID=$!

URL=""
for _ in $(seq 1 40); do
  URL=$(curl -fsS "$NGROK_API/api/tunnels" 2>/dev/null |
    node -e 'let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{try{const t=JSON.parse(b).tunnels||[];process.stdout.write(t.length?t[0].public_url:"")}catch{process.stdout.write("")}})' ||
    true)

  if [ -n "$URL" ]; then
    break
  fi

  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "ERROR: ngrok exited before publishing a tunnel." >&2
    echo "  Check your ngrok auth token with: ngrok config check" >&2
    exit 1
  fi

  sleep 0.25
done

if [ -z "$URL" ]; then
  echo "ERROR: ngrok did not publish a tunnel within 10 seconds." >&2
  echo "  Is another ngrok agent already running? Check $NGROK_API" >&2
  exit 1
fi

echo ""
echo "========================================"
echo "  $URL"
if [ "${ADMIN_ENABLED:-false}" = "true" ]; then
  echo "  admin: $URL${ADMIN_PATH:-/__admin}"
fi
echo "  local: http://127.0.0.1:$PORT"
echo "========================================"
echo ""

wait "$SERVER_PID"

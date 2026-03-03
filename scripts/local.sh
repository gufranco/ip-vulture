#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$SERVER_PID" "$NGROK_PID" 2>/dev/null
  wait "$SERVER_PID" "$NGROK_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

ngrok http 3000 --log /dev/null > /dev/null 2>&1 &
NGROK_PID=$!

node --env-file=.env --import tsx src/server.ts &
SERVER_PID=$!

sleep 2

URL=$(curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys,json; t=json.load(sys.stdin)['tunnels']; print(t[0]['public_url'] if t else '')")

if [ -z "$URL" ]; then
  echo "ERROR: ngrok failed to start" >&2
  exit 1
fi

echo ""
echo "========================================"
echo "  $URL"
echo "========================================"
echo ""

wait "$SERVER_PID"

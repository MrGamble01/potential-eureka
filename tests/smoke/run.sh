#!/usr/bin/env bash
# Smoke-test runner. Separate from tests/headless/run.sh on purpose:
# that battery discovers every *.js beside it, and other branches edit
# the discovery list. This suite stays in its own directory and CI job.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT="${PORT:-8123}"
BASE="${BASE:-http://127.0.0.1:${PORT}}"
export BASE

started=""
if ! curl -sf -o /dev/null --max-time 2 "${BASE}/index.html"; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/eureka-smoke-http.log 2>&1 &
  started=$!
  trap 'kill "$started" 2>/dev/null || true' EXIT
  ready=""
  for _ in $(seq 1 50); do
    if curl -sf -o /dev/null --max-time 1 "${BASE}/index.html"; then
      ready=1
      break
    fi
    sleep 0.1
  done
  if [ -z "$ready" ]; then
    echo "static server did not come up on ${BASE}" >&2
    cat /tmp/eureka-smoke-http.log >&2 || true
    exit 1
  fi
fi

cd "$ROOT/tests/smoke"
if [ ! -d node_modules/playwright ]; then
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
fi
if ! npx playwright install chromium; then
  echo "playwright chromium install failed" >&2
  exit 1
fi

node smoke.js

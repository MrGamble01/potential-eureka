#!/usr/bin/env bash
# Eureka Games — headless QA battery.
#
# Runs every re-runnable behavioral suite against a local server.
# Requirements: node, a global playwright install (npm i -g playwright)
# with a Chromium it can find, and a static server on $PORT:
#
#   python3 -m http.server 8099 --bind 127.0.0.1   # from the repo root
#   ./tests/headless/run.sh
#
# Each suite prints PASS/FAIL lines and a summary; this script exits
# non-zero if any suite fails. BASE / NODE_PATH may be overridden.
set -u
cd "$(dirname "$0")"

BASE="${BASE:-http://127.0.0.1:8099}"
export BASE
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"

# Order: the whole-site audit first (it catches page errors everywhere),
# then the cross-game guards (geometry, storage keys, corrupt saves),
# then the hub meta-layer, then the per-game suites.
#
# The per-game families (hv*, vox*) are DISCOVERED from this directory
# rather than listed here. They used to live on one line apiece, so every
# pair of PRs that each added a suite conflicted on that line even though
# neither touched the other's game. Adding a suite is now just adding a
# file. Order within a family doesn't matter; the lead list does.
LEAD=(
  nohooks aowrecords aowsession aowqueue
  audit
  wall
  pacing
  reach
  storagekeys
  saves
  hubstore
  promises
  meta20 daily rivals rivalsaow rivalsflag ach ach2 coins insights
  search resume theme focus shortcuts patchnotes backup hofcard
  undo2048 w5share cycles3
  labintro primer sessiontag hubhome objective controls
)
TRAIL=( pwa )

shopt -s nullglob
FAMILY=()
for f in hv*.js vox*.js; do FAMILY+=( "${f%.js}" ); done
shopt -u nullglob
if [ "${#FAMILY[@]}" -gt 0 ]; then
  mapfile -t FAMILY < <(printf '%s\n' "${FAMILY[@]}" | LC_ALL=C sort)
fi

SUITES=( "${LEAD[@]}" "${FAMILY[@]}" "${TRAIL[@]}" )

# A suite file that matches neither the lead/trail lists nor a family glob
# would be silently skipped — a new game's prefix (hvale*, say) is exactly
# how that happens. Fail loudly instead.
unlisted=()
for f in *.js; do
  n="${f%.js}"
  case " ${SUITES[*]} " in
    *" $n "*) ;;
    *) unlisted+=( "$n" ) ;;
  esac
done
if [ "${#unlisted[@]}" -gt 0 ]; then
  echo "run.sh: suite file(s) no list or glob covers: ${unlisted[*]}" >&2
  echo "        add the name to LEAD/TRAIL above, or extend the family globs." >&2
  exit 1
fi

fails=0
for s in "${SUITES[@]}"; do
  echo "===== $s ====="
  if ! node "$s.js"; then
    echo "!!!!! $s FAILED"
    fails=$((fails + 1))
  fi
done

echo
if [ "$fails" -eq 0 ]; then
  echo "ALL SUITES GREEN (${#SUITES[@]} suites)"
else
  echo "$fails SUITE(S) FAILED"
fi
exit "$fails"

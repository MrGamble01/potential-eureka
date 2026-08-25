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
# then the hub meta-layer, then the per-game suites.
SUITES=(
  audit
  meta20 daily rivals rivalsaow rivalsflag ach ach2 coins insights
  search resume theme focus shortcuts patchnotes backup hofcard
  undo2048 w5share cycles3
  hvweather hvdog hvregulars hvoddjobs hvrep hvsoup hvmural hvstash hvfire hvmeeting hvpetition hvticket hvsnap hvbusk hvdeposit hvnewcomer hvpantry hvcoats hvtoolbox hvcompost hvawning hvbarrel hvrainbet hvgarage hvborrow hvfridge hvrecord hvnote hvwall hvthermos hvboard hvpotluck hvstar hvshelf hvmarisol hvmugs
  voxcrow voxangler voxcompost voxflotsam voxstardust voxcat voxrainbow voxduck voxlight voxobs voxballoon voxdove voxwinter voxice voxferry voxsugar voxmuseum voxowl voxpig voxcrib voxjam voxcloud voxpolicy voxnote voxlantern voxbell voxbottle voxtablet voxconch voxwick voxfest voxwreath voxbeacon voxkeeper voxoar
  pwa
)

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

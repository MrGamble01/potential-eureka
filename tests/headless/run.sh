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
SUITES=(
  nohooks
  audit
  wall
  pacing
  reach
  storagekeys
  saves
  hubstore
  promises
  economy
  meta20 daily rivals rivalsaow rivalsflag ach ach2 coins insights
  search resume theme focus shortcuts patchnotes backup hofcard
  undo2048 w5share cycles3
  hvweather hvdog hvregulars hvoddjobs hvrep hvsoup hvmural hvstash hvfire hvmeeting hvpetition hvticket hvsnap hvbusk hvdeposit hvnewcomer hvpantry hvcoats hvtoolbox hvcompost hvawning hvbarrel hvrainbet hvgarage hvborrow hvfridge hvrecord hvnote hvwall hvthermos hvboard hvpotluck hvstar hvshelf hvmarisol hvmugs hvreunion hvsnapshot hvanniv hvnotebook hvbench hvstory hvballad hvcan hvpanel hvwalk hvmark hvdry hvhook hvintro
  voxcrow voxangler voxcompost voxflotsam voxstardust voxcat voxrainbow voxduck voxlight voxobs voxballoon voxdove voxwinter voxice voxferry voxsugar voxmuseum voxowl voxpig voxcrib voxjam voxcloud voxpolicy voxnote voxlantern voxbell voxbottle voxtablet voxconch voxwick voxfest voxwreath voxbeacon voxkeeper voxoar voxreunion voxframe voxmooring voxhlog voxbench voxyarn voxshanty voxchest voxmural voxpilot voxmark voxshed voxline
  pwa
)

# Preflight. Without this, a server that isn't up (or died mid-run) makes
# every one of the suites below fail with a connection error — ~128 red
# lines that read exactly like ~128 broken pages, after twenty-five minutes
# of spending Chromium on nothing. A battery that cannot tell "the site is
# broken" from "the server is down" spends the reader's trust on noise.
# Fail in two seconds with the reason instead. Exit 2, not 1: this is an
# environment problem, not a product failure, and the distinction is the
# whole point (see QA-24, and audit.js's environmental classifier).
if ! curl -fs -o /dev/null --max-time 5 "$BASE/index.html" 2>/dev/null; then
  echo "ENV: cannot reach $BASE — the battery needs a static server."
  echo "     From the repo root:  python3 -m http.server 8099 --bind 127.0.0.1"
  echo "     Or point BASE elsewhere:  BASE=http://host:port ./tests/headless/run.sh"
  exit 2
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

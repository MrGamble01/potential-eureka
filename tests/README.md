# Headless QA

Every feature in this repo ships with behavioral verification: a
Playwright + headless-Chromium script that drives the real page —
clicks, key presses, seeded saves, exact payout math — and exits
non-zero on any failure. This directory holds the **re-runnable**
battery; run it before and after any change.

## Running

```bash
# 1. deps (once): node + a global playwright with Chromium
npm i -g playwright
npx playwright install chromium   # or point PLAYWRIGHT_BROWSERS_PATH at an existing install

# 2. serve the repo root
python3 -m http.server 8099 --bind 127.0.0.1

# 3. run the battery
./tests/headless/run.sh
```

`BASE` (default `http://127.0.0.1:8099`) and `NODE_PATH` (default
`npm root -g`) can be overridden. Individual suites run standalone:
`node tests/headless/daily.js`.

## What's covered

| Area | Suites |
|---|---|
| Whole site | `audit` (loads every page + hub view, fails on console/page errors beyond the environment baseline), `pwa` (service worker, offline shell), `meta20` (hero/meta copy) |
| Hub meta-layer | `daily` (7-game shared-seed challenge), `rivals` + `rivalsaow` + `rivalsflag` (share codes incl. all six flagship records), `ach`/`ach2` (achievements + completionist), `coins`, `insights`, `search`, `resume`, `theme`, `focus`, `shortcuts`, `patchnotes`, `backup` (whole-arcade backup/restore), `hofcard` (PNG score card) |
| Hub games | `undo2048`, `w5share`, `cycles3` |
| Homeless Village | `hvweather`, `hvdog` (Biscuit), `hvregulars`, `hvoddjobs` |
| Voxel Isle | `voxcrow` (crows & scarecrow), `voxangler` (Angler's Log), `voxcompost` |

Suites that need a temporary `window.__*` test hook in a game file
(the hook is added for the test and stripped before commit) are
**one-shot by design** and are not in this battery — their results are
recorded in the merge commits that shipped each feature.

## Conventions

- Each suite is self-contained: it seeds `localStorage` in
  `addInitScript`, clears its own state on first load (guarded by
  `sessionStorage` so reload legs keep state), and asserts **exact**
  numbers computed in the same `page.evaluate` frame as the action —
  never across frames, where live sims drift.
- Randomness is pinned by swapping `Math.random` for one constant
  inside a single evaluate, chosen so the weighted branch under test is
  taken and the derived value is computable in the assertion.
- Every suite ends with a zero-page-errors check; `chromium.launch`
  uses `--no-sandbox --use-gl=swiftshader` so WebGL games run in CI
  containers.

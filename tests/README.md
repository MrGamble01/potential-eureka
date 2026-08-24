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
| Homeless Village | `hvweather`, `hvdog` (Biscuit), `hvregulars`, `hvoddjobs`, `hvrep` (Word on the Street), `hvsoup` (Soup Night), `hvmural` (the Underpass Mural), `hvstash` (the Hidden Stash), `hvfire` (The Fire Held), `hvmeeting` (the Camp Meeting), `hvpetition` (City Petitions) |
| Voxel Isle | `voxcrow` (crows & scarecrow), `voxangler` (Angler's Log), `voxcompost`, `voxflotsam` (flotsam & the Pier), `voxstardust` (stardust wishes), `voxcat` (cat gifts), `voxrainbow` (Rainbow's End), `voxduck` (the Duck's Dabble), `voxlight` (the Lighthouse), `voxobs` (the Observatory) |

Suites that need a temporary `window.__*` test hook in a game file
(the hook is added for the test and stripped before commit) are
**one-shot by design** and are not in this battery — their results are
recorded in the merge commits that shipped each feature.

## Last full run

2026-08-24 (QA-4, post-Round-Eight) — all **43 suites green**
end-to-end on the first pass, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment baseline
while three Round-Nine flagship tranches merged around the run. This
was the first battery carrying the four promoted Round-7/8 suites
(`hvmeeting`, `hvpetition`, `voxlight`, `voxobs`).

The previous full run: 2026-08-24 (QA-3, post-Round-Four) — all **35 suites green**
end-to-end, zero stale assertions this time; the whole-site audit held
its environment baseline mid-run while flagship tranches merged around
it. The previous full run (QA-2, Depth 29) caught exactly one stale
assertion: `hvdog` had pinned the befriend goal as the *last* ladder
rung, which HV-9/HV-10 outgrew — fixed to be position-agnostic. Prefer
"contains"-style assertions over position-pinning for anything later
features can append to.

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

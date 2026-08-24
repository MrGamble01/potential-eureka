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
| Homeless Village | `hvweather`, `hvdog` (Biscuit), `hvregulars`, `hvoddjobs`, `hvrep` (Word on the Street), `hvsoup` (Soup Night), `hvmural` (the Underpass Mural), `hvstash` (the Hidden Stash), `hvfire` (The Fire Held), `hvmeeting` (the Camp Meeting), `hvpetition` (City Petitions), `hvticket` (the Bus Ticket), `hvsnap` (the Cold Snap), `hvbusk` (the Busker's Guitar), `hvdeposit` (the Cart & the Deposit Run), `hvnewcomer` (the Newcomer), `hvpantry` (the Little Free Pantry), `hvcoats` (the Coat Rack) |
| Voxel Isle | `voxcrow` (crows & scarecrow), `voxangler` (Angler's Log), `voxcompost`, `voxflotsam` (flotsam & the Pier), `voxstardust` (stardust wishes), `voxcat` (cat gifts), `voxrainbow` (Rainbow's End), `voxduck` (the Duck's Dabble), `voxlight` (the Lighthouse), `voxobs` (the Observatory), `voxballoon` (Balloon Tours), `voxdove` (the Dovecote), `voxwinter` (the Winter Market), `voxice` (the Ice Hut & ice fishing), `voxferry` (the Ferry Landing), `voxsugar` (the Sugar Shack), `voxmuseum` (the Isle Museum) |

Suites that need a temporary `window.__*` test hook in a game file
(the hook is added for the test and stripped before commit) are
**one-shot by design** and are not in this battery — their results are
recorded in the merge commits that shipped each feature.

## Last full run

2026-08-24 (QA-7, post-Round-Fifteen) — **all 55 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the four promoted Round-14/15
suites (`hvnewcomer`, `voxferry`, `hvpantry`, `voxsugar`), and the
first run after two full rounds of features landed (Depths 101–113) —
the newest cross-feature seams (HV-22's pantry drip against the
older dawn suites, VOX-17's spring boils against `voxferry`'s
green-season dockings, LAB-24's halved sting odds against the party
suite's doubled ones) all held clean without pinning.

2026-08-24 (QA-6, post-Round-Thirteen) — **all 51 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment baseline.
First battery carrying the four promoted Round-12/13 suites (`hvbusk`,
`hvdeposit`, `voxwinter`, `voxice`), and the first run after the
Round-Thirteen features landed — notably the three cross-feature
seams QA-5 taught us to watch (HV-20's cans against the older
homeless-village suites, HVALE-17's fever against the hearthvale
weather legs, VOX-15's ice mode against `voxangler`'s casts) all held
clean without pinning.

2026-08-24 (QA-5, post-Round-Eleven) — **48 suites registered, 47
green on the first pass**. The one failure was real signal: HV-18's
new 25%-per-winter-dawn cold snap fired inside `hvweather`'s unpinned
matched-dawn legs (−10 warmth and a thinned panhandle roll), a
cross-feature interaction the battery caught exactly as designed. The
suite now pins the snap out (`SNAP_CHANCE = 0` — snaps have their own
suite, `hvsnap`) and re-ran green three times; the audit row held its
12/32 environment baseline throughout. First battery carrying the
four promoted Round-10/11 suites (`hvticket`, `hvsnap`, `voxballoon`,
`voxdove`).

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

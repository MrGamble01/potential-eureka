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
| Cross-game storage | `storagekeys` (every game reads back the localStorage keys it writes; no key claimed by two games on the shared origin) |
| Cross-game geometry | `reach` (UI-1/UI-2: every flagship control stays on screen at desktop, laptop, short-laptop and phone viewports) |
| Hearthvale | `hvalecam` (HVALE-53: the same phone viewport `reach` already tests Tycoon and Voxel Isle against — Chromium's `isMobile`+`hasTouch` emulation — threw a page error on every single Hearthvale load, because `cam`/`view` stayed `undefined` until `init()` ran while the canvas's pointer/wheel listeners were already live) |
| Purchase copy | `promises` (the numbers on things you buy match the code that implements them — Grow Op's nine upgrades and Voxel Isle's five building effects; found three wrong descriptions in Grow Op, one understated 5×) |
| Shared hub storage | `hubstore` (the hub root and the Hall of Fame both boot with a corrupt shared key — rivals, coins, stats, achievements; 6 of its 8 payloads are valid JSON, because the parse is not where this bug class lives) |
| Cross-game save integrity | `saves` (every flagship boots from a deliberately damaged save — 7 malformed shapes plus hostile numbers in real fields; found three boot crashes where a saved number was used as an array index unchecked. Each row also asserts the game actually *read* the key, so a drifted key list fails loudly instead of passing clean) |
| Homeless Village | `hvweather`, `hvdog` (Biscuit), `hvregulars`, `hvoddjobs`, `hvrep` (Word on the Street), `hvsoup` (Soup Night), `hvmural` (the Underpass Mural), `hvstash` (the Hidden Stash), `hvfire` (The Fire Held), `hvmeeting` (the Camp Meeting), `hvpetition` (City Petitions), `hvticket` (the Bus Ticket), `hvsnap` (the Cold Snap), `hvbusk` (the Busker's Guitar), `hvdeposit` (the Cart & the Deposit Run), `hvnewcomer` (the Newcomer), `hvpantry` (the Little Free Pantry), `hvcoats` (the Coat Rack), `hvtoolbox` (the Tool Box), `hvcompost` (the Compost Bin), `hvawning` (the Awning), `hvbarrel` (the Rain Barrel), `hvrainbet` (the Rain Bet), `hvgarage` (Marisol's Garage), `hvborrow` (the Borrowed Favor), `hvfridge` (the Corner Fridge), `hvrecord` (the Long Memory), `hvnote` (the Note in the Fridge Door), `hvwall` (the Writing on the Wall), `hvthermos` (the Old Thermos), `hvboard` (the Bulletin Board), `hvpotluck` (the Potluck), `hvstar` (the Chalk Star), `hvshelf` (the Community Shelf), `hvmarisol` (Marisol Drops By), `hvmugs` (the Spare Mugs), `hvreunion` (the Bridge Reunion), `hvsnapshot` (the Reunion Snapshot), `hvanniv` (the Bridge Anniversary), `hvnotebook` (the Spiral Notebook), `hvbench` (the Bench under the Bridge), `hvstory` (the Fire Story), `hvballad` (the Bridge Ballad), `hvcan` (the Coffee Can), `hvpanel` (the Fifth Panel), `hvwalk` (the Walk Down), `hvmark` (a Name on the Wall) , `hvintro` (HV-56: the first-run crash course, and a drift guard proving every number it quotes still matches the game) |
| Voxel Isle | `voxcrow` (crows & scarecrow), `voxangler` (Angler's Log), `voxcompost`, `voxflotsam` (flotsam & the Pier), `voxstardust` (stardust wishes), `voxcat` (cat gifts), `voxrainbow` (Rainbow's End), `voxduck` (the Duck's Dabble), `voxlight` (the Lighthouse), `voxobs` (the Observatory), `voxballoon` (Balloon Tours), `voxdove` (the Dovecote), `voxwinter` (the Winter Market), `voxice` (the Ice Hut & ice fishing), `voxferry` (the Ferry Landing), `voxsugar` (the Sugar Shack), `voxmuseum` (the Isle Museum), `voxowl` (the Owl Roost), `voxpig` (the Truffle Pig), `voxcrib` (the Corn Crib), `voxjam` (the Preserve Shed), `voxcloud` (the Cloud Wager), `voxpolicy` (the Assessor's Policy), `voxnote` (the Trader's Note), `voxlantern` (the Stone Lantern), `voxbell` (the Harvest Bell), `voxbottle` (the Message in a Bottle), `voxtablet` (the Tide Tablet), `voxconch` (the Keeper's Conch), `voxwick` (the Second Wick), `voxfest` (the Lantern Festival), `voxwreath` (the Shell Wreath), `voxbeacon` (the Beacon Flame), `voxkeeper` (the Old Keeper Rows Past), `voxoar` (the Spare Oar), `voxreunion` (the Shore Reunion), `voxframe` (the Driftwood Frame), `voxmooring` (the First Mooring), `voxhlog` (the Harbor Log), `voxbench` (the Harbor Bench), `voxyarn` (the Harbor Yarn), `voxshanty` (the Sea Shanty), `voxchest` (the Sunken Chest), `voxmural` (the Harbor Mural), `voxpilot` (the Pilot’s Walk), `voxmark` (Their Own Knot) |

Suites that need a temporary `window.__*` test hook in a game file
(the hook is added for the test and stripped before commit) are
**one-shot by design** and are not in this battery — their results are
recorded in the merge commits that shipped each feature.

## Last full run

2026-08-25 (QA-14, post-Round-Twenty-Nine) — **all 83 suites green
end-to-end**, zero stale assertions, with the audit row holding its
12/32 environment baseline. One flake on the first pass: the
`daily` suite's free-play-vs-daily maze-layout control tripped
under battery load (three slow free-play loads read back the same
lattice); the suite ran 13/13 green standalone immediately after,
and the full 83-suite battery was re-run end-to-end green — no code
fault, nothing changed. First battery carrying the two promoted second-story
suites (`hvboard`, `voxwick`) and the first run after the heirloom
round (Depths 199–204) and the second-story round (Depths 206–211)
landed whole — the six new cross-run keys (`tyc-ring`,
`growop-lighter`, `aow-standard`, `hv-thermos`, `hvale-hearth`,
`vox-conch`) proved fully isolated from the run saves the other
suites wipe at will, and the tier-2 thresholds (the second chair,
the gym annex, the officers' mess, the bulletin board, the rope
swing, the second wick) held their gates under the battery's
fresh-profile loads. The Tycoon, Grow Op, Age of War and Hearthvale
legs were verified by their own one-shot suites at merge time, as
always.

2026-08-25 (QA-13, post-Round-Twenty-Seven) — **all 79 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the two promoted almanac-round
suites (`hvwall`, `voxtablet`) and the first run after the letters
round (Depths 185–190) and the almanac round (Depths 192–197)
landed whole — the six new cross-run history keys (`tyc-history`,
`growop-history`, `aow-annals`, `hv-history`, `hvale-history`,
`vox-history`) proved fully isolated from the run saves the other
suites wipe at will, and both promoted suites held their tallies
under the battery's fresh-profile loads. The Tycoon, Grow Op,
Age of War and Hearthvale legs were verified by their own one-shot
suites at merge time, as always.

2026-08-25 (QA-12, post-Round-Twenty-Five) — **all 75 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the four promoted legacy- and
record-round suites (`hvfridge`, `voxlantern`, `hvrecord`,
`voxbell`) and the first run after the legacy round (Depths
171–176) and the record round (Depths 178–183) landed whole — the
new cross-run keys (`hv-fridge`, `hv-record`, `vox-lantern`,
`vox-record`) proved fully isolated from the run saves the other
suites wipe at will, and the VOX-27 `DOMContentLoaded` boot-paint
fix held for both isle chips under the battery's fresh-profile
loads. The Tycoon, Grow Op, Age of War and Hearthvale legs were
verified by their own one-shot suites at merge time, as always.

2026-08-25 (QA-11, post-Round-Twenty-Three) — **all 71 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the two promoted Round-23
suites (`hvborrow`, `voxnote`) and the first run after both the
insurance round (Depths 157–162) and the credit round (Depths
164–169) landed whole — the rounds' in-battery cross-feature
seams (the Borrowed Favor's dawn collection beside `hvgarage`'s
covered-sweep dawn and `hvrainbet`'s settlement, all three
priming the one-time survive-goal payouts so exact goodwill
deltas hold, and the Trader's Note's half-garnish beside
`voxpolicy`'s claim payouts on the same coin ledger) held clean
without pinning; the Hearthvale and Tycoon legs were verified by
their own one-shot suites at merge time, as always.

2026-08-25 (QA-10, post-Round-Twenty-One) — **all 67 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the two promoted Round-21
suites (`hvrainbet`, `voxcloud`) and the first run after the
wager round landed whole (Depths 150–155) — the round's
in-battery cross-feature seams (the Rain Bet's dawn settlement
against `hvweather`'s unpinned forecast promotion, with the
one-time survive-goal payouts primed so its exact goodwill
deltas stay exact, and the Cloud Wager's rain gates beside
`voxpig`'s shower-keyed truffle roots) held clean without
pinning; the Hearthvale and Tycoon legs were verified by their
own one-shot suites at merge time, as always.

2026-08-24 (QA-9, post-Round-Nineteen) — **all 63 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the two promoted Round-19
suites (`hvawning`, `voxcrib`) and the first run after the
architecture round landed whole (Depths 136–141) — the round's
in-battery cross-feature seams (the Awning's rain-day odds
against `hvweather`'s unpinned forecast rolls, and the Corn
Crib's softened peck against `voxcrow`'s full-bite raid
assertions, which stay true on a crib-less fresh save) held
clean without pinning; the Hearthvale and Tycoon legs were
verified by their own one-shot suites at merge time, as always.

2026-08-24 (QA-8, post-Round-Seventeen) — **all 59 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the four promoted Round-16/17
suites (`hvcoats`, `voxmuseum`, `hvtoolbox`, `voxowl`), and the
first run after two full rounds of features landed (Depths 115–127)
— the newest cross-feature seams (HV-24's tool box against
`hvweather`'s unpinned wobble rolls, VOX-19's night hunts against
`voxstardust`'s after-dark legs, HV-23's coat cut against the
matched-dawn drains in `hvweather` and `hvsnap`) all held clean
without pinning.

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

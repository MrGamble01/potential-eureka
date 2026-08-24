# EUREKA GAMES — Master Audit & Build Roadmap

*Original audit: July 2026. **Re-audited August 2026** — every P0 and P1 ticket
was re-checked against current source, and the site was exercised in headless
Chromium (11 standalone pages + all 14 arcade views). The P0/P1 backlog below
had been worked to completion in the intervening PRs. A second pass then closed
P2 and the last three stragglers, so **every ticket in this document is now
closed** — what remains is the P3 ideas backlog.*

*Line numbers drift as files change — treat them as starting anchors and
re-locate by the quoted identifiers.*

## How to use this document

Each ticket is self-contained and sized for **one PR**. Work top-down by
priority. For every ticket:

1. Read the cited file/lines and confirm the problem still exists (a quoted identifier is the anchor, not the line number).
2. Make the minimal fix described. Don't refactor beyond the ticket's scope.
3. Verify using the ticket's acceptance criteria before opening the PR.
4. One ticket per PR, ticket ID in the PR title (e.g. `TYC-1: fix triggerWin ReferenceError`).

Conventions to preserve: zero dependencies (no build step, no frameworks),
vanilla HTML/CSS/JS, games follow the `init()/start()/destroy()` module
contract used by the arcade shell in `index.html`.

**Before working a closed ticket below, re-verify.** The August re-audit found
that closed tickets can regress when new code lands — see A11Y-2, where a fix
was applied to the four cited pages and then reintroduced by two pages written
afterwards.

---

## Status at a glance

| Band | State |
|---|---|
| **P0** (3 tickets) | ✅ all closed |
| **P1** (28 tickets) | ✅ all closed — SITE-2 was the last, closed Aug 2026 |
| **P1 — new** (2 tickets) | ✅ found and closed by the August re-audit |
| **Still open** | ✅ none — all closed Aug 2026 |
| **P2** | ✅ all closed, DEBT-1 included |
| **P3** | ✅ **complete** — every concrete ticket shipped (Aug 2026); only the dashboard repurpose/rebrand product calls remain open |
| **P4** | self-directed polish backlog, opened Aug 2026 — see the P4 section |

> The July document listed 31 P0/P1 and most of P2 as open. Re-checking found
> nearly all of it already fixed. **Verify before working any ticket here** —
> and prefer checking behaviour in a browser over grepping for a marker, which
> produced two false readings during this pass (`<script defer>` and
> `--text-muted`).

---

## P0 — Incident-level · ✅ ALL CLOSED

| ID | Ticket | Verified closed by |
|---|---|---|
| SEC-1 | Real personal/employer data in `js/orgchart.js` | `PEOPLE` is now an explicitly fictional cast (Vex Pixelheart, Glitch Ramirez, …); page reframed as "Studio Crew". |
| SEC-2 | Personal PIN presented as security | Lock UI now carries an honest disclosure ("Casual screen lock only — entries are stored unencrypted in this browser"), and `unlock()` is no longer exported from `PersonalAuth`, so it can't be called to bypass the gate. |
| SEC-3 | Unescaped calendar event titles (XSS) | `js/calendar.js:143-144` runs `Utils.escHtml()` on both interpolations; the settings rows now assign `.value` instead of interpolating into `value="…"`. |

---

## P1 — Game-breaking bugs · ✅ ALL CLOSED

Re-verified against current source in August 2026. Kept for provenance — each
ID is still the anchor for its fix in git history.

**Startup Tycoon** — TYC-1 (`triggerWin` uses `formatTime`, no ReferenceError) ·
TYC-2 (`lsGet`/`lsSet`/`lsRemove` wrappers; every settings access guarded) ·
TYC-3 (beagle moved to `beagle-sim-v1` + its own version-sweep prefix) ·
TYC-4 (`computeDealValue` returns a finite fallback; `addCash` rejects
non-finite input) · TYC-5 (`clampToWalls` door predicate requires
`isOwnedGrid`) · TYC-6 (`state.lifetimeCash` never resets; achievements and
the landing pill read it) · TYC-7 (welcome modal gates on a pre-bonus
`_isFreshStart` snapshot) · TYC-8 (`bdr-corner` has `nextMode: 'ae-office'`).

**Beagle Sim** — BGL-1 (delivery target `ceoDeskPos.z + 1.0`) · BGL-2
(win-freeze fixed with the play.html change) · BGL-3 (`themeModalEl` closes on
Esc) · BGL-4 (favicon, OG tags and `.ea-back` chrome all present).

**Grow Op** — LAB-1 (`saveGame()` returns early when `busted`) · LAB-2 (chem
pipeline, per-plot growth and the carried item are all in the save schema) ·
LAB-3 (unaffordable paid choices are `disabled`; a failed `effect()` returns
`null` and keeps the event open) · LAB-4 (sim gated on `!activeEvent`) · LAB-5
(a redundant chemistry purchase is refused, not charged; the station relocates
into the Lab).

**Homeless Village** — HV-1 (`DAY_LENGTH_MS = 600000`, defined outside `G` so a
stale save can't shrink the day) · HV-2 (`sweep` excluded from the general
weighted pool) · HV-3/HV-4 (`G.activeCrafts` is both mutex and persisted state)
· HV-5 (three.js vendored, `onerror` fatal message, frame body wrapped in
try/catch with an error budget).

**Arcade** — ARC-1 (`e.repeat` guard) · ARC-2 (Snake/Tetris `destroy()` resets
and repaints the idle screen) · ARC-3 (`over || !running` on tap) · ARC-4
(`refreshArcadeBadges()` runs on boot, on `switchView('arcade')` and after
reset) · ARC-5 (monotonic `solveRun` token) · ARC-6 (hold runs the same
`collides() → endGame()` check as `lock()`).

**Site-wide** — SITE-1 (three.js vendored; all four 3D games run offline) ·
SITE-3 (tycoon/beagle settings keys namespaced with a one-time migration) ·
SITE-4 (links and redirects resolve without 308s or 404s) · SITE-5 (themed
`404.html`, cache headers, `robots.txt`, `sitemap.xml`, `X-Content-Type-Options`)
· SITE-6 (README rewritten) · **SITE-2 — closed August 2026**, see below.

### SITE-2 · Broken social share cards ✅ *(closed Aug 2026 — was the last open P1)*
`og:image` and `og:url` were root-relative on every page; the OG spec requires
absolute URLs and most scrapers reject relative ones. Fixed alongside three
gaps the original ticket predated: `hearthvale.html`, `voxel-garden.html` and
`agentic-os.html` had **no** `og:image`/`og:url`/`canonical` at all; canonicals
carried trailing slashes that `trailingSlash: false` 308-redirects away; and
`sitemap.xml` was missing `/hearthvale`. Hearthvale and Eureka Studio had only
inline-SVG placeholder posters (a `data:` URI can't be a share card), so both
got real 1200×630 captures in `assets/thumbs/`.
*Accept:* a share-card debugger shows the image on every page. ✅

---

## P1 — New, found by the August 2026 re-audit

### LOOP-1 · One bad frame froze Hearthvale and Startup Tycoon for good ✅ *(fixed)*
**Files:** `hearthvale.html` (`loop`, was `:4058`), `tycoon/play.html` (`loop`,
was `:8408`), and the since-retired `tycoon/beagle.html` (`loop`, was `:7639`)
— having to patch that third copy by hand is what finally motivated DEBT-1.

All three re-armed `requestAnimationFrame` as the **last statement of the frame
body**, with no `try/catch`. Any exception anywhere in the body therefore
skipped the re-arm and stopped the game permanently — no error, no motion, just
a still frame the player has no reason to think is broken.

This is the shape that made TYC-1 *fatal* rather than merely wrong: that ticket
fixed the one ReferenceError known to escape the loop but left the structure
that turned it into a hard freeze.

**Reproduced** in headless Chromium by poisoning a single mid-frame drawing
primitive (`CanvasRenderingContext2D.fillRect` / `WebGLRenderingContext.drawElements`)
once the game was running:

| Game | Loop structure | Before | After |
|---|---|---|---|
| Hearthvale | rAF last, no try/catch | 33 → **0 fps** | 31 → 31 |
| Startup Tycoon | rAF last, no try/catch | 18 → **0 fps** | 17 → 43 |
| Beagle Sim | rAF last, no try/catch | 19 → **0 fps** | 19 → 60 |
| Voxel Isle / Grow Op / Eureka Studio | rAF first | survived | survived |
| Homeless Village | try/catch + rAF last (HV-5) | survived | survived |

**Fix:** schedule the next frame first, run the body in `try/catch`, log and
skip a bad frame, and stop only on a persistent fault (10 bad frames) — with a
visible message and a reload button rather than a dead canvas. Tycoon and
Beagle save first. Same pattern as `homeless-village/js/main.js`'s `gameLoop`.
*Accept:* a thrown exception mid-frame leaves the game running. ✅

### LEAK-1 · Studio Crew and the dashboard ran forever in the background ✅ *(fixed)*
**Files:** `js/orgchart.js`, `js/dashboard.js:249-253`, `js/calendar.js:232`,
`index.html` (teardown map)

Neither view had a teardown entry, so leaving them stopped nothing they
started. `orgchart.js` tracked `rafId` but never cancelled it, leaving the
force-directed physics sim running at ~60fps for the rest of the session;
`dashboard.js` started five `setInterval`s (clock, stats, activity graph, quote
rotation, weather refetch) and `calendar.js` a sixth (a 5-minute calendar
refetch), none ever cleared.

**Measured:** leaving Studio Crew for the arcade left rAF running at roughly
double the arcade's own rate (34 → 64/sec); the six timers stayed live
indefinitely.

**Fix:** the shell calls a view's `init()` exactly once, so a plain `destroy()`
would have left a dead canvas and a frozen clock on return. Each module now
exposes an idempotent `destroy()`/`resume()` pair, and `switchView` tears down
on exit and resumes on re-entry.
*Accept:* rAF returns to baseline on exit and revives on re-entry (38 → 32 →
38/sec); dashboard live intervals go 7 → 1 → 7. ✅

---

## Still open

**Nothing.** Every ticket in this document is closed as of August 2026 — P0,
P1, P2, and the three that were still open at the start of that pass (A11Y-2,
THUMB-1, DEBT-1). What remains is the P3 ideas backlog, which is optional
feature work rather than outstanding defects.

### ~~A11Y-2 · `user-scalable=no` came back on the two newest game pages~~ ✅ *(closed Aug 2026)*
`hearthvale.html` and `voxel-garden.html` both carried `user-scalable=no`
(Voxel Isle also `maximum-scale=1.0`) — the WCAG 1.4.4 violation A11Y-1 had
already removed from the four pages it cited, reintroduced by two pages written
afterwards.

Dropping the viewport flag alone would have been cosmetic compliance: both
games also set `touch-action: none` on **body**, which suppresses browser zoom
page-wide on its own, so the flag would clear while nothing changed for a
reader. The fix was therefore scoping, not deleting — `touch-action: none`
moved from `body` to the game canvas, where it is genuinely load-bearing
(Hearthvale reads raw drags to pan, Voxel Isle two-finger pinches to zoom the
camera). Everything outside the canvas is ordinary DOM again.
*Accept:* pinch-zoom works on the page ✅ — verified on an emulated touch
device: body and HUD compute `touch-action: auto`, both canvases keep `none`,
and a drag across each canvas still moves the view, so neither game lost input.

### ~~THUMB-1 · Hearthvale's arcade card used a placeholder SVG~~ ✅ *(closed Aug 2026)*
Swapped to the real `assets/thumbs/hearthvale.jpg` added by SITE-2, picking up
`loading="lazy"` and intrinsic dimensions like every other card. Eureka Studio
was the only other card still on a `data:` URI and `studio.jpg` already existed
for its share card, so it got the same treatment. No inline-SVG posters remain,
and `index.html` shed 4.3KB of markup that used to parse on every visit.

### ~~DEBT-1 · `beagle.html` was still a fork~~ ✅ *(closed Aug 2026)*
`tycoon/beagle.html` is gone. Beagle Sim is now a **build variant** of
`play.html`, resolved once at boot from `?theme=beagle`.

The fork had drifted much further than this document recorded: play.html was
9,280 lines to beagle's 8,244, so Beagle was missing ~1,550 lines of
improvements (the Dashboard, first-person mode, the valuation chip, the season
card). Its one apparent extra — the active "Treats" dosing panel — was the
superseded design play.html deliberately replaced with the passive Adderall
Cabinet amenity, so collapsing the fork lost nothing and brought Beagle forward.

Measured, the real divergence was small: 3 room numbers, 2 balance constants,
one starting-cash value, and a copy layer.

**A variant is not a THEME.** Themes are a runtime re-skin the player toggles
from settings; a variant is chosen at boot, owns its own save key, and never
appears in the picker — switching mid-run would swap the save out from under
the player. `default` overrides nothing, so the base build is unchanged.

One bug was found doing it: the save-version sweep was hard-coded to
`startup-tycoon-v`, so with a variant save key **Beagle's first boot would have
deleted the player's Startup Tycoon save.** The prefix is now derived from the
active key, and both saves are proven to coexist.
*Accept:* playing Beagle leaves the tycoon save byte-identical ✅ (16/16 variant
assertions, 6/6 save-safety assertions).

### ~~A11Y-1 · The rest of the accessibility batch~~ ✅ *(verified closed Aug 2026)*
Every sub-item was checked in the live DOM rather than by grep, and all pass:

| Sub-item | Result |
|---|---|
| `--text-muted` contrast | already lifted `#484F58` → `#8b949e`; **6.15:1** against the darkest surface (`#0d1117`), 6.74:1 against `#020203` — passes AA. The old value was 2.28–2.50:1. |
| `aria-live` on status/score readouts | 15 regions |
| `role="dialog"` on tycoon modals | 10/10 |
| `aria-modal` on tycoon modals | 10/10 |
| `:focus-visible` on `.arcade-card` / `.game-controls` | present; cards are real `<a>` elements |
| `prefers-reduced-motion` | 2 CSS blocks, plus `js/effects.js` and `ageofwar.js` |
| card previews on `focusin`, not hover-only | wired |

The `user-scalable=no` half is tracked separately as A11Y-2 and is still open.

### ~~PERF-3 · Home-page loading~~ ✅ *(closed Aug 2026)*
All three parts are now done:
- **Fonts** — already moved out of `base.css` to a `<link>` + `preconnect`.
- **Scripts** — already done, and an earlier draft of this document got it
  wrong. All **25 of 25** local `<script>` tags in `index.html` carry `defer`;
  `grep -c '<script defer'` returns 0 only because the attribute follows `src`.
  The single inline block that calls into their globals is correctly wrapped in
  a `DOMContentLoaded` listener.
- **`@import` chain** — closed. `css/style.css` was eight `@import`s and
  nothing else, costing a second serial round trip before any styled paint;
  `index.html` and `404.html` now link the eight sheets directly in the same
  order and the aggregator is deleted. Measured with 120ms emulated latency:
  2 serial waves → 1, CSS complete 954ms → 748ms (−22%), one request fewer.
- **Posters** — already carry `loading="lazy"` and intrinsic dimensions.

### ~~SITE-3 (remainder) · Document the localStorage key registry in the README~~ ✅ *(closed Aug 2026)*
The README now carries the key registry under "Stack", with a note to add and
namespace a key when adding a game. Three separate mute keys (`arcade-muted`,
`aow-muted`, `tycoon:sfxEnabled`) remain by design — each game owns its mute.

---

## P2 — High-value improvements

*Corrections from the August re-audit are marked inline.*

**~~DEBT-2 · Schema-driven save/load for Tycoon~~** ✅ **done** — `play.html`
now has a declarative `SAVE_SCHEMA` driving both save and load, a real `v`
version gate, and a "save failed" toast in place of a bare `catch {}`.

**~~DEBT-3 · Shared arcade plumbing (`js/utils.js`)~~** ✅ **done** —
`Utils.whenViewActive`, `Utils.gameLoop`, `Utils.highScore` and
`Utils.showGameOver` all exist.

**~~DEBT-4 · Save-on-hide everywhere~~** ✅ **done** — Tycoon, Beagle and Grow
Op all register `visibilitychange`(hidden) and `pagehide` saves.

**~~PERF-1 · HiDPI canvases~~** ✅ **done** — all seven arcade canvases and Age
of War scale their backing store by `devicePixelRatio`.

**DEBT-1 · Delete `beagle.html` as a fork; make it a theme.** Still open — see
"Still open" above.

**~~PERF-2 · Age of War hot loop~~** ✅ **done** — the unit loop and
`fireTurrets` were bucketed per side once per frame by earlier work, `reset()`
now drops `boss_*` entries so the `UNITS` catalog stops growing across runs,
and `MAX_UNITS_PER_SIDE` (150) caps population. The August re-audit found the
projectile collision scan had been missed — it still rebuilt a filtered array
per projectile per frame — and converted it to the same buckets: 40.2µs →
6.6µs per frame at 300 units / 40 projectiles (6.1×), verified equivalent and
exercised with 60s of live combat.

**~~PERF-3 · Home-page loading~~** ✅ **done** — see "Still open" above for the
breakdown.

**~~GAME-1 · Age of War feel/fairness batch~~** ✅ **done — all six** (verified
Aug 2026, each marked in-source with its `GAME-1x` tag):
(a) base hits reuse the unit-vs-unit projectile path, so ranged attackers fire a
visible projectile and melee hits get sparks + sound + shake;
(b) `comboT` pauses during the wave breather, so a streak survives the boundary;
(c) the settings-modal difficulty switch calls `reset()` like the HUD switch,
closing the `win_hard`/`win_insane` exploit;
(d) the passive trickle scales with the difficulty's `goldMult`;
(e) `dropCoins` gives the flooring remainder to the last coin, so the coins sum
to the kill's reward exactly;
(f) `ageUp` no longer clamps hero cooldown.

**~~GAME-2 · Homeless Village completeness pass~~** ✅ **done** — the whole
ticket has been overtaken. Player input landed (IDEA-HV-1: WASD/arrows, player
branched out of the NPC wander array, bounds clamp, blur handler). The Workbench
is now a real gate (`requires:'workbench'` on tent, soup kitchen and garden).
Sweeps destroy the garden outright, matching its own description. The
`matchMedia` fold-in has a `change` listener so rotating a phone re-lays-out.
Mobile no longer hides the log — it's shrunk and repositioned instead.
*Still missing:* a touch joystick, so mobile remains input-less.

**~~A11Y-1 · Site-wide accessibility batch~~** ✅ **done** — all sub-items
verified in the live DOM; see the table above. The `user-scalable=no` half is
tracked separately as A11Y-2 and remains open.

**~~BAL-1 · Small verified balance/UX fixes~~** ✅ **done** — spot-checked Aug
2026: the Breakout ball speed is capped (`BALL_SPEED_MAX`) and its paddle
`mousemove` is bound to the canvas, not `document`; Grow Op's heat scales with
quantity (`addHeat(heatGainPerSale(qty))`) and `STASH_MAX_BASE` is enforced on
load and on pickup; Tycoon's joystick has pointer-id guards and Hire Engineer
refunds on a failed spawn.

One straggler was fixed during the re-audit: the **external** engineer hire
spent the cash and then ignored `spawnIdeaWorker()`'s return, unlike the
in-house hire immediately above it. Both callers pre-check for a free desk with
the same predicate `spawnIdeaWorker` uses, so it isn't a reproducible money
loss — but two adjacent handlers spending the same way should fail the same
way, and an unguarded spend is the exact shape this ticket flagged.

---

## P3 — Ideas backlog (each = one PR, pitched for mid-tier builders)

### Site-wide
- **~~IDEA-SITE-1 · PWA/offline arcade~~** ✅ **shipped Aug 2026** — manifest + icons + dependency-free `/sw.js` precaching the whole shell (incl. vendored three.js). Verified with the HTTP server killed outright: hub reloads, arcade plays, both 3D pages boot, clean URLs fall back to cached .html. (Testing note: Playwright's `setOffline` does not gate SW-originated fetches — kill the server to test offline for real.)
- **~~IDEA-SITE-2 · Zero-backend shared leaderboards~~** ✅ **shipped Aug 2026** — `js/rivals.js`: checksummed base64url codes carrying all numeric bests + a name, shared as `/#hof=<code>` links (the router treats them as an import and cleans the hash so reloads can't double-import) or pasted into the HOF; each game row shows the best rival mark, lit when the rival leads (Minefield compared low-is-better); capped at 8 rivals, same-name re-imports update in place.
- **~~IDEA-SITE-3 · Daily challenge~~** ✅ **shipped Aug 2026** — `js/daily.js` seeds mulberry32 from `<game>:<YYYY-MM-DD>`; layout-determining call sites in Snake/Tetris/2048/Maze/Asteroids route through it (cosmetic particles and UFO timing deliberately stay on `Math.random` — fps-dependent consumption would desync the layout stream); dated bests in `arcade-daily-<game>-<date>` swept on boot; hub banner chips show today's bests. Verified: two fresh sessions get identical boards/mazes, free-play controls differ. Still pairs with SITE-2 codes when those land.
- **~~IDEA-SITE-4 · Achievements~~** ✅ **shipped Aug 2026** — declarative 16-entry `js/achievements.js` checked against the HOF's own localStorage keys on boot and every view switch (no per-game hooks needed — runs end in navigation); queued toast pills; trophy case at the bottom of the HOF; unlocks persist with timestamps and never re-lock.
- **~~IDEA-SITE-5 · Arcade coins + cosmetics~~** ✅ **shipped Aug 2026** — achievements mint 10🪙 apiece (retroactive, idempotent paid-ledger); the HOF Coin Shop sells accent palettes as `:root[data-accent]` swaps of the primary token family, declared after the SITE-6 theme blocks so accents compose with themes.
- **~~IDEA-SITE-6 · Theme system~~** ✅ **shipped Aug 2026** — `:root[data-theme=crt|synthwave|daylight]` overriding the primitive tokens in base.css; 🎨 cycler by the SFX toggle; pick persisted with a FOUC-free head script; light-preferring systems default to Daylight. Game canvases keep their own palettes by design.
- **~~IDEA-SITE-7 · Gamepad support~~** ✅ **shipped Aug 2026** — `js/gamepad.js` polls `getGamepads()` per frame and dispatches the same synthetic `KeyboardEvent`s the Tetris touch pad already uses (dpad/left stick → arrows, A → Space, B → Escape, Start → Enter), with keyboard-style auto-repeat on held directions (`repeat:true`, so games' own `e.repeat` guards keep working) and a full key-release sweep when the pad unplugs mid-hold.
- **~~IDEA-SITE-8 · Local-only "Insights"~~** ✅ **shipped Aug 2026** — `js/telemetry.js` records launches/seconds per hub game (plus per-day totals) to `eureka-stats`, accrued on view switches/tab-hides/unloads with a 6h sanity cap; "📊 Your Arcade" panel in the HOF (plays, time, favourite, streak, busiest day, per-game bars) with the privacy note stated outright. No network.
- **~~IDEA-SITE-9 · "Studio Crew" page~~** ✅ **shipped** — the org-chart viz was
  rebuilt around a fictional dev-team cast and now ships as Studio Crew.

### New arcade games (follow the `init/start/destroy` + `#view-<name>` + `HOF_GAMES`/teardown contract)
- **~~IDEA-ARC-1 · Minesweeper: Neon~~** ✅ **shipped** as **Minefield**
  (`js/minesweeper.js`) — first-click-safe, chording, three difficulties,
  per-difficulty best times in the HOF.
- Also shipped since this list was written, though never on it: **Drop Four**
  (`js/connect4.js`, minimax + alpha-beta) and **Word Five** (`js/word5.js`).
- **~~IDEA-ARC-5 · Light Cycles~~** ✅ **shipped Aug 2026** — vs a flood-fill-dodging AI or local 2P on one keyboard; simultaneous claim-then-judge movement (head-ons kill both); `cycles-streak` in the HOF. New views must ALSO be added to `viewFromHash`'s whitelist in index.html — the router rejects unknown hashes.
- **~~IDEA-ARC-2 · Memory Matrix~~** ✅ **shipped Aug 2026** — Simon on a 3×3 grid (`js/memorymatrix.js`): pentatonic pad tones via the new `SFX.note()`, playback that tightens with the round, keys 1-9 or tap, `matrix-best` in the HOF. **Lesson for new games:** the hub already contains a hidden legacy `<canvas id="matrix-canvas">` (effects.js's Matrix rain, `index.html:45`) — the game originally drew into that invisible canvas and its tests "passed" against the same wrong element; game DOM ids are namespaced `mm-*` now. Check for id collisions against the whole hub, not just your own view.
- **~~IDEA-ARC-4 · Pong++~~** ✅ **shipped Aug 2026** — `js/pong.js`: first to 7 vs a rubber-banding AI or 2P on one keyboard, with drifting power-ups claimed by the ball for its last hitter (paddle grow 8s, turbo-until-next-hit, three-ball split); `pong-streak` in the HOF; edge hits send steep shots, which is how you beat the speed-capped AI (verified by playing a full tracked match to a 7-6 win).
- **~~IDEA-ARC-3 · Stacker~~** ✅ **shipped Aug 2026** — `js/stacker.js`: slide-and-drop tower with overhang slicing, tumbling debris, 5px PERFECT snaps with pitched streak jingles, camera follow past 12 floors; `stacker-best` in the HOF and the Rivals codes.
- **~~IDEA-ARC-7 · Vector Defense~~** ✅ **shipped Aug 2026** — `js/vectordefense.js`, scope capped as pitched: fixed neon S-path, ⚡ Pulse + ▭ Rail (full row-and-column beam) turrets, ten waves, ten lives, `vector-best` in the HOF/Rivals/insights.
- **~~IDEA-ARC-6 · Word Cascade~~** ✅ **shipped Aug 2026** — `js/wordcascade.js`: Wordtris on the gravity/lock loop with a ~1,900-word 3-5 letter dictionary, Scrabble-ish letter values × length × chain scoring, column-collapse cascades, and `cascade-best` in the HOF. That closes every game on the ideas list — the arcade is at twenty.

### Startup Tycoon
- **~~IDEA-TYC-1 · Second floor "R&D Lab"~~** ✅ **shipped Aug 2026** — the elevator's Lab card unlocks for $15k; up to three researchers ($2k/$8k/$18k) file patents on a shared 90-researcher-second clock, each a permanent +2% on `computeDealValue()` capped at +30%, surviving IPOs; `LabFloor` finally gives `FLOOR_CLASSES` a second registrant (research ticks from the main loop — no camera swap yet, the card is the lab's window).
- **~~IDEA-TYC-2 · Save export/import~~** ✅ **shipped Aug 2026** — settings buttons produce/accept base64url save codes tagged with the build variant (a Beagle code is refused by Startup Tycoon with directions, and vice versa); import reloads through the TYC-4-hardened loadGame path rather than a second parser.
- **~~IDEA-TYC-3 · Rival startup race~~** ✅ **shipped Aug 2026** — named ghost competitor on a second goal-hud bar, ~22-minute pace with gentle rubber-banding; beating it pays +5% of the goal, losing costs the team -10 morale (gentler than the pitched "lose an engineer" — deleting a purchased worker punished a passive event too hard); persists mid-season, new season → new rival.
- **~~IDEA-TYC-4 · Board meeting events~~** ✅ **shipped Aug 2026** — every ~4 minutes a timed choice card (Pivot / Crunch / Wellness Week / Buyback) with 20s to decide before the board tables it; effects run on their own multipliers threaded into `computeDealValue()` and the engineer rate product; never convenes over another open modal.
- **~~IDEA-TYC-5 · Employee XP/levels~~** ✅ **shipped Aug 2026** — one XP per shipped feature; L2-L5 at 5/15/35/75 ships with titles (Beagle Sim promotes Pup → … → Legend) and +4% work rate per level in the main rate product; XP persists with the roster save; hover readout shows the title.
- **~~IDEA-TYC-6 · Office pets~~** ✅ **shipped Aug 2026** — stockless amenity ($2,500, 2 engineers): wanders desk to desk on `stepToward`, +2 team morale every 45s via `changeMorale`, tail wag and all; Beagle Sim gets a 🐈 Office Cat since its workers are the beagles.
- **~~IDEA-TYC-7 · Bug outbreaks~~** ✅ **shipped Aug 2026** — 7% per engineer ship: the desk goes 🐛 and works at half speed until clicked, which runs an 8s hotfix (zero feature work, 🔧 countdown label, click consumed before tap-to-move). Implemented as a rate multiplier + fixingT timer rather than a new S.FIXING state — the worker keeps their seat and animations. Bugs deliberately don't save.
- **~~IDEA-TYC-8 · Prestige shop~~** ✅ **shipped Aug 2026** — the 🏛 Founder Shop: one point per IPO, spent on Serial Founder (+$500/season), Angel Network (+25% funding) and Founder U (hires start at L2, riding TYC-5); lives in the namespaced settings key so it survives fresh saves and Beagle Sim banks its own.
- **~~IDEA-TYC-9 · Win share-card~~** ✅ **shipped Aug 2026** — 📸 button in the win modal downloads a 1200×630 PNG (season/title, goal headline, 3×2 stat grid with ★ PB flag, seeded confetti) drawn on an offscreen canvas from stats frozen in `triggerWin()`. Variant-aware: Beagle Sim cards carry its name, 🐶 mark, orange accent and `?theme=beagle` URL. Shipped without waiting on TYC-1 — nothing in it depended on the R&D floor.

### Age of War
- **~~IDEA-AOW-1 · Endless/Survival mode~~** ✅ **shipped Aug 2026** — ∞ Endless toggle by the difficulty chips; razing the stronghold rebuilds it at 1.5× with a scaling bounty and advances an era; score is waves survived; `aow-best-run` finally has a writer and the run-over screen shows the record.
- **~~IDEA-AOW-2 · Prestige "Relics"~~** ✅ **shipped Aug 2026** — every game-over pays relics from run totals (gold/800 + kills/25 + 3 on wins) into `aow-relics`; the run-over screen's Relic Vault surfaces `runStats.gold` at last and sells three one-shot next-run perks (War Chest, Reinforced Gate, Veteran Cadre — the last riding AOW-5) that `reset()` applies and consumes.
- **~~IDEA-AOW-3 · 6th era "Singularity"~~** ✅ **shipped Aug 2026** — gated behind `max_age` exactly as pitched (the banner explains the lock); 25k-XP ascent, three units + Phase Wall + beam turret + The Avatar hero. The pipeline did "mostly just work" — the exception was five-row presentation tables (OG_SKY et al), where the sixth era's sky lookup threw until every table grew a row. Lesson recorded: adding an era means auditing every `[eraIdx]` lookup, not just ERAS/UNITS.
- **~~IDEA-AOW-4 · Wall/Barricade unit~~** ✅ shipped Aug 2026 (one wall per era, `role:'wall'` skips the whole combat branch, enemy AI never fields them, meager kill rewards) · **~~IDEA-AOW-5 · Unit veterancy~~** ✅ shipped Aug 2026 (25s = Veteran +10% dmg, 60s = Elite +20%, gold chevrons above the HP bar, all four attack sites flow through `vetDmg()`) · **~~IDEA-AOW-6 · Turret targeting modes~~** ✅ shipped Aug 2026 (Near/Weak/Strong cycle per turret, mode survives upgrades) · **~~IDEA-AOW-7 · Overtime sudden-death~~** ✅ shipped Aug 2026 (warning at 5:30, both bases chip from 6:00 at 2 hp/s +2 per 30s of overtime; classic mode only — endless is exempt).

### Drug Lab
- **~~IDEA-LAB-1 · Offline catch-up~~** ✅ **shipped Aug 2026** — saves carry `savedAt`; absences of 60s+ grow plants (self-capping at ripe) and drain heat (passive drain only — never a bust in absentia), summarized by a 🌙 toast + feed entry.
- **~~IDEA-LAB-2 · Give Runners a purpose~~** ✅ **was already shipped** — this entry was stale: runners hire, respawn from saves, ferry trim/chem product to the stash, and close deals with a heat-85 guard. Confirmed live ("Runner stashed 5 bags").
- **~~IDEA-LAB-3 · Prestige "New Identity"~~** ✅ **shipped Aug 2026** — a $2k+ bust forges +4% street prices forever (empire completion forges two identities), capped at six (+24%), in `growop-legacy` which survives the save wipe; surfaced in the bust modal, the difficulty modal and a resume status line.
- **~~IDEA-LAB-4 · Pre-raid bribe window~~** ✅ **shipped Aug 2026** — one bribe offer per heat approach (12% of totalEarned, $400–$25k), re-arming only under heat 90; broke players find the exit disabled (LAB-3 rules) and refusing fires the raid.
- **~~IDEA-LAB-5 · Difficulty pick~~** ✅ **shipped Aug 2026** — fresh runs choose 🐢 Careful (the classic balance) or 👑 Kingpin ($150 start, +25% sale price, 1.5× heat gain, 0.75× drain, 1.3× ambient) via one DIFF() table; persisted per save, 👑 suffix on the act badge, busts re-offer the pick.
- **~~IDEA-LAB-6 · Achievements → Hall of Fame~~** ✅ **shipped Aug 2026** — eight milestones in `growop-achievements` (separate key so they survive busts), HOF row shows "$X earned · N achievements", card badge falls back to "N 🏅".
- *Tone note:* the in-game copy ("10 to 15, no deal", "harder product") is markedly darker than its all-ages home-page framing ("GROW OP · Builder/3D/Risk"). Either soften toward the site's satirical register or add a small content note on the card.

### Homeless Village
- **~~IDEA-HV-1 · Real player movement~~** ✅ **shipped** — `main.js` now has
  WASD/arrow control with the player branched out of the NPC wander array, plus
  bounds clamping and a blur handler so keys can't stick. Mobile got its input
  with HV-2's tap-to-walk (Aug 2026).
- **~~IDEA-HV-2 · Proximity-gated scavenging~~** ✅ **shipped Aug 2026** — scavenging requires standing within 3.2 units of a dumpster; the button dims with a 🚶 hint out of range and refusals explain themselves in the log. Ships with tap-to-walk (ground-plane raycast → walk target, keys always win), which finally gives mobile an input method and makes the diorama actual playspace. The Scrapper's daily auto-scavenge is deliberately not gated.
- **~~IDEA-HV-3 · A resolvable arc~~** ✅ **shipped Aug 2026** — the Case Worker arc: three staged milestones checked in `onNewDay()` (day 10 + goodwill → Dena's card; Soup Kitchen + 4 residents → housing paperwork; 25 goodwill + morale > 60 → KEYS IN HAND), ending overlay with both doors (new camp / acknowledged sandbox via `arcDone`), one-line framing intro on fresh camps, "🔑 housed" on the hub HOF row, and the Panhandle tooltip de-editorialized.
- **~~IDEA-HV-4 · "Pack Up Camp" action~~** ✅ **shipped Aug 2026** — the warning banner has a live countdown and a PACK UP CAMP button: 5 morale to keep 75% of what the sweep would take. Also fixed in passing: a save written mid-warning used to restore `sweepWarned:true` forever, silently blocking all future lookout warnings.

### Dashboard leftovers (all still reachable via "⋯ more" — decide their fate)
- Repurpose `dashboard.js`'s widget grid as **Studio Stats** (real cross-game localStorage telemetry instead of fake CPU/MEM numbers); rebrand todo/pomodoro as a public **Dev Log**; retarget bookmarks as a **Dev Toolbox**; **cut or truly hide** the personal journal (see SEC-2). ~~Pomodoro tick-drift~~ ✅ **fixed Aug 2026** (wall-clock deadline + visibility resync), ~~org-chart rAF + dashboard's six intervals never stop~~ ✅ **fixed — see LEAK-1**, ~~geolocation opt-in~~ ✅ **fixed Aug 2026** (asked only on click, consent remembered in `eureka-weather-optin`). The repurpose/rebrand decisions (Studio Stats, Dev Log, Dev Toolbox, the journal's fate) remain open product calls.

---

## P4 — Self-directed polish backlog (opened Aug 2026)

With P0-P3 closed, work continues on quality-of-life and depth. Shipped so far:

- **~~P4-HUB-1 · "Jump back in" row~~** ✅ — telemetry-powered quick-resume chips on the hub (last played + top games), hidden until there's history.
- **~~P4-SNAKE-1 · Power-ups~~** ✅ — 🟨 gold (2× for 15s), 👻 ghost (tail-phasing 8s), 🐌 slow (+30ms tick relief); deterministic cadence (every 7th food) so daily runs stay shared-fate.
- **~~P4-DAILY-1 · Minefield joins the daily~~** ✅ — seeded mine shuffle (identical first clicks → identical boards), min-direction daily best (fastest clear), sixth banner chip.
- **~~P4-HUB-2 · Card search/filter~~** ✅ — filter box over the grid matching titles + tags, live count, Esc clears, keydown isolated from game hotkeys.
- **~~P4-TETRIS-1 · Next-piece queue~~** ✅ — 3-piece preview (on-deck bright, two dimmed) with the bag untouched, so daily sequences are unchanged.
- **~~P4-VD-1 · Turret sell/upgrade~~** ✅ — owned-pad selection, 3 damage tiers (0.8×base×1.8^tier pricing), 70%-of-spend sell, tier pips.
- **~~P4-A11Y-1 · Modal focus management~~** ✅ — `Utils.trapFocus` (focus-first, Tab wrap, restore-on-close via MutationObserver) wired into the hub's `openModal`; Tycoon got a local twin observing all 11 of its modals.
- **~~P4-AOW-1 · Relic vault on the pause screen~~** ✅ — 🏺 HUD button opens the pause overlay, which now hosts the vault (count, perks with ARMED state, "restart with perks"); purchases stopPropagation so buying never resumes; background click still resumes.
- **~~P4-WC-1 · Inflection tier~~** ✅ — regular plurals (+s/+es), past tense (acted/baked/begged) and gerunds (acting/baking/digging) of dictionary words count, ≤7 letters, with a function-word stop-list so "thes"/"ands" stay dead.

The P4 idea list is fully burned down; the next backlog gets authored
when new play-testing surfaces friction.

## P5 — Second polish pass (opened Aug 2026)

- **~~P5-2048-1 · One-step undo~~** ✅ — Z / ↩ button restores the pre-move board+score (works as a post-game-over mercy too); daily runs never get a snapshot, keeping seeded scores honest.
- **~~P5-W5-1 · Emoji share grid~~** ✅ — 📋 Share copies a spoiler-free "Word Five n/6" 🟩🟨⬛ grid, clipboard API with an execCommand fallback.
- **~~P5-HOF-1 · PNG score card~~** ✅ — 🖼 Score card renders the board (accent dots, bests, achievements+coins footer) to a 2× canvas and offers the PNG inline + as a download; zero-dependency data URLs.
- **~~P5-LC-1 · Third AI rider~~** ✅ — Riders: 2/3 toggle adds a gold AI cycle; N-rider collision judge, round runs until ≤1 alive, survivor-based verdicts.
- *(scoped and dropped: Pong 2P, Minesweeper chording, Breakout power-ups, Asteroids UFO, Tetris hold — all already shipped in earlier passes.)*

## P6 — Resilience & mercy pass (opened Aug 2026)

- **~~P6-SITE-1 · Whole-arcade backup/restore~~** ✅ — ⬇ Backup dumps every localStorage key to `eureka-backup-<date>.json`; ⬆ Restore validates, confirms with count + date, writes and reloads. Full-origin dump means new games are covered with no key registry to forget.
- **~~P6-AST-1 · Hyperspace~~** ✅ — H / ↯ WARP teleports with zeroed velocity, 40-frame blink, ~5s cooldown; 40 rolls for a 70px-clear landing then takes the risk, READY/RECHARGING indicator. Math.random by design in daily runs (wall-clock-triggered, seeding would desync the rocks).
- **~~P6-MM-1 · Three lives~~** ✅ — a wrong pad burns a heart and replays the same pattern; the third miss ends the run. Hearts in the HUD, matrix-best semantics unchanged.

## P7 — Variety & discoverability pass (opened Aug 2026)

- **~~P7-BRK-1 · Shaped wall layouts~~** ✅ — WALL/CHECKER/DIAMOND/PILLARS/ARCH/RUBBLE cycle with the level (per-cell predicates over the 11-col grid), layout name flashes at each build.
- **~~P7-HUB-3 · ? shortcuts cheat-sheet~~** ✅ — focus-trapped dialog listing every arcade hotkey; ?, Esc, backdrop and Close all dismiss; ignored while typing in inputs.
- **~~P7-MAZE-1 · Par-time medals~~** ✅ — par = rows·cols/20+3s; 🥇 +200 under par (lifetime tally in `maze-golds`), 🥈 +80 under 1.6×; par + tally live in the status bar.
- *(scoped and dropped: Tetris ghost piece, Connect-4 2P/difficulty, SFX mute, Stacker perfect-streak, Voxel Isle offline growth — all already shipped.)*

## Flagship depth — studio focus (opened Aug 2026)

*Directive: no new games — deepen the main titles. Each entry is a full
gameplay system for one flagship, verified headless before merge.*

- **~~HVALE-1 · Hearthvale: Wolves at the Door~~** ✅ — the cozy builder's first stakes: wolf packs prowl the cold seasons from day 8 (year-round on Frontier, never on Cozy). Dawn sighting → full day to prepare → next-dawn resolution against the watch. New Watchtower building (tier 1, worker = keeper, level = pack it can hold), packs scale with population, three outcomes with a morning-report event card, wolf pixel-sprites lurking at the wood's edge after dark, 2 achievements + a goal, watch/next-raid rows in the inspect panel, full save/load.
- **~~LAB-7 · Grow Op: the street market~~** ✅ — sale price was a constant, so *when* to sell was never a decision. Street demand now drifts (0.75×–1.35×) and periodically breaks into 🔥 surges (1.5×–1.8×) or 🚔 crashes (0.6×–0.75×) with toast + Dispatch announcements, all shown on a live HUD demand chip. Same heat, very different money — timing matters. Neutral long-run average; persisted.
- **~~HV-5 · Homeless Village: weather & the forecast~~** ✅ — each dawn brings a season-weighted sky (clear / rain / cold snap / heat wave) touching warmth drain, panhandle odds, dumpster yields and the garden. Tomorrow's weather is rolled a day ahead and revealed by the Lookout or a new craftable 📻 Radio — preparation becomes an informed call. Legacy saves migrate.
- **~~AOW-9 · Age of War: War Trials~~** ✅ — five one-time relic bounties over stats every run already tracks (win without aging up / without turrets / without a hero, win under 8 minutes, survive 10 endless waves). No pre-selection or mid-run enforcement: finish a run and whichever feats it achieved are honoured once each (+3–5🏺), with banner lines on the victory screen and a progress board in the pause-screen Relic Vault. Persisted in `aow-trials`.
- **~~HV-6 · Homeless Village: Biscuit, the stray dog~~** ✅ — a staged companion arc (deterministic, like the Case Worker): a wary stray appears at the fence on day 4 and joins two days later if the camp can spare food. One food a day buys +2 morale, +3 night warmth, a wider panhandle window (fed dog only), theft losses halved, and — with no Lookout hired — a 15-second bark warning before sweeps that would otherwise land unannounced. 3D dog mesh, 🐕/🐕💢 HUD badge, new goal, legacy saves migrate.
- **~~LAB-8 · Grow Op: big buyer contracts~~** ✅ — once past the garage act, a buyer occasionally cold-calls: move N units inside a 90–135s window and the lot pays a clean completion bonus (0.6–1.0× list value) with no extra heat. Passing costs nothing; accepting and blowing the deadline is +6 heat, because word gets around. Regular street sales fill the order, so a contract is a bet on your pipeline's throughput. Offer panel with a 25s shot clock, live 📦 n/N countdown HUD, persisted mid-contract. (Also fixed: the LAB-7 demand chip was rendered on top of the heat meter — the right HUD rail is now properly stacked, with a mobile slot.)
- **~~HVALE-2 · Hearthvale: villager mastery~~** ✅ — every production cycle actually worked earns the worker 1 craft XP; rank thresholds (⭐ Journeyman 12 / 🌟 Master 36 / ✨ Grandmaster 80) multiply their building's output ×1.1/1.2/1.3, applied through the same rounding chain as morale and decrees. XP belongs to the villager, not the building. Rank-up toasts, mastery rows in both inspect panels (with exact +% and progress-to-next), the HUD net-per-cycle readout stays honest, a "Train a Journeyman" goal, a Master of the Craft achievement, and XP persisted per villager.
- **~~HVALE-4 · Hearthvale: wolf pelts & the Furrier~~** ✅ — repelling a raid now pays forward: the watch banks one pelt per wolf in the pack (the morning report says so), and a new 🧥 Furrier (tier 3, staffed, industry tab) works one pelt per production cycle into 12 gold and +1 town happiness — warm coats all around. No pelts, no coats: the Furrier idles honestly in both production and the HUD net readout, its panel shows the bench, 🏆 Warm Coats lands on the first pelt worked, and pre-Furrier saves migrate to an empty bench.
- **~~HVALE-3 · Hearthvale: natural talents~~** ✅ — the eight villager natures were pure flavor; now each carries a mechanical gift, so who works where becomes a matching puzzle on top of mastery: 💪 Hardworking +10% anywhere · 🌱 Green thumb +15% at farms/windmills · 🍞 Gourmand +15% at food trades · 👋 Friendly +10% where a supply chain is live · 🔍 Curious halves their workshop's consumption · 💭 Dreamer earns double mastery XP · 😊 Cheerful +1 town happiness per worked cycle · 😴 Sleepyhead −10% output but +1 happiness. Both inspect panels explain the gift; the HUD net-per-cycle readout stays honest.
- **~~SITE · Patch notes~~** ✅ — the studio's changelog, in the product: a 📰 PATCH NOTES button beside the Hall of Fame link opens a modal with the release log (newest first, hand-curated, player-facing language) covering the whole Flagship Depth campaign. Esc/backdrop close, lazy render, `eureka-v7` rolls it to installed PWAs.
- **~~SITE · The flagship leaderboard + eureka-v6 rollout~~** ✅ — all six flagships now ride the rival share codes via per-game `read()` hooks over their JSON saves: Age of War ∞ waves, Startup Tycoon lifetime cash, Hearthvale peak villagers, Homeless Village days survived, Grow Op lifetime earnings, Voxel Isle coins earned — one code carries the whole studio's records, corrupt blobs drop out harmlessly. And `SW_VERSION` bumps to **eureka-v6**, rolling every Flagship Depth system out to installed PWAs (the cache-first shell had been pinned at v5 since before the campaign).
- **~~AOW-12 · Age of War joins the rival share codes~~** ✅ — the hub's zero-backend leaderboards covered only hub games; now `aow-best-run` rides the share code as "Age of War ∞ · N waves" via a per-game `read` hook in the rivals table (the endless best lives as JSON, so it carries its own reader instead of the default parseInt). Corrupt values read as 0 and drop out of the payload instead of crashing the encode.
- **~~AOW-11 · Age of War: relic vault expansion~~** ✅ — trials and councils mint relics faster than three perks could spend them, so the vault gains two with mid-run teeth: 🥁 March Drums (5🏺, units train 15% faster all run) and 🔥 Forge Credit (6🏺, the first turret of the run is free, one-shot with a gold-floater callout). Carried by a new `runPerks` armed in reset() before the one-shot pendingPerks consume, so the existing at-the-starting-line perks are untouched.
- **~~AOW-10 · Age of War: War Councils~~** ✅ — endless mode's roguelite layer: every 5 waves survived (right after each boss falls), the council convenes and offers a pick of two run-long boons — 💰 War Chest (+25% kill gold), ⚔️ Sharpened Steel (+10% unit damage), ⛑️ Field Medics (2 HP/s unit regen), 🧱 Masons (3 HP/s base repair). The enemy holds while the choice is open (the wave breather is pinned), keys 1/2 pick, taken boons badge the wave HUD, and a full table pays +5🏺 tribute instead. Boons reset with the run — the permanent layer stays the relic vault's job.
- **~~VOX-3 · Voxel Isle: the compost heap~~** ✅ — a sink for surplus goods with an agricultural payoff: a new ♻️ town building (380🪙, level 5, slatted voxel bin with a mound and a sprout). Tap it to feed it 5 stockpiled goods (cheapest first) and every growing crop surges +15% of its grow bar — ripening runs through the normal stage transition so boosted crops still roll golden. 60s cooldown, refusals explain themselves, 🏆 Black Gold at five spreads.
- **~~VOX-2 · Voxel Isle: the Angler's Log~~** ✅ — the pond's catches now have names, weights and history: every real species (Perch, Sunfin, Crab, Puffer) rolls a size on the reel-in, per-species counts and record weights live in the Almanac's new 🎣 log (??? until first caught), record-breaking catches call it out on the float text, and a new ultra-rare 🎏 Golden Koi (120🪙, 2–8kg) headlines the pond. Two achievements: 🏆 The Golden One and 🏆 Compleat Angler (all five species).
- **~~HV-8 · Homeless Village: the bulletin board~~** ✅ — one posted odd job a day, rotating deterministically with the date (unload at the depot, hand out flyers, weed the community lot, sort at the scrapyard, walk the neighbor's dogs), rendered as an extra action button with themed payouts bigger than the grind actions. Once done it locks with a ✓ until the next dawn re-posts the board; done-state persists and pre-HV-8 saves migrate open.
- **~~HV-7 · Homeless Village: the regulars~~** ✅ — three named neighborhood figures (🌮 Marisol at the taquería, 🎖️ Old Ray on the bridge bench, 🩺 Dee off the night shift) whose affinity grows through actions you already take: trading, resting, panhandling. Knowing someone (1+) puts a name to the ??? in the new Community roster; friendship (5+) unlocks a standing favor — morning tamale drops (+2–4 food, 30%), scavenge empty-hauls halved, and a +10-health patch-up when you're under 30 (every 3 days). Persisted in G with legacy-save migration.
- **~~LAB-10 · Grow Op: pure batches~~** ✅ — Cooks get the identity upgrade Lookouts got: every finished batch rolls purity (10% base, +15% per Cook, to 55% with three), and pure bags sell for 1.6× list. The ✨ count travels the same physical route as the product — cook-station pool → carrier (player or runner) → stash → sale — with sparkle counts on the station and stash labels, pure-first sale accounting in the feed, ledger clamps on stings and stash-burning events, and persistence with load clamps.
- **~~LAB-9 · Grow Op: undercover stings~~** ✅ — past the garage act, ~1 in 8 "buyers" is an undercover cop, and the feed gives no tell. Sell to one (walk into them, or let an unwarned runner close the deal) and the bags are seized for $0 with a +15 heat spike. A hired Lookout makes the wire on sight — the buyer label flips to 🚨 and runners refuse the deal — turning the Lookout from a passive heat sink into the difference between a close call and a raid. Unserved cops drift off after 25s.
- **~~VOX-1 · Voxel Isle: a murder of crows~~** ✅ — the 🎃 scarecrow was pure decor; now it has a job. Every minute or two (never in winter) a voxel crow lands on a growing, unguarded crop — ignored for ~18s it pecks 35% of the grow bar away and flees. Tap it to shoo it (🏆 Crow Patrol at five), or post a scarecrow to guard everything within 6 blocks. First sighting explains itself; how-to updated; counters ride the existing wholesale state save.
- **~~TYC-12 · Startup Tycoon: on-site engagements~~** ✅ — the opposite trade from acqui-hires: post-IPO, an enterprise client occasionally asks for the team on-site. Accept and engineering runs at half speed for 60 seconds (a 0.5× factor in the same work-rate product), then a guaranteed lump payment lands — current revenue rate × 2 minutes × 1.3, min $2k, locked at accept time. 🧳 countdown chip on the goal bar, offers defer to open modals and the acqui pitch, an in-flight engagement survives reload via its own SAVE_SCHEMA entry.
- **~~TYC-11 · Startup Tycoon: acqui-hires~~** ✅ — post-IPO, a struggling startup occasionally comes up for sale (Yeet Robotics, Kombucha OS, dog-themed names in Beagle Sim): pay 8% of the season goal inside a 30s window to fold its team in for a permanent +3% work-speed multiplier, stacking to five. A 🏷️ ×N chip on the goal bar lists the portfolio; offers never interrupt another modal; the whole stack persists through the same product-of-factors work-rate line as climates and board effects.
- **~~TYC-10 · Startup Tycoon: season climates~~** ✅ — every post-IPO season rolls a market climate (AI Boom, Funding Winter, Talent War, Hype Cycle, Headwinds, Steady Quarter) modifying work speed and deal value through the same product-of-factors pattern as board meetings; goal-bar chip, season-card announcement, persisted. Season 1 always neutral.
- **~~TYC-17 · Startup Tycoon: the Alumni Network~~** ✅ — losing a retention battle stops being pure loss. Every engineer who ever walked (TYC-14's `poachesLost`) becomes an **alum who vouches for you** from their new desk: fresh hires and poach backfills start with **+1 XP per alum, capped at +5** (one full seniority level), stacking on top of the Founder Shop's Campus floor — through one `alumniXp()` helper both grant sites share, TDZ-guarded so boot-time spawns can't trip on it. The walk feed announces the network once it exists, and 🏆 Old Friends lands at five hoodies out in the world. The roster already rode the TYC-14 save entry, so persistence came free. Verified one-shot via a temporary hook (6 assertions: campus floor at zero alumni, +3 at three, the +5 cap at ten, reload), hook stripped, page smoke-tested clean, audit at baseline.
- **~~AOW-17 · Age of War: the Lodestone relic~~** ✅ — the Relic Vault gains its sixth perk. Coins already auto-credited after a 3-second fade, but latency is money in a tempo game — and silent credits never fed the Collector tallies. The 🧲 **Lodestone** (4🏺, one run, armed from the vault like Drums/Forge): **coins leap to your purse the moment they land** (0.25s instead of 3s) and every lodestone pickup **counts as collected** — so the 🪙 Collector achievement and the coin War Trial fill hands-free for the run. Gold-colored floaters distinguish leapt coins from faded ones. Verified one-shot via a temporary hook (7 assertions through the real reset/arming path with a seeded landed coin: the 3s wait and silent no-tally credit without it, the 0.3s leap with tally with it, one-shot consumption), hook stripped, page smoke-tested clean, audit at baseline.
- **~~LAB-15 · Grow Op: the Security Post earns its keep~~** ✅ — the last decor-only room falls. The 👁️ Security Post ($4k, act 2) was a floor style; now owning it gives the Lookouts monitors, radios and sightlines: **every hired Lookout counts ×1.5** wherever they matter — passive heat drain (`0.4/s` each → effectively `0.6/s`) and Corner-Wars poach suppression (−10% each → −15%, still floored at 5%) — through one `lookoutPower()` helper both formulas share, so future lookout effects inherit the Post automatically. The wire-on-sight sting tell already only needed *a* lookout, so it's untouched. Switch-on toast + Dispatch line, 🏆 Eyes Everywhere (the Post plus a two-Lookout crew), rides the existing `ownedRooms` save. Verified one-shot via a temporary hook (11 assertions: raw vs sharpened drain and poach to the digit, the 5% floor, buy flow, reload + trophy), hook stripped, page smoke-tested clean, audit at baseline. **Every purchasable room in Grow Op now does something.**
- **~~HVALE-10 · Hearthvale: Schoolhouse apprenticeships~~** ✅ — the 📚 Schoolhouse drew families but taught nobody its whole life. Now it runs **night classes**: with one standing, **every worked production cycle teaches +1 extra mastery XP** on top of the worker's own pace — a steady hand learns 1→2 per cycle, a 💭 Dreamer 2→3 — feeding straight into the HVALE-2 mastery ladder (Journeyman → Master output bonuses) so a school town outskills a schoolless one roughly twice as fast. An unfinished school teaches nobody; the desc and a "Night classes" inspect-panel row say exactly what it does. Verified one-shot via a temporary hook (6 assertions through the real `runProduction` path: base pace, +1 with the school, half-built school inert, XP riding the save), hook stripped, page smoke-tested clean, audit at baseline.
- **~~SITE · Flagship Saga v2~~** ✅ — the Hall of Fame's 🏰 Saga cards learn everything the last two rounds taught the flagships: Tycoon shows **retreats held**, Grow Op shows **rooms owned** (once the empire is more than a garage), the Village card earns a **🎨 mural finished** chip at four panels, Hearthvale adds **caravans home** and **bell saves**, and Voxel Isle counts its **cat gifts** — every chip still read straight (and read-only) from each game's own save, appearing only when the counter exists. The committed `insights` suite's seeded flagship saves grew the new fields with two new assertion legs (17/17 green), and `SW_VERSION` → **eureka-v13** so installed PWAs refresh the cached telemetry module.
- **~~SITE · Round Five patch notes + eureka-v12~~** ✅ — the changelog stays current: a "Round Five" release entry (the Caravan · the Penthouse brand · the Trophy Shelf · the Last Stand · the Hidden Stash · Rainbow's End) leads the 📰 PATCH NOTES modal, `SW_VERSION` bumps to **eureka-v12** so installed PWAs pick up Flagship Depth 38–43, the committed `patchnotes` suite's newest-release assertion moves with it, and all six README flagship blurbs gain their round-five feature. Suites re-run green (patchnotes 8/8, pwa 8/8), audit at baseline.
- **~~VOX-7 · Voxel Isle: Rainbow's End~~** ✅ — the rainbow that arcs over the isle when a shower clears was pure spectacle; now it's a *market window*. While the arc holds (24 seconds), **everything sells +25%**: crop harvests (rounded after the in-season +40%, so a seasoned harvest under a rainbow really stacks) and livestock cash-ins (through the same `sellMult()` chain as the Trader's Market) alike. The arc announces its own window with a toast, 🏆 Pot of Gold lands on the first sale made under one, and the hook-free `voxrainbow` suite (8 assertions of exact premium math through both sale paths) joins the committed battery — now **37 suites**. Weather finally touches the economy.
- **~~HV-12 · Homeless Village: the Hidden Stash + QA-3~~** ✅ — the camp's defenses were all reactive (pack up, Biscuit's bark); the 🕳️ **Hidden Stash** is the one you dig in advance. A Workbench recipe (4🪵 3🧱 2📦): a buried cache under the fence line that **halves what thieves and sweeps take**, stacking multiplicatively with Biscuit's barking (theft down to a quarter) and Pack Up (a swept, packed, stashed camp loses almost nothing) — and the hole itself is never found, by anyone. Hook-free `hvstash` suite (10 assertions of exact floor math across all four stacking combinations) joins the committed battery. **QA-3** in the same tranche: the second full end-to-end battery run — **all 35 suites green**, zero stale assertions, the audit holding its baseline mid-run while four flagship tranches merged around it.
- **~~AOW-16 · Age of War: the Last Stand~~** ✅ — losing runs used to just… lose. Now, **once per run**, the moment the base first drops below a quarter of its health, the garrison rallies on its own: **every friendly unit heals half its max HP** and **earns the Veteran stripe on the spot** (+10% damage — the stripe is earned tonight), with a 🚩 LAST STAND banner, screen shake and flash. It's an automatic drama beat, not a button: checked right before the defeat condition so the rally fires the moment the line breaks, spent for the run whether or not it saves you, and re-armed by reset. 🚩 Hold the Line marks the first time a player sees it. Verified one-shot via a temporary hook (8 assertions: exact 30%→80% heal with cap math, stripe grant, once-per-run, ach unlock, reset re-arm), hook stripped, page smoke-tested clean.
- **~~TYC-16 · Startup Tycoon: the Trophy Shelf~~** ✅ — season trophies were a badge count in the corner; now the shelf *pays*. Every season won adds **+2% deal value** — a `trophyBonus()` term in the same `computeDealValue()` single-source-of-truth chain as prestige, product versions, board effects, patents and climates — **capped at +20%** at ten trophies, so the late-late game gets a reason to keep winning seasons without runaway compounding. The 🏆 badge's tooltip now names the premium ("3 seasons won — the shelf pays: +6% deal value"), and 🏆 Dynasty lands at three seasons won. `trophiesWon` already rode its own SAVE_SCHEMA entry, so persistence came free. Verified one-shot via a temporary hook (8 assertions: bare shelf, +6%/+20%/cap ladder, the ×1.2 lift landing through the rounded deal chain, tooltip copy, reload), hook stripped, page smoke-tested clean.
- **~~LAB-14 · Grow Op: the Penthouse brand~~** ✅ — the 👑 Penthouse was the second decor-only room (a $50k goal trophy, nothing more). Now moving upstairs means the operation has a *name*: **every sale pays ×1.1** — a brand term slotted into the same `salePrice()` floor-math chain as bags, premium product, the chem bonus, difficulty, legacy and the market, so it flows honestly into street sales, big-buyer contracts and even the rival's payoff demand. Move-in gets its own toast + Dispatch line ("nobody haggles with the man in the penthouse"), 🏆 The View From the Top joins the Hall-of-Fame trophy key, and the room rides the existing `ownedRooms` save untouched. Verified one-shot via a temporary hook (8 assertions: bare-formula match, exact ×1.1 floor math, buy flow, reload + trophy key), hook stripped, page smoke-tested clean.
- **~~HVALE-9 · Hearthvale: the Caravan~~** ✅ — the Market gains the campaign's first **invest-and-wait** verb. Load a caravan (15 food + 15 wood, one on the road at a time) from the Market's panel and it rolls out for the far towns, returning **three days later with 70 gold and +3 happy** — if the road is kind. One trip in five is **waylaid** (25 gold limps home, −3 happy) — unless a **staffed watchtower** lends outriders, cutting the odds to 8%, so the watch earns its keep between raids too. Departures and both kinds of return make the Town Chronicle, 🏆 Friend of Far Roads at three caravans seen home, a mid-flight caravan rides the save with legacy migration. Verified one-shot via a temporary hook (15 assertions incl. the same 0.1 roll robbed unguarded / safe with outriders), hook stripped, page smoke-tested clean.
- **~~SITE · Round Four patch notes + eureka-v11~~** ✅ — the changelog stays current: a "Round Four" release entry (the Flagship Saga · the Underpass Mural · cat gifts · the Chapel Bell · the Retreat · the Laundry Front · Mercenary Contracts) leads the 📰 PATCH NOTES modal, `SW_VERSION` bumps to **eureka-v11** so installed PWAs pick up Flagship Depth 30–36, the committed `patchnotes` suite's newest-release assertion moves with it, and all six README flagship blurbs gain their round-four feature. Suites re-run green (patchnotes 8/8, pwa 8/8), audit at baseline.
- **~~AOW-15 · Age of War: Mercenary Contracts~~** ✅ — gold could always buy tempo (Warcry) and walls (Plating); now it buys **boots on the ground, instantly**. The 🪖 Mercs button (hotkey **M**) skips the training queue entirely: pay **2.5× the cost of your best current-age fighter** and two of them walk on the spot — **as Veterans** (the AOW-5 +10% damage stripe, same as the Cadre relic's opening squad), with a **60-second rearm** that no bankroll shortens. Broke hires and full ranks are refused with named floaters, the button reads the live price (`225g` in Age I, scaling with every age-up), `runStats.mercs` feeds 🏆 Soldiers of Fortune (3 contracts in one run), and reset zeroes both the tally and the rearm. Verified one-shot via a temporary hook (11 assertions: priciest-fighter selection, 2.5× price, broke/cooldown refusals, instant veteran spawns, era escalation, reset), hook stripped, live button smoke-tested, audit at baseline.
- **~~LAB-13 · Grow Op: the Laundry Front earns its rent~~** ✅ — the 💈 Laundry Front was the one purchasable room with no mechanics: $20k of pure decor. Now owning it launders the whole operation's profile: **every heat GAIN lands a quarter lighter** (×0.75 in `addHeat`, stacking multiplicatively with Crunch Mode's ×1.5 tax to a net ×1.125 — the night shifts are still a bet, just a better-covered one) and **passive heat drain gains a flat +0.35/s** — customers coming and going are the best cover there is, so every cop on the block has a reason you're there. Purchase gets its own toast + Dispatch line, 🏆 Fresh Linen joins the Hall-of-Fame trophy key, and the room rides the existing `ownedRooms` save untouched. Verified one-shot via a temporary hook (11 assertions: exact ×0.75 / crunch-stack / reduction-untouched heat math, the drain term, reload persistence), hook stripped, audit at baseline.
- **~~TYC-15 · Startup Tycoon: the Retreat~~** ✅ — the late game's missing trade: cash now for a *better team* after. Post-IPO, HR occasionally finds a cabin upstate (⛺, 30s window): book it for **max($2k, revenue-rate × 1.5)** and the office empties for 60 seconds at **quarter speed** — then everyone returns **+3 XP sharper** (three ships' worth, riding the TYC-5 ladder toward L5) with **every open bug squashed** on the ride home. A broke booking is refused with the shortfall named; the ⛺ chip counts down the offsite then flips to a lifetime tally; offers defer to every other modal and inbound offer (and all four of those now defer to the retreat too); an in-flight retreat and the tally ride their own SAVE_SCHEMA entry with clamps; 🏆 Team Building at three. Verified one-shot via a temporary hook (14 assertions incl. mid-retreat reload at quarter speed), hook stripped, audit at baseline.
- **~~HVALE-8 · Hearthvale: the Chapel Bell~~** ✅ — the Chapel's 🔔 was pure flavor; now it earns its stone. On a raid night the watch can't hold, a finished Chapel **rings the town awake**: food losses are **halved** (both the outmatched-watch and no-watch-at-all breaches) and the happiness hit softens (−4→−2, −10→−6) — the bell can't fight, but it buys time to bar the larders. Event text and the chronicle credit the bell, `bellSaves` counts the bad nights it softened (shown on the chapel's inspect panel), and 🏆 Saved by the Bell marks the first. Festivals gain a **bell peal** too: +4 happy on top of the +20 when a chapel stands. Watch-holds nights are untouched — the bell never steals the watch's credit (or its pelts). Verified one-shot via a temporary hook (13 assertions: exact halving, both counters, festival math, migration), hook stripped and the shipped file smoke-tested clean.
- **~~VOX-6 · Voxel Isle: cat gifts~~** ✅ — the Tavern cat was pettable decor; now the petting *goes* somewhere. Five hellos and it trusts you: every few minutes it drops a little cloth **bundle** wherever it happens to be ambling, sitting patiently (bobbing gently) until tapped. Usually feathers, string and pocket change (+8–17 🪙); often a **good for the stockpile** (the same goods economy the wholesaler buys); rarely **a ring lost long ago** (+45 🪙, the cat looks very pleased with itself). First drop explains itself, `catPets`/`catGifts` ride the save spread with the cat's trust intact across reloads, 🏆 Little Hunter at five bundles, how-to updated — and the hook-free `voxcat` suite (13 assertions) joins the committed battery.
- **~~HV-11 · Homeless Village: the Underpass Mural~~** ✅ — the camp's first project that isn't about surviving the night. Once the neighborhood knows you (Known, rep 25+), a 🎨 session appears on the action list: one a day, 2 scraps of salvaged paint each, filling one of **four mural panels** on the bridge pillars — each session +3 morale, +2 rep, with a narrated stage line (and a friend among the regulars comes by to paint). The finished wall is the point: **+2 morale every dawn**, panhandle success ×1.1 (people slow down to look), sweep morale loss softened by 5 — because they can tear down tents, not paint; the mural itself always survives. "Finish the community mural" joins the goal ladder, panels persist through the save with pre-HV-11 migration, and the hook-free `hvmural` suite (19 assertions) joins the committed battery.
- **~~SITE · Depth 30: the Flagship Saga + eureka-v10~~** ✅ — the Hall of Fame's "Your Arcade" insights only knew about hub games; the six flagships, where the real campaigns live, were invisible. A 🏰 FLAGSHIP SAGA strip now renders below the arcade bars: one card per flagship **save found in this browser**, each a row of lifetime stat chips read straight (and read-only) from the game's own localStorage key — Age of War's best endless run, kills and banked relics; Tycoon's lifetime earnings, launches shipped, poaches fought and season; Grow Op's earnings, contracts and rival run-ins; the Village's days survived, soup nights and street rep; Hearthvale's age, peak population, chronicle pages and raids repelled; Voxel Isle's coins, level, flotsam and wishes. A flagship never played contributes nothing, no telemetry + no saves still renders the panel empty, and the committed `insights` suite grew five seeded-save assertions (including a saga-only leg in a fresh profile). `SW_VERSION` → **eureka-v10**.
- **~~QA-2 · First full end-to-end battery run~~** ✅ — the committed 34-suite `tests/headless/run.sh` ran end-to-end for the first time: **34/34 green** (~339 assertions) after it caught exactly one stale assertion — `hvdog` had pinned the befriend goal as the *last* goal-ladder rung, which HV-9/HV-10 legitimately outgrew. Fixed position-agnostic, re-ran 21/21, and the lesson ("contains, don't pin, for anything features can append to") plus a "Last full run" record now live in `tests/README.md`. The five stale flagship blurbs in the main README were also rewritten to campaign depth in the same tranche.
- **~~HVALE-7 · Hearthvale: the Root Cellar~~** ✅ — the season loop's missing verb: *store*. A new 🫙 workerless building (tier 2, 14🪵 10🪨) that runs itself on the calendar: each **autumn** production cycle it pickles up to 2 food of the surplus above a 3-per-head buffer into preserves (12 jars per level — the buffer is sacred, a lean pantry never gets raided for jars), and each **winter** cycle it opens 3 jars back into the pantry, exactly when the fields lie fallow at −40%. Jar-count floaters both ways, a Preserves row in the inspect panel with season-aware copy, per-building jars riding the save mapping, 🏆 Waste Not on a full 12-jar bench.
- **~~SITE · Patch notes round 3 + eureka-v9 rollout~~** ✅ — the changelog stays current: a "Round Three" release entry (Bastion Plating · Crunch Mode · stardust wishes · Soup Night · The Poach · the Cobbled Way) leads the 📰 PATCH NOTES modal, and `SW_VERSION` bumps to **eureka-v9** so installed PWAs pick up Flagship Depth 22–28. The committed `patchnotes` suite's newest-release assertion moves with it.
- **~~LAB-12 · Grow Op: Crunch Mode~~** ✅ — one lever, two edges: flip 🌙 NIGHT SHIFTS on and the whole operation runs **30% faster** (grow plots and the chem station share the same factor — offline catch-up included), but **every heat GAIN lands 1.5× harder**. Reductions — bribes, lawyers, lying low — are untouched, so crunching is a bet that you can outrun the attention you're attracting, and it compounds with everything: contract deadlines get easier, stings get scarier, the Kingpin difficulty gets a whole new gear. Fixed toggle chip with an ON glow, toast + Dispatch lines on every flip, the lever rides the save.
- **~~AOW-14 · Age of War: Bastion Plating~~** ✅ — gold always bought offense (units, turrets, heroes); now it can buy walls. A plating card rides at the end of the Turrets tab rack: three tiers ($150 / $350 / $700), each shaving **10% off damage the player base takes** — melee and projectiles alike, capped at −30%, with the overtime whistle deliberately exempt (it's the fairness clock). Instant purchase with a banner floater, over-buys are no-ops, broke buys name the shortfall, the card reads its tier honestly through to MAX, and the plating strips with the run — the permanent layer stays the Relic Vault's job. 🏆 Bastion for maxing it in one run.
- **~~VOX-5 · Voxel Isle: stardust & wishes~~** ✅ — the how-to always teased that "the stars are good for something"; now it's true beyond moonpetals. At night a shooting star occasionally sheds a glowing **stardust shard** somewhere on the island's surface (never the pond) — tap it before it fades with the morning light. **Three shards make a wish**: every growing crop surges +20% of its grow bar, ripening through the normal stage roll so golden crops still happen. First-sighting explainer, 🏆 Upon a Star on the first wish, stardust/wish counters ride the wholesale save, and the hook-free `voxstardust` suite joins the committed battery.
- **~~HV-10 · Homeless Village: Soup Night~~** ✅ — the Soup Kitchen's "feed more people" copy was aspirational; now it does its promised job. Each dawn, if the pot could feed everyone last night (1 food per resident), the camp wakes fed: **+4 morale, +2 health**, and a 25% chance a neighbor who smelled the cooking left +1–2 goodwill on the counter (word gets around: +1 rep). A short pantry just means "the pot stayed cold" — no punishment for being broke. Structure card copy rewritten to the real effect, "Serve 7 soup nights" joins the goal ladder, the counter rides the save, and the hook-free `hvsoup` suite joins the committed battery.
- **~~HVALE-6 · Hearthvale: the Cobbled Way~~** ✅ — roads always sped villagers up; now they carry trade. A workshop whose footprint touches a road that **connects, tile by tile, to the Market** sells along the route for **+10% output**, applied through the same rounding chain as every other multiplier (and honestly mirrored in the HUD net-per-cycle readout). The network is a BFS over road tiles seeded at the Market's edge, cached and recomputed only when a road is paved, a building finishes, or a save loads — a gapped road reaches nobody, and the Market never pays itself. Inspect panels gain a "🛤️ Trade route" row when linked, the road tooltip explains the bonus, 🏆 The Cobbled Way at three linked workshops.
- **~~TYC-14 · Startup Tycoon: The Poach~~** ✅ — the employee XP ladder finally has stakes: post-IPO, a rival startup (the race rival, by name) occasionally makes a run at your **most senior engineer** (L2+). A retention bonus of max($1.5k, revenue rate × their level) keeps them — and they come back re-energised (+2 XP) — or you let them walk: **the seniority leaves with them** (their XP zeroes; a fresh hire fills the desk the same afternoon, Campus alumni still arriving at L2). 30-second decision window that defers to every other pitch (and they to it), a broke counter is refused mid-panel, the fought/lost scoreboard rides SAVE_SCHEMA, 🏆 Golden Handcuffs at three battles won.
- **~~SITE · Patch notes round 2 + eureka-v8 rollout~~** ✅ — the changelog catches up with the round that touched every flagship: a "Six Flagships, Six Features" release entry (Warcry · Corner Wars · flotsam & the Pier · Word on the Street · product launches · the Town Chronicle) leads the 📰 PATCH NOTES modal, and `SW_VERSION` bumps to **eureka-v8** so installed PWAs pick all of it up. The committed `patchnotes` suite's newest-release assertion moves with it.
- **~~AOW-13 · Age of War: the Warcry~~** ✅ — an active rally that lives beside the era Special instead of replacing it: from Age II on, sound the horns (🎺 button on the action bar, or **W**) and every friendly unit attacks **50% faster for 6 seconds**, on its own 45-second cooldown — the era Special stays the burst-damage button, the Warcry is the tempo button you time around a big push or a boss wave. Age I refuses with a floater ("the horns are forged in Age II") so the opening minute stays about unit reads. Button shows ⚔️ rally countdown / cooldown / AGE II states, screen-shake + banner on cast, 🏆 Hear the Horns at 3 cries in a run, and the rally state resets with the run.
- **~~LAB-11 · Grow Op: Corner Wars~~** ✅ — past the garage act, a rival crew occasionally posts up on the block for ~90 seconds and poaches buyers before they ever reach you — lost **volume**, not lower prices (that's the market's job). Base 35% of incoming buyers peel off to the rival corner; each hired Lookout thins it by 10 points (floor 5%), turning the Lookout into a three-way asset (heat sink · sting wire · corner muscle). Cash clears the corner instantly — the payoff locks at 6× list price the moment they arrive — or you wait them out. HUD chip with live countdown, poach % and payoff button; feed lines for every peeled buyer; a posted rival plus the run-in/poach counters ride the save with load clamps.
- **~~VOX-4 · Voxel Isle: flotsam & the Pier~~** ✅ — the pond becomes a port of call: every few minutes (never through winter ice) a battered crate bobs up on a pond cell — tap it to crack it open for 25–60 🪙 and a 30% shot at a stockpile good, or watch it take on water and sink after 60 seconds. A new ⚓ Pier building (560🪙, level 5, plank-and-lantern voxel sprite) doubles both the traffic (the wait timer runs at 2×) and the haul (×1.6 coins, 50% good chance). 🏆 Beachcomber at five crates; counters ride the wholesale state save; the hook-free `voxflotsam` suite joins the committed battery.
- **~~HV-9 · Homeless Village: Word on the Street~~** ✅ — a 0–100 neighborhood reputation the camp earns by showing up: odd jobs (+3), trades and panhandle successes (+1), a regular reaching friendship (+5) — fading a point each dawn. Tiers gate real effects: **Known** (25) lifts panhandle odds ×1.15, **Respected** (50) cuts the complaint calls that bring police sweeps by a third, **Beloved** (75) means some mornings a neighbor leaves a covered plate or a thank-you envelope on the fence post (once a day at most). HUD pill with tier + score, tier-crossing log lines both ways, a "Become Respected" goal on the ladder, save migration — and the `hvrep` suite joins the committed battery (no test hook needed).
- **~~TYC-13 · Startup Tycoon: product launches~~** ✅ — post-IPO, a launch window opens every ~6–10 minutes: the point release is ready. **Ship it hot** for base×1.3 on the spot — but every engineer rolls a 45% chance of putting a TYC-7 🐛 in production (desk at half speed until the hotfix) — or **polish first**: QA takes 45 seconds, then the safe base (max($2.5k, rate×2.5min)) lands guaranteed clean. Greed vs patience riding the systems the office already has. 🚀/🧪 chip on the goal bar, offers defer to modals and the other pitches (and they to it), the count + an in-flight polish survive reload, 🏆 Launch Day Veteran at five.
- **~~HVALE-5 · Hearthvale: the Town Chronicle~~** ✅ — the Chronicle menu was a stats table; now it's the town's actual history. Notable moments are written down as they happen, dated by day and year (four seasons to a year): the founding, every finished building (decorations excluded), newcomers by name and leavers in disgrace, raid nights in all three outcomes, festivals by ordinal, mastery rank-ups, enacted decrees, every 5th head of population, and each new spring. The modal shows today's stats, then the record newest-first (capped at 120 pages); 🏆 A Storied Town at 25 pages; pre-chronicle saves migrate to an honest "earlier days went unrecorded" opening page.
- **~~QA-1 · The headless QA battery, committed~~** ✅ — the campaign's verification scripts stop being ephemeral: 29 re-runnable Playwright suites land in `tests/headless/` with a `run.sh` orchestrator (audit-first ordering, exit code = fail count) and a `tests/README.md` documenting setup, coverage and the conventions (sessionStorage init-guards, single-evaluate exact math, pinned `Math.random`, zero-page-errors). One-shot suites that needed temporary in-game hooks stay out by design — their results live in the merge commits. Main README gains a Testing section.
- *(scoped and dropped: AoW commander abilities — the era Special + relic perks already own that niche; AoW build queue, battle report, unit stats all verified already present; Tycoon funding-round equity — rounds are established free-money milestones, retrofitting a tradeoff would break their balance.)*

## P8 — Coverage pass (opened Aug 2026)

- **~~P8-ACH-1 · Trophies for the newest games~~** ✅ — 🏗️ High Rise, 🛰️ Perimeter Held, 🔤 Rainmaker, 🥇 Pathfinder; their keys join SCORE_KEYS so Completionist means all 15 tracked games (20 trophies total).
- **~~P8-DAILY-2 · Word Cascade joins the daily~~** ✅ — seeded letter draws (the game's only randomness), 7th banner chip, 📅 line on the game-over card.
- **~~P8-SNAKE-2 · Pace settings~~** ✅ — Chill/Classic/Blitz base tick persisted in `snake-pace`, live mid-run retiming, daily runs locked to Classic.
- **~~P8-SW-1 · eureka-v4 cache bump~~** ✅ — the cache-first shell only refreshes on a version change, so installed PWAs were still serving the pre-P4 arcade; v4 rolls out everything since. Full offline suite green on the new cache.
- **~~P8-TET-1 · Combo + B2B scoring~~** ✅ — consecutive clears chain (+50·(n−1)·level), back-to-back Tetrises pay ×1.5, gold callout above the well, non-clearing locks reset the chain.
- **~~P8-DOC-1 · README refresh~~** ✅ — meta-layer paragraph (daily/achievements/coins/rivals/backup/PWA) + registry rows for `snake-pace`, `maze-best`, `maze-golds`.
- **~~P8-META-1 · Drift sweep~~** ✅ — 21-game search/social descriptions, `maze-best` on the rivals share code, PWA manifest shortcuts (Daily/HOF/AoW).
- **~~ARC-8 · Crate Escape~~** ✅ — the 21st game: neon Sokoban whose levels are generated by seeded reverse-pulls (every pull is a legal push played backwards, player reachability included), so each level is solvable **by construction** and identical for every player. Undo/restart, persisted ladder + per-level move bests, full meta integration (HOF row, rivals key, 📦 Warehouse Manager trophy, telemetry, ? cheat-sheet coverage via shared keys, SW v5 precache). Verified 13/13 including an in-test full-state BFS proving levels 1-8 solvable and 1-12 deterministic.

## Appendix A — localStorage key registry

*Refreshed August 2026. SITE-3 asked for this table to live in the README too —
that half is still open.*

| Key(s) | Owner | Status |
|---|---|---|
| `snake-high`, `tetris-high`, `breakout-high`, `asteroids-high`, `g2048-best` | arcade games | ✓ read by HOF + badges |
| `mines-best-beginner` / `-intermediate` / `-expert`, `mines-diff` | Minefield | ✓ read by HOF + badges |
| `connect4-streak`, `c4-diff` | Drop Four | ✓ |
| `word5-streak` | Word Five | ✓ |
| `cycles-streak` | Light Cycles | ✓ |
| `matrix-best` | Memory Matrix | ✓ (predates the `mm-*` DOM-id rename — key name is stable) |
| `arcade-muted` | `js/sfx.js` | one of three mute keys — by design, each game owns its mute |
| `aow-achievements`, `aow-difficulty`, `aow-muted`, `aow-welcome-seen`, `aow-mode`, `aow-best-run` | Age of War | ✓ (`aow-best-run` written by Endless mode since Aug 2026) |
| `drug-lab-v1` | Grow Op | ✓ |
| `homeless_village_v1` | Homeless Village | snake_case outlier |
| `hearthvale-v1` | Hearthvale | ✓ |
| `voxel-garden-v1` | Voxel Isle | ✓ read by HOF |
| `studio-token`, `studio-chat-v1` | Eureka Studio | ✓ token is browser-only, sent only to api.github.com |
| `startup-tycoon-v7` | Startup Tycoon | ✓ collision resolved (TYC-3) |
| `beagle-sim-v1` | Beagle Sim | ✓ its own key + version-sweep prefix |
| `startup_tycoon_theme`, `startup_tycoon_panels_collapsed`, `startup_tycoon_feed_open` | both tycoon builds | still shared — cosmetic only |
| `tycoon:*` (`joystickEnabled`, `moraleEnabled`, `investorEnabled`, `tipsEnabled`, `toastDensity`, `sfxEnabled`, `welcomeSeen-v1`, `hapticsEnabled`, `tip-seen-*`) | Startup Tycoon | ✓ namespaced, with one-time migration from the bare keys (SITE-3) |
| `eureka-notes/todos/bookmarks/pomo-sessions/calendar-config/gt-clientid/gt-lists` | productivity | ✓ |
| `eureka-personal-pin`, `eureka-personal-*` | personal | plaintext, and the UI now says so (SEC-2) |

## Appendix B — verified-clean list (don't re-investigate)

Tycoon: dt clamp (`play.html:8214`), version-sweep matching, purchase double-click races, save↔pill field names (defect is semantic, TYC-6), zero-alloc render hot path. Arcade: SFX mute persistence, AudioContext unlock, Asteroids FIRE double-bind (throttled correctly), HOF key wiring, hash-router re-entrancy. Site: home-page grid keyboard nav (real anchors + `:focus-visible`), video `preload="none"` + `(hover:hover)` gating.

**Added by the August 2026 re-audit** (checked, found clean — don't re-investigate):

- **Zero first-party console errors** across 11 standalone pages and all 14
  arcade views, exercised in headless Chromium. The only failures observed were
  environmental (Google Fonts and `api.github.com` blocked in the sandbox).
- **Hearthvale and Voxel Isle save/load**: storage access is guarded on every
  path, `load()` is wrapped and returns `false` on corrupt data, and villager
  `jobId`/`homeId` dereferences are null-checked (`buildingById` misses are
  handled, not thrown on).
- **Eureka Studio XSS**: every GitHub-data sink (PR/issue titles, commit
  messages, branch names, author logins) goes through `esc()` into a text
  position; the only attribute sinks take GitHub-generated URLs. `esc()` has
  since been hardened to escape quotes as well, so an attribute sink would be
  safe too.
- **Minefield / Drop Four / Word Five teardown**: all three are in the teardown
  map with deliberate, documented `destroy()` bodies.
- **Frame-loop structure** in Voxel Isle, Grow Op, Eureka Studio and Homeless
  Village — all four survive a mid-frame exception (see LOOP-1 for the three
  that didn't).

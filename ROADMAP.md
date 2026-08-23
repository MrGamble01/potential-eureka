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
| **P3** | untouched backlog; entries that shipped are marked inline |

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
- **IDEA-SITE-5 · Arcade coins + cosmetics** — earn from achievements; spend on `--accent` palette swaps (already CSS-custom-property-driven).
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
- Still open: **IDEA-ARC-6 · Word Cascade** (letters on the Tetris gravity/lock loop).

### Startup Tycoon
- **IDEA-TYC-1 · Second floor "R&D Lab"** — the code ships explicit extension points (`Floor`/`FLOOR_CLASSES`, elevator modal `play.html:422-455`); researchers generate patents = permanent % on `computeDealValue()`.
- **~~IDEA-TYC-2 · Save export/import~~** ✅ **shipped Aug 2026** — settings buttons produce/accept base64url save codes tagged with the build variant (a Beagle code is refused by Startup Tycoon with directions, and vice versa); import reloads through the TYC-4-hardened loadGame path rather than a second parser.
- **IDEA-TYC-3 · Rival startup race** — ghost competitor as a second fill on `#goal-hud`; beat them for a bonus, lose one engineer if they win.
- **IDEA-TYC-4 · Board meeting events** — timed choice cards ("Pivot: +50% deals, −20% morale") reusing investor plumbing (`:6739`) + tip-modal UI (`:657`).
- **~~IDEA-TYC-5 · Employee XP/levels~~** ✅ **shipped Aug 2026** — one XP per shipped feature; L2-L5 at 5/15/35/75 ships with titles (Beagle Sim promotes Pup → … → Legend) and +4% work rate per level in the main rate product; XP persists with the roster save; hover readout shows the title.
- **~~IDEA-TYC-6 · Office pets~~** ✅ **shipped Aug 2026** — stockless amenity ($2,500, 2 engineers): wanders desk to desk on `stepToward`, +2 team morale every 45s via `changeMorale`, tail wag and all; Beagle Sim gets a 🐈 Office Cat since its workers are the beagles.
- **~~IDEA-TYC-7 · Bug outbreaks~~** ✅ **shipped Aug 2026** — 7% per engineer ship: the desk goes 🐛 and works at half speed until clicked, which runs an 8s hotfix (zero feature work, 🔧 countdown label, click consumed before tap-to-move). Implemented as a rate multiplier + fixingT timer rather than a new S.FIXING state — the worker keeps their seat and animations. Bugs deliberately don't save.
- **IDEA-TYC-8 · Prestige shop** — spend 1 founder point/IPO on permanent meta-perks; gives `prestigeLevel` a decision layer.
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
- Repurpose `dashboard.js`'s widget grid as **Studio Stats** (real cross-game localStorage telemetry instead of fake CPU/MEM numbers); rebrand todo/pomodoro as a public **Dev Log**; retarget bookmarks as a **Dev Toolbox**; **cut or truly hide** the personal journal (see SEC-2). Fix if kept: pomodoro is tick-based (drifts when backgrounded; persist `{startedAt, duration}` instead — `pomodoro.js:18-45`), ~~org-chart rAF + dashboard's six intervals never stop~~ ✅ **fixed — see LEAK-1**, geolocation should be opt-in with disclosure (`dashboard.js:209`).

---

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

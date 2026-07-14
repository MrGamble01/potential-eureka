# EUREKA GAMES — Master Audit & Build Roadmap

*Audit date: July 2026. Every bug below was verified against source (line numbers cited); the highest-severity items were additionally reproduced in Node or headless Chromium. Line numbers drift as files change — treat them as starting anchors, and re-locate by the quoted identifiers.*

## How to use this document

Each ticket is self-contained and sized for **one PR**. Work top-down by priority. For every ticket:

1. Read the cited file/lines and confirm the problem still exists (a quoted identifier is the anchor, not the line number).
2. Make the minimal fix described. Don't refactor beyond the ticket's scope.
3. Verify using the ticket's acceptance criteria before opening the PR.
4. One ticket per PR, ticket ID in the PR title (e.g. `TYC-1: fix triggerWin ReferenceError`).

Conventions to preserve: zero dependencies (no build step, no frameworks), vanilla HTML/CSS/JS, games follow the `init()/start()/destroy()` module contract used by the arcade shell in `index.html`.

---

## P0 — Incident-level (fix before anything else)

### SEC-1 · Remove real personal/employer data from `js/orgchart.js`
**Files:** `js/orgchart.js:10-149` (`PEOPLE` array), `index.html:40` (nav entry)
The org chart ships **real names, job titles, reporting lines, and candid internal notes about ~14 real coworkers** (plus vendor/product names). It is reachable by any visitor via "⋯ more → My Org Chart" with **no authentication**, and readable by anyone in this public repo. Unlike the "Personal" view it has no lock at all.
**Fix:** Replace `PEOPLE` with an obviously fictional cast (or delete the feature). Then scrub git history (`git filter-repo` or BFG) — the data exists in prior commits (e.g. `beb580e`), so a new commit alone does not remove it — and force-push. Consider making the physics-canvas viz a fictional "Studio Crew" page later (see IDEA-SITE-9).
**Accept:** No real names/roles anywhere in repo or history; page either removed from nav or shows fictional data.

### SEC-2 · Stop presenting the Personal PIN as security
**Files:** `js/personal-auth.js:9-13, 70-77`, `js/personal-content.js:7-8, 84-86, 209`
The PIN "lock" is a 32-bit rolling hash and a `display:none` toggle; journal/mood/habit data is stored in **plaintext** localStorage (`eureka-personal-*`) and `PersonalAuth.unlock()` is a callable global. Users are told "PRIVATE TERMINAL — AUTHORIZED" and may journal sensitive things believing it's protected.
**Fix (pick one):** (a) Reword the lock UI to "casual screen lock — data is not encrypted", or (b) actually encrypt payloads with WebCrypto (PBKDF2 from PIN → AES-GCM) before writing to storage.
**Accept:** Either honest copy or ciphertext in localStorage; `unlock()` no longer bypassable without the PIN if (b).

### SEC-3 · Escape calendar event titles (XSS)
**Files:** `js/calendar.js:143-144` (render), `js/calendar.js:181-182` (settings inputs)
`ev.title`/`ev.cal` from the Google Calendar API go into `innerHTML` unescaped — calendar-invite spam is a real injection vector, and the payload would run with access to the plaintext journal (SEC-2) and Google tokens. Settings inputs interpolate `value="${name}"` unescaped (persistent self-XSS).
**Fix:** `Utils.escHtml()` on all four interpolations (every other module already escapes — `js/todo.js` is the reference pattern).
**Accept:** `<img src=x onerror=...>` as an event title renders as text.

---

## P1 — Game-breaking bugs

### Startup Tycoon (`tycoon/play.html`, ~8,900 lines)

**TYC-1 · Winning a season freezes the game.** `play.html:6167` — `triggerWin()` interpolates `${m}:${s.toString()...}` but `m`/`s` are never declared → `ReferenceError` thrown from inside the render loop (`loop()` only re-arms rAF on its last line, `:8283`, no try/catch), so the game hard-freezes at the moment the player hits the season goal. **Fix:** use the existing `formatTime(elapsed)` helper (`:5697`). **Same bug in `tycoon/beagle.html:5519`** — fix both. *Accept:* reaching the goal opens the win modal; game keeps rendering.

**TYC-2 · Storage-blocked browsers get a blank game.** `play.html:7843` (also `7837-7840, 7913-7931, 7987-8000`) — top-level `localStorage` reads for joystick/morale/investor/tips/toastDensity settings have no try/catch (the SFX/Haptics IIFEs at `1927-1995` show the correct pattern); the loop doesn't start until `:8889`, so the first throw aborts the module → permanent blank canvas in Safari private mode / storage-blocked contexts. **Fix:** `safeGet`/`safeSet` helpers wrapping every access. *Accept:* game boots with localStorage stubbed to throw.

**TYC-3 · Beagle Sim and Tycoon share the save key and clobber each other.** `play.html:1909` and `beagle.html:1715` both use `startup-tycoon-v7` (plus shared `startup_tycoon_theme`, `startup_tycoon_panels_collapsed`); both autosave every 5s; schemas have diverged since the fork. Playing one silently corrupts/overwrites the other; Restart in either wipes both. **Fix:** move beagle to `beagle-sim-v1` (+ its own version-sweep prefix and theme/panel keys). *Accept:* playing beagle leaves the tycoon save byte-identical.

**TYC-4 · Corrupted save NaN-poisons the economy permanently.** `play.html:8644-8649` — `loadGame` replays saved upgrade levels with no clamp against `u.max`; `computeDealValue()` (`:5612`) indexes fixed arrays (`[5,8,12,18,26][lv]`), so `pricing > 4` → `undefined` → every deal `NaN` → `addCash` (`:7072`, no `isFinite`) poisons cash forever, and the bad value re-saves every 5s. (`vpTier` at `:8726` IS clamped — this is an oversight.) **Fix:** clamp `lv = Math.min(lv, u.max)` + `Number.isFinite` guards in `computeDealValue`/`addCash`. Also guard the landing pill: `tycoon/index.html:446-457` can render "$NaN". *Accept:* loading a save with `pricing: 7` yields a playable game with sane prices.

**TYC-5 · Players can walk through walls of unpurchased rooms.** `play.html:4687-4695` (dup `4706-4709`) — the door predicate in `clampToWalls()` checks only grid-cell identity, never `ownedRooms.has('front')`, and fires exactly when the neighbor is unowned. A new player walks north through the "solid" starter wall into the $1200 Open Plan room. **Fix:** require ownership in the door predicate; don't reuse it for the front room's exterior wall. *Accept:* wall blocks until the room is bought; door works after.

**TYC-6 · `allTimeCash` resets on IPO but is consumed as a lifetime stat.** `play.html:8396` zeroes it, yet achievements `hit_50k`/`hit_1m_total` (`:5829-5830`, "across seasons") and the landing pill (`tycoon/index.html:446`) treat it as lifetime; dashboard calls it "Earned (season)" (`:5985`) while the win recap says "All-time cash" (`:6163`). **Fix:** add a never-reset `lifetimeCash` accumulator, persist it, point achievements + pill at it. *Accept:* $600k → IPO → $500k unlocks the $1M achievement; pill never decreases after IPO.

**TYC-7 · The welcome/onboarding modal can never appear.** `play.html:8842-8843` grants `addCash(400)` before the gate `state.allTimeCash <= 100` (`:8857`) — always false. This also blocks the Web-Audio-unlock gesture and the hire-button pulse it provides. (Stale "$200" comment at `:8839`; same class of bug in `beagle.html:8035/8050`.) **Fix:** snapshot freshness before `addCash`, or gate on `ideaWorkers.length === 0 && trophiesWon === 0`. *Accept:* fresh profile sees the welcome modal exactly once.

**TYC-8 · "AE Office" room conversion is unreachable dead content.** `play.html:3230-3233` — `ROOM_MODES.right.modes['bdr-corner']` lacks `nextMode: 'ae-office'`, so both `convertRoom()`'s guard (`:3278`) and the panel button loop (`:3432-3448`) bail forever; the auto-promote `onEnter` (`:3214-3219`) is a guaranteed no-op. **Fix:** add `nextMode: 'ae-office'` to `bdr-corner`. *Accept:* unlocking the Sales Floor converts the Sales Corner as designed.

### Beagle Sim (`tycoon/beagle.html`, ~8,100 lines) — *see also DEBT-1: consider deleting this file entirely*

**BGL-1 · Engineers (beagles) never deliver → dead revenue loop.** `beagle.html:3914` — delivery target `ceoDeskPos.z + 2.0` sits dead-center inside the desk's collision exclusion zone (z ∈ [1.8, 4.2], `clampToWalls` `:4468-4475`), so workers get shoved out before the arrival check (`stopDist 0.35`, `:4491`) can pass and sit in `TO_DELIVER` forever. `play.html` fixed this exact line in commit `9204454` (`+ 1.0`); the fork predates it. **Fix:** `+ 2.0` → `+ 1.0`. *Accept:* a lone beagle with no VP ships revenue.

**BGL-2 · Win-freeze (same as TYC-1)** at `beagle.html:5519`. **BGL-3 · Esc doesn't close the Theme modal** — `beagle.html:6981-6987` omits `themeModalEl` (play fixed in `cd46bfe`). **BGL-4 · No favicon/OG/back-link** — only page on the site with a 404'ing favicon, no meta, and no `.ea-back` chrome; copy the head + chrome block from `play.html:1421,1431`.

### Drug Lab (`drug-lab.html`)

**LAB-1 · Getting busted is undone by refreshing the page.** `triggerBust()` (`:1221-1238`) removes the save (`:1225`), but `sellToDealer()` (`:1829-1849`) calls `addHeat` (`:1838`) which can bust synchronously, then hits an unconditional `saveGame()` at `:1846` re-writing the busted state; `beforeunload → saveGame` (`:1963`) is also unguarded, and `loadGame` clamps heat to 99 (`:1580`). The game's only lose condition is cosmetic. **Fix:** `function saveGame() { if (busted) return; ... }`. *Accept:* bust → refresh → still busted / fresh start.

**LAB-2 · Core progress silently vanishes on reload.** `saveGame` (`:1561-1572`) omits `chemQueue`/`chemProduct`/`chemProgress` (declared `:1064-1066`) **and** all grow-plot progress (`buildGrowPlot` `:687-727` re-randomizes 0-30% on every load); a carried bud (`pCarrying`, `:899`, set at `:1770`) has no backing counter at all. **Fix:** add all of these to the save schema; restore plot progress in `loadGame`; credit carried bud to a counter at harvest or persist it. *Accept:* 90%-grown plant + queued chem + carried bud all survive a reload.

**LAB-3 · Broke players dismiss paid events for free (exploit).** `triggerEvent` (`:1162-1189`) never disables unaffordable choices; paid options (`:1117`, `:1153`) just toast "Can't afford it!" and close the event with zero consequence — the risky branch is always dodgeable. **Fix:** disable unaffordable buttons, or fall through to the risky consequence. *Accept:* with $0, the safe-paid option is unavailable.

**LAB-4 · World keeps simulating behind event modals.** Click-input is blocked during events (`:1277`) but `updatePlayer` runs whenever `!raidActive` (`:1985`) — WASD selling during a modal can push heat past the 95% raid check (skipped because `updateEvents` early-returns while `activeEvent`, `:1911`) straight to a bust stacked on top of the open event modal. **Fix:** gate the sim on `!activeEvent` too. *Accept:* no state changes while an event modal is open.

**LAB-5 · Chemistry Equipment can be a pure money sink.** `salePrice()` (`:1253-1258`) keys the 1.8× bonus on station *existence*, which the Lab room also grants (`:1390-1397`); `buyUpgrade()` (`:1429-1453`) deducts unconditionally before checking. Buying the upgrade after the room = 2,500 for nothing (with a success toast). Related: buying the Lab room *after* the upgrade leaves the 12k room decoratively empty (`:1394` guard skips relocation). **Fix:** refuse/refund the redundant purchase or scale the bonus with `upgLv('chemistry')`; relocate the station into the Lab on purchase. *Accept:* both purchase orders yield distinct, visible value.

### Homeless Village (`homeless-village.html` + `homeless-village/`)

**HV-1 · An in-game day lasts 4 real seconds.** `config.js:6` `daySpeed: 0.00025` × dt(ms) (`gameloop.js:56`) → full day ≈ 4s, while action cooldowns are real-time (Rest = 20s = **5 days**); `onNewDay()` (food aging, warmth drop, decay, events) fires ~15×/minute. Units bug, not design. **Fix:** define day length in ms (e.g. ~8-12 min) and derive the increment. Re-tune event frequency to the new day length. *Accept:* day/night visibly cycles over minutes; decay/events feel paced.

**HV-2 · The Lookout is bypassed by 38% of sweeps.** `gameloop.js:189-208` — the lookout-warning branch (`:191-202`) exists, but the general weighted pool (`:203-207`) still contains the `sweep` event (`:74-85`), which then fires instantly via `triggerEvent` (`:211`) with no warning. **Fix:** build the pool from `EVENTS_BAD.filter(e => e.id !== 'sweep')`. *Accept:* with a Lookout, every sweep is preceded by the warning.

**HV-3 · Craft double-spend race.** `player.js:45-61` — `doCraft` has no mutex (unlike `doAction`'s `activeJobs`), and any craft's completion rebuilds the whole panel (`buildCraftUI`, `ui.js:17-33`), discarding the busy-state styling on still-running crafts; re-clicking deducts costs twice (reproduced live). Also **HV-4:** costs are deducted at start but in-flight crafts aren't persisted — close the tab mid-craft and the resources are gone (`config.js:48` module var, autosave `main.js:64`). **Fix (one PR):** move active jobs/crafts into `G` (persisted), use it as mutex, re-apply busy state after any rebuild, and fast-forward/re-arm timers on load. *Accept:* double-click can't double-spend; reload mid-craft completes or resumes it.

**HV-5 · CDN failure = infinite 60fps exception storm.** `homeless-village.html:87` loads Three.js r128 from cdnjs with no fallback/onerror; `main.js:13` re-arms rAF *before* the code that throws (`camera.position`, `:19`), so a failed CDN produces hundreds of errors/sec over a black canvas forever. **Fix:** vendor Three.js (see SITE-1), try/catch the frame body, show a visible "failed to load" message. *Accept:* blocking the CDN yields one friendly error, not a storm.

### Arcade (`js/*.js`, wired in `index.html`)

**ARC-1 · Tetris: holding Space chain-drops pieces into a top-out.** `tetris.js:306` — no `e.repeat` guard anywhere in `handleKey` (`:288-311`); OS key-repeat delivers multiple hard-drops (5 locks reproduced). **Fix:** `if (e.repeat) return;` for Space/rotate/hold. *Accept:* holding Space drops exactly one piece.

**ARC-2 · Snake & Tetris show a frozen mid-game frame when you leave and return.** `snake.js:316-319`, `tetris.js:430-433` — `destroy()` lacks the repaint fix PR #137 gave Breakout/Asteroids/2048 (reset state + redraw idle screen). Reproduced: byte-identical canvas after leave/return. **Fix:** mirror the fixed pattern. *Accept:* returning to either game shows the "tap to start" idle screen.

**ARC-3 · 2048 can't be started by tap on touch devices.** `game2048.js:51` — the tap branch checks only `over`, not `!running`, while the canvas itself says "Click or tap to start" (mouse path handles it, `:47`). **Fix:** `if (over || !running) newGame(true)`. *Accept:* first tap starts the game on a touch device.

**ARC-4 · Arcade-card "HI ####" badges never refresh.** `index.html:883-905` — badge IIFE runs once at boot; `switchView` (`:775-806`) re-renders the Hall of Fame (`:802`) but never the badges; "Reset my scores" (`:855`) leaves stale badges. **Fix:** extract to a named function; call at boot, on `switchView('arcade')`, and after reset. *Accept:* new high score shows on the card without a reload.

**ARC-5 · Maze solver race leaves the status stuck forever.** `maze.js:13` — shared `solving` boolean; generate-then-solve-again lets a stale coroutine corrupt the canvas and its final `solving = false` kills the *new* run (reproduced: status frozen at "Solving with ASTAR..."). **Fix:** monotonic run token (`const myRun = ++solveRun;` check at each yield). *Accept:* rapid generate/solve cycles always end in "Solved"/"No solution".

**ARC-6 · Tetris hold can place a piece into occupied cells.** `holdPiece()` (`:228-244`) skips the `collides() → endGame()` check that `lock()` (`:173-190`) performs — near-ceiling holds corrupt the board. **Fix:** run the same check after the swap.

### Site-wide

**SITE-1 · Vendor Three.js (kills 3 CDN origins + version skew).** `homeless-village.html:87` (r128!), `drug-lab.html:406-407`, `play.html:1738-1739`, `beagle.html:1544-1545` (0.160.0). All four 3D games are dead (some with exception storms, HV-5) if unpkg/cdnjs is unreachable. `.gitignore:1` even excludes a once-vendored `tycoon/three.module.js`. **Fix:** commit `/vendor/three.module.js` (one file, no build step — still "zero-dependency" in spirit), point all four pages at it, remove the `.gitignore` line, delete the r128 skew. *Accept:* all 3D games run with external network blocked.

**SITE-2 · Broken social share cards on every page.** `og:image` is a relative path everywhere (`index.html:13`, `ageofwar/index.html:12`, `tycoon/index.html:11`, `drug-lab.html:13`, `homeless-village.html:13`, `play.html`) — scrapers require absolute URLs. **Fix:** absolute production URLs + add `og:url` + `<link rel="canonical">`. *Accept:* a share-card debugger shows the image.

**SITE-3 · localStorage key hygiene.** Un-namespaced tycoon settings shared by both builds (`joystickEnabled`, `sfxEnabled`, `welcomeSeen-v1`, `hapticsEnabled`, `tipsEnabled`, `moraleEnabled`, `investorEnabled`, `toastDensity`, `tip-seen-*`) — muting one game mutes the other, one's welcome suppresses the other's. Three unrelated mute keys site-wide (`arcade-muted`, `aow-muted`, `sfxEnabled`). **Fix:** prefix (`tycoon:`/`beagle:`) with one-time migration; document the full key registry (see appendix) in the README. *Accept:* settings in one game don't affect another.

**SITE-4 · Routing/link problems.** (a) `/tycoon/play` + `/tycoon/beagle` links (`tycoon/index.html:362,366`) 404 on any non-Vercel host incl. the README's own `python3 -m http.server` — link `.html` (Vercel `cleanUrls` still normalizes). (b) `trailingSlash: false` vs `href="ageofwar/"`/`"tycoon/"` (`index.html:57,72`; HOF `go()` `:810,812`) = a 308 on the two most-clicked links. (c) Replace the `startup-tycoon.html` stub with a `vercel.json` redirect. *Accept:* no 308s or 404s from any nav path, on Vercel and on http.server.

**SITE-5 · Missing deploy basics.** No themed `404.html` ("GAME OVER — 404" fits the brand), no `Cache-Control` headers (`assets/thumbs/*` → `public, max-age=31536000, immutable`; `ageofwar.webm` is 712KB re-validated per hover — also re-encode it, it's 4-16× the other clips), no `robots.txt`/`sitemap.xml`, no `X-Content-Type-Options`.

**SITE-6 · Rewrite the README.** It still describes the pre-rebrand "retro terminal dashboard with 3 games." New outline: title + live URL; 9-game table with paths; extras (Hall of Fame, hidden utils behind "⋯"); architecture (no build; hash-routed SPA home + standalone game pages; vendored Three.js; localStorage key registry); local dev (`http.server` + clean-URL caveat until SITE-4); deploy (`vercel.json` explained); "adding a game" checklist (card, thumbs, `HOF_GAMES` entry, teardown entry, namespaced key).

---

## P2 — High-value improvements

**DEBT-1 · Delete `beagle.html` as a fork; make it a theme.** It's 92% byte-identical to `play.html` (7,826 of 8,085 lines), frozen at commit `a5b7817` while play.html took 13 commits of fixes (this fork is *why* BGL-1/2 exist). `play.html` already has the exact mechanism: the `THEMES` table (`:2137`-area) that swaps room labels/palettes/goal text. **Do:** add a `beagle` THEMES entry (~40 lines: 🐶 labels, "Adopt Beagle" copy, "$X in Bones" goals), delete the file, make `/tycoon/beagle` redirect to `play.html?theme=beagle` reading the param at boot. This permanently ends the double-maintenance. (If keeping the file instead: apply BGL-1..4 + TYC-3 minimum.)

**DEBT-2 · Schema-driven save/load for Tycoon.** `play.html:8572-8791` is ~220 lines of hand-matched fields — the direct cause of TYC-4/TYC-6 and the dead `morale` field (`:8598`, written every 5s, never read). Replace with a declarative `{key, default, validate, migrate}` array driving both save and load; make the written-but-never-checked `v: 7` (`:8576`) a real version gate; surface a "save failed" toast instead of bare `catch {}`.

**DEBT-3 · Shared arcade plumbing (`js/utils.js`).** Each game reimplements: the view-active keydown guard (×5), `roundRect` (breakout `:410` = 2048 `:274` verbatim), the rAF+dt-clamp loop (breakout `:118`, asteroids `:140`), high-score persist idiom (~9 copies, 3 styles), `typeof SFX !== 'undefined'` guards (dozens), and hand-built game-over overlays. Extract `Utils.whenViewActive`, `Utils.gameLoop`, `Utils.highScore`, `Utils.showGameOver`; move the guard into `SFX.play`. This is why the destroy() fix missed Snake/Tetris (ARC-2) — one shared loop would have fixed all seven at once. Also dedupe `readJSON`/`fmtMoney`/best-stat logic defined twice in `index.html` (`:830` vs `:885`) into `js/scores.js`.

**DEBT-4 · Save-on-hide everywhere.** Tycoon (`play.html:8848-8849`) and Drug Lab rely on `setInterval` + `beforeunload`; iOS Safari kills backgrounded tabs without firing it. Add `visibilitychange`(hidden)/`pagehide` saves to Tycoon, Beagle (if kept), and Drug Lab.

**PERF-1 · HiDPI canvases.** All 7 arcade canvases (`snake.js:21`, `tetris.js:66`, `breakout.js:29`, `asteroids.js:26`, `game2048.js:27`, `maze.js:18`, `life.js:24`) and Age of War (`ageofwar.js:480`) render at CSS-pixel resolution → blurry on every modern phone/retina display (AoW's input mapping already does the DPR math — output doesn't). Backing store × `devicePixelRatio` + `ctx.scale(dpr,dpr)`; drop `image-rendering: pixelated` (`games.css:116`) for the anti-aliased games (Tetris/2048).

**PERF-2 · Age of War hot loop.** `ageofwar.js:1201-1266` — every unit runs `units.filter(...)` + `.find(...)` per frame (O(n²) + GC churn), `fireTurrets` (`:1511`) repeats it per turret, and there's no population cap. Bucket units per side once per frame; add a soft cap. Also: `UNITS` leaks a new boss entry every 7 waves (`:1089-1106` keys by `waveNum`; `reset()` never clears) — key by era and put scaling on the instance.

**PERF-3 · Home-page loading.** Kill the render-blocking `@import` chain (`css/style.css:1-8` → `base.css:8` → Google Fonts = 3 serial hops; use `<link>`s or concat + self-host the two woff2s); `defer` the 21 script tags (`index.html:734-754`); `loading="lazy"` + dimensions on the 9 poster JPGs.

**GAME-1 · Age of War feel/fairness batch.** (a) ~~Base hits are silent/invisible~~ **Fixed** — ranged units now fire a projectile at the base (reusing the unit-vs-unit path) instead of teleporting damage in, and every base hit (melee or projectile) gets hit sparks + `SFX.hit()` on top of the existing floater/shake. (b) Combo streaks are mathematically always wiped at wave boundaries (`COMBO_WINDOW 3.0` `:167` ≤ breather 3-4s `:653/:1069`; `comboT` never pauses `:1191`) — pause the timer during breathers. (c) Settings-modal difficulty switch (`:936-945`) silently changes mid-run without the reset the HUD switch does (`:1002-1013`), making `win_hard`/`win_insane` (`:1493`) gameable — unify, and gate achievements on the run's lowest difficulty. (d) Gold trickle (`:1174`) doesn't scale with difficulty while enemy stats do — Insane starves the player. (e) Coin flooring loses 0.3-0.8% of every kill (`:1604-1605`) — give the remainder to the last coin. (f) `ageUp` clamps hero cooldown to ≤10s (`:756-758`) — an unintended exploit.

**GAME-2 · Homeless Village completeness pass.** The 3D scene is pure decoration — there is **no player input at all** (only a WebAudio-unlock keydown, `gameloop.js:266`); the "player" is in the same NPC wander array as workers (`main.js:32-51`). See IDEA-HV-1/2. Also: Workbench does nothing despite "Enables crafting upgrades" (`config.js:26`); Garden claims "destroyed in sweeps" but sweeps never touch it (`config.js:30` vs `gameloop.js:74-85`) — make both real. Fix the one-shot `matchMedia` fold-in (`homeless-village.html:96-109`, add a `change` listener) and restore *some* narrative feedback on mobile (`game.css:236` hides the only log).

**A11Y-1 · Site-wide accessibility batch.** Remove `user-scalable=no` (drug-lab `:5`, play/beagle `:40` — WCAG 1.4.4); lift `--text-muted #484F58` ≈2.4:1 (`base.css:60`) to ≥ 4.5:1; add `aria-live` to game-over overlays and score readouts (copy `#maze-status`'s pattern, `index.html:484`); `role="dialog"`+`aria-modal` on tycoon modals (`play.html:1466,1685`); keyboard-reachable tooltips (play `:2113` is mouse-only and strips `title`); real `<button>`s for Homeless Village craft items (`ui.js:17-33`) and event-close; `:focus-visible` on `.arcade-card`/`.game-controls` (copy `.ea-back`'s, `arcade-chrome.css:53`); respect `prefers-reduced-motion` in game shake/flash (only `effects.js:19` and AoW haptics do today); trigger home-card video previews on `focusin` not just `mouseenter` (`index.html:935`).

**BAL-1 · Small verified balance/UX fixes (batchable).** Tycoon: promotion discards in-flight deal value (`play.html:5386,5155` — flush before `shift()`); Hire Engineer is the only unguarded spend (`:5551` vs `hireBDR`'s refund pattern `:4599`); joystick second-finger hijack (`:8027`, add pointer-id guard like `:7810`); investor banner covers goal HUD on desktop (`:1050` vs `:736`; mobile-only fix at `:1079`); floating `wallR` after Open Plan purchase (`:2575`); door mesh 2.5 vs collision 3.0 (`:2565` vs `:4690`); 860/900px breakpoint overlap (`:1425` vs `:1260`). Drug Lab: heat is flat per *sale* not per unit (`:1213`) making bulk dealers strictly better; enforce the declared-but-dead `STASH_MAX_BASE` (`:814`). Arcade: Breakout speed cap (`breakout.js:90`, tunneling risk), paddle `mousemove` on `document` not canvas (`:34`), dt-scale paddle easing (`:129`).

---

## P3 — Ideas backlog (each = one PR, pitched for mid-tier builders)

### Site-wide
- **IDEA-SITE-1 · PWA/offline arcade** — `manifest.json` + ~60-line vanilla service worker (precache shell, runtime-cache thumbs/pages). Requires SITE-1 first. Installable, fully offline.
- **IDEA-SITE-2 · Zero-backend shared leaderboards** — base64url `{game, score, name, ts}`+checksum share codes in `/#hof=<code>`; HOF decodes into a "Rivals" column. ~150 lines in existing HOF code.
- **IDEA-SITE-3 · Daily challenge** — seeded PRNG (mulberry32 from `Utils.todayKey()`, `utils.js:29`) swapped into layout-determining `Math.random` call sites (Tetris bag, 2048 spawns, Snake food, Maze gen, Asteroids rocks); `arcade-daily-<game>-<date>` bests; "Today's Challenge" banner. Pairs with SITE-2 codes.
- **IDEA-SITE-4 · Achievements** — declarative `js/achievements.js` table checked from existing hooks (`updateInfo`/`clearLines`/`destroyRock`/`endGame`); toasts + a Hall of Fame section reusing `.hof-row`.
- **IDEA-SITE-5 · Arcade coins + cosmetics** — earn from achievements; spend on `--accent` palette swaps (already CSS-custom-property-driven).
- **IDEA-SITE-6 · Theme system** — `:root[data-theme=crt|synthwave|daylight]`, picker by the SFX toggle, `prefers-color-scheme` aware.
- **IDEA-SITE-7 · Gamepad support** — `js/gamepad.js` polls `getGamepads()` and dispatches the same synthetic `KeyboardEvent`s the Tetris touch pad already uses (`index.html:911`).
- **IDEA-SITE-8 · Local-only "Insights"** — `js/telemetry.js` records launches/minutes to `eureka-stats`; "Your arcade year" panel in the HOF. No network.
- **IDEA-SITE-9 · "Studio Crew" page** — after SEC-1, reuse the org-chart physics/canvas viz (~90% of `orgchart.js`) with a fictional dev-team cast as an About page.

### New arcade games (follow the `init/start/destroy` + `#view-<name>` + `HOF_GAMES`/teardown contract)
- **IDEA-ARC-1 · Minesweeper: Neon** (best-time HOF entry) · **IDEA-ARC-2 · Memory Matrix** (Simon; natural daily-challenge seed) · **IDEA-ARC-3 · Stacker** · **IDEA-ARC-4 · Pong++** (reuse Breakout paddle/ball + power-ups) · **IDEA-ARC-5 · Light Cycles** (reuse Snake grid/direction-queue; optional local 2P) · **IDEA-ARC-6 · Word Cascade** (letters on the Tetris gravity/lock loop) · **IDEA-ARC-7 · Vector Defense** (tower defense in Asteroids' vector style; cap scope: 2 turrets, fixed path, ~8-10 waves).

### Startup Tycoon
- **IDEA-TYC-1 · Second floor "R&D Lab"** — the code ships explicit extension points (`Floor`/`FLOOR_CLASSES`, elevator modal `play.html:422-455`); researchers generate patents = permanent % on `computeDealValue()`.
- **IDEA-TYC-2 · Save export/import** — "Copy/Paste save code" in settings (base64 of the save JSON through the TYC-4-hardened loader).
- **IDEA-TYC-3 · Rival startup race** — ghost competitor as a second fill on `#goal-hud`; beat them for a bonus, lose one engineer if they win.
- **IDEA-TYC-4 · Board meeting events** — timed choice cards ("Pivot: +50% deals, −20% morale") reusing investor plumbing (`:6739`) + tip-modal UI (`:657`).
- **IDEA-TYC-5 · Employee XP/levels** — shipped-feature XP → title badges (style exists `:376`) + work-rate.
- **IDEA-TYC-6 · Office pets** — amenity NPC on `stepToward` (`:4750`) with a morale aura (beagle tie-in).
- **IDEA-TYC-7 · Bug outbreaks** — shipped features occasionally spawn a bug debuff; click desk → engineer enters new `S.FIXING` state. Active-play counterweight to idle income.
- **IDEA-TYC-8 · Prestige shop** — spend 1 founder point/IPO on permanent meta-perks; gives `prestigeLevel` a decision layer.
- **IDEA-TYC-9 · Win share-card** — canvas image (season/time/headcount) from `triggerWin()` stats, after TYC-1.

### Age of War
- **IDEA-AOW-1 · Endless/Survival mode** — gate the win check (`:1489`) behind a flag; score = waves survived; finally implement the `aow-best-run` key the Reset button already references (`:961-969`) but nothing writes.
- **IDEA-AOW-2 · Prestige "Relics"** — persistent currency from `runStats` at game-over (also surface the tracked-but-never-shown `runStats.gold`, `:191/:1384`); spend on starting bonuses in `reset()`.
- **IDEA-AOW-3 · 6th era "Singularity+"** — gated behind the `max_age` achievement; `ERAS`/`unitsForEra` iterate generically so the pipeline mostly just works.
- **IDEA-AOW-4 · Wall/Barricade unit** (`role:'wall'`, skip attack branch) · **IDEA-AOW-5 · Unit veterancy** (`u.aliveT` → +10% dmg + gold outline) · **IDEA-AOW-6 · Turret targeting modes** (nearest/lowest-HP/highest-HP cycle button in `renderTurretPanel` `:6124`) · **IDEA-AOW-7 · Overtime sudden-death** (escalating base chip damage after ~6 min).

### Drug Lab
- **IDEA-LAB-1 · Offline catch-up** — `lastSaveAt` in the schema; simulate passive growth + heat drain on load; "While you were away" toast.
- **IDEA-LAB-2 · Give Runners a purpose** — they're hired, costed, and persisted but fully inert (row force-hidden `:1328`); make them passive stash-ferry NPCs modeled on `updateTrimmerNPCs` (`:1880`).
- **IDEA-LAB-3 · Prestige "New Identity"** — bust/Act-III grants a permanent meta-bonus in a separate LS key surviving `resetGame()` (`:1245`).
- **IDEA-LAB-4 · Pre-raid bribe window** — costed choice before the 95%-heat raid (`:1913`); adds agency + a cash sink.
- **IDEA-LAB-5 · Difficulty pick** ("Careful"/"Kingpin") scaling the heat functions (`:1213-1218`) + starting cash.
- **IDEA-LAB-6 · Achievements → Hall of Fame** via the existing `growop` hook (`index.html:815,896`), like `aow-achievements`.
- *Tone note:* the in-game copy ("10 to 15, no deal", "harder product") is markedly darker than its all-ages home-page framing ("GROW OP · Builder/3D/Risk"). Either soften toward the site's satirical register or add a small content note on the card.

### Homeless Village
- **IDEA-HV-1 · Real player movement** — WASD + camera follow; branch the player out of the NPC wander loop (`main.js:32-51`); touch joystick. The single biggest "is this a game?" fix.
- **IDEA-HV-2 · Proximity-gated scavenging** — require standing near the already-rendered dumpsters (`scene.js:112-119`) to scavenge; turns the diorama into playspace.
- **IDEA-HV-3 · A resolvable arc** — milestone check in `onNewDay()` on stats already tracked (`config.js:19`) → "Case Worker" event chain → housing/graduation ending (with sandbox continue). Also answers the tone concern that an endless grind with no exit reads as nihilistic; consider a one-line framing intro. Related copy fix: drop the editorializing "Degrading, but sometimes necessary" from the Panhandle tooltip (`config.js:36`).
- **IDEA-HV-4 · "Pack Up Camp" action** — usable during a Lookout warning to save a % of goods (pairs with HV-2's fix); live countdown on `#sweep-warning`.

### Dashboard leftovers (all still reachable via "⋯ more" — decide their fate)
- Repurpose `dashboard.js`'s widget grid as **Studio Stats** (real cross-game localStorage telemetry instead of fake CPU/MEM numbers); rebrand todo/pomodoro as a public **Dev Log**; retarget bookmarks as a **Dev Toolbox**; **cut or truly hide** the personal journal (see SEC-2). Fix if kept: pomodoro is tick-based (drifts when backgrounded; persist `{startedAt, duration}` instead — `pomodoro.js:18-45`), org-chart rAF + dashboard's six intervals never stop (add `destroy()` hooks to the `teardown` map, `index.html:765`), geolocation should be opt-in with disclosure (`dashboard.js:209`).

---

## Appendix A — localStorage key registry

| Key(s) | Owner | Status |
|---|---|---|
| `snake-high`, `tetris-high`, `breakout-high`, `asteroids-high`, `g2048-best` | arcade games | ✓ read by HOF + badges |
| `arcade-muted` | `js/sfx.js` | one of THREE mute keys (SITE-3) |
| `aow-achievements`, `aow-difficulty`, `aow-muted`, `aow-welcome-seen` | Age of War | ✓ (`aow-best-run` referenced by reset but never written) |
| `drug-lab-v1` | Drug Lab | ✓ |
| `homeless_village_v1` | Homeless Village | snake_case outlier |
| `startup-tycoon-v7` | **BOTH tycoon builds** | ⚠ collision → TYC-3 |
| `startup_tycoon_theme`, `startup_tycoon_panels_collapsed`, `startup_tycoon_feed_open` | both tycoon builds | shared |
| `joystickEnabled`, `moraleEnabled`, `investorEnabled`, `tipsEnabled`, `toastDensity`, `sfxEnabled`, `welcomeSeen-v1`, `hapticsEnabled`, `tip-seen-*` | both tycoon builds | ⚠ un-namespaced → SITE-3 |
| `eureka-notes/todos/bookmarks/pomo-sessions/calendar-config/gt-clientid/gt-lists` | productivity | ✓ |
| `eureka-personal-pin`, `eureka-personal-*` | personal | plaintext → SEC-2 |

## Appendix B — verified-clean list (don't re-investigate)

Tycoon: dt clamp (`play.html:8214`), version-sweep matching, purchase double-click races, save↔pill field names (defect is semantic, TYC-6), zero-alloc render hot path. Arcade: SFX mute persistence, AudioContext unlock, Asteroids FIRE double-bind (throttled correctly), HOF key wiring, hash-router re-entrancy. Site: home-page grid keyboard nav (real anchors + `:focus-visible`), video `preload="none"` + `(hover:hover)` gating, zero first-party console errors on all 8 pages / 13 views.

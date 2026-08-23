# Eureka Games

A browser arcade of small, self-contained games. Zero dependencies — vanilla HTML, CSS, and JavaScript, no build step, no framework.

Open `index.html` and you land in a retro terminal-style hub (clock, system monitor, activity graph) that doubles as the arcade's front door. From there you can jump into a mix of in-page canvas games and standalone game pages.

## Games

**In the arcade hub** (`index.html`, rendered on `<canvas>`, no page navigation required):
- **Snake** — classic grid snake with arrow/WASD controls and a growing score
- **Tetris** — the falling-block classic
- **Neon Breaker** — brick-breaker with paddle and ball physics
- **Vector Storm** — asteroids-style vector shooter
- **2048** — sliding tile puzzle
- **Minefield** — a modern Minesweeper: first-click-safe, chording, three difficulties, per-difficulty best times, mobile long-press flagging, and win confetti
- **Drop Four** — Connect Four against a minimax + alpha-beta AI (three search depths) plus a local 2-player mode, with drop animations, win-line highlight, and a win-streak record
- **Word Five** — a Wordle-style word guesser: six tries, on-screen + physical keyboard, correct duplicate-letter shading, and a win-streak record
- **Maze Runner** — a playable timed maze: run to the exit, grab the gems, dodge fog-of-war at higher levels, with a BFS/DFS/A* visualizer kept as a "Watch AI Solve" mode
- **Light Cycles** — Tron-style trail duel: trap the AI rider in your light trail (it flood-fills to dodge dead-end pockets), or duel a friend in local 2-player on one keyboard, with a persistent vs-AI win streak
- **Memory Matrix** — Simon on a 3×3 light grid: watch the pattern, play it back by pad or keys 1-9; each pad owns a pitch so the melody is the memory aid, one more step per round, faster every time
- **Game of Life** — Conway's cellular automaton with click-to-draw, preset patterns, age-based cell coloring, and a live population sparkline

**Standalone pages:**
- **Age of War** (`ageofwar/`) — side-scrolling strategy game: march your army through the ages and crush the enemy base
- **Startup Tycoon** (`tycoon/`) — idle/story tycoon game with a 3D scene (`play.html`; the 🐶 Beagle Sim reskin is the same build at `play.html?theme=beagle`)
- **Grow Op** (`drug-lab.html`) — 3D room-builder with risk/heat mechanics
- **Homeless Village** (`homeless-village.html`) — 3D survival/village-building game
- **Hearthvale** (`hearthvale.html`) — cozy top-down town builder with procedural pixel-art, villagers, seasons, and a warm settlement to grow
- **Voxel Isle** (`voxel-garden.html`) — a cozy voxel farm-and-town builder on a floating sky island (three.js). Till soil, plant seeds (premium crops yield more), water and harvest for coins, and level up to unlock new crops, decorations, and extra floating islets. Each crop has a **favoured season** where it grows faster and sells for more, so planting becomes a seasonal strategy. It grows into a whole settlement: **raise-and-sell livestock** (buy a baby, raise it, cash it in or keep it for goods), a **crew of pathfinding villagers** who do every chore — till, plant, water, harvest, collect, tend, take breaks at the tavern (assign them roles once you build one) and duck inside to shelter when it rains, and a **town economy** where a Trader's Market stockpiles the goods you gather and a Trader wagon buys them in bulk, a Tavern serves them for steady income, a Bakery + Windmill turn crops into bread, an **Apiary**'s bees make honey and pollinate nearby fields, a **Brewery** ferments that honey into mead, a **Greenhouse** keeps crops growing through winter, and a Well auto-waters nearby soil (chimney smoke drifts from the working buildings). A rotating **daily market demand** makes one good sell for +50% each day, and seasonal **festivals** open a +35% sell window — the Town Almanac previews both, along with a roster of your named townsfolk. Buy land expansions, grow your population with settlers, and climb town ranks (Homestead → Sky City) with your own procedurally-named town. Plus **first-person mode**, **fishing** in the pond, festivals with confetti and lanterns, **rainbows** after showers, **shooting stars** at night, four seasons, rain/snow/falling leaves, a resident sparrow, butterflies, a town cat, a coin-digging farm dog, a pond duck, ~38 achievements, photo mode, generative music, day/night, fireflies, and autosave
- **Eureka Studio** (`agentic-os.html`) — the dev office, live: each agent has a desk assigned to one of the games, and their status is driven by real GitHub data. When an open pull request touches a game's files, that game's agent is at the keyboard (animated typing, glowing monitor, a PR badge); when there's no open work, they nap. Clicking a desk lists the actual PRs with links; open issues are pinned to a corkboard as sticky notes and the latest commits on main fill the wall. Fetches straight from the public GitHub API in the visitor's browser (ETag-cached, polled every 60s) — no backend, no keys (an optional personal token, stored only in the browser, raises the rate limit)

The hub also has a few non-game utilities: a productivity view (notes, todos, pomodoro, bookmarks), a "Studio Crew" org chart, and a Hall of Fame view for high scores.

## Stack

- Plain HTML5 Canvas for 2D games; the 3D games (Startup Tycoon, Grow Op, Homeless Village) use a vendored copy of three.js in `vendor/` (no CDN, no npm) so they work fully offline
- Art is mostly procedural — drawn with Canvas 2D / WebGL at runtime rather than loaded from image assets
- Scores, saves, and preferences persist via `localStorage` (per game — see the key registry below)
- Shared arcade chrome (nav, cards, view-switching) lives in `css/arcade.css`, `css/arcade-chrome.css`, and the `data-view` routing in `index.html`; each game otherwise owns its own CSS/JS
- `index.html` links each stylesheet directly rather than through an `@import` chain, and every game script is `defer`red — the one inline block runs inside `DOMContentLoaded`

### localStorage keys

Every game owns its own keys. Add a new game's key here when you add the game,
and namespace it — two builds sharing one key is what caused the Startup
Tycoon / Beagle Sim save collision (`ROADMAP.md`, TYC-3).

| Key(s) | Owner |
|---|---|
| `snake-high`, `tetris-high`, `breakout-high`, `asteroids-high`, `g2048-best` | arcade canvas games |
| `mines-best-beginner` / `-intermediate` / `-expert`, `mines-diff` | Minefield |
| `connect4-streak`, `c4-diff` | Drop Four |
| `word5-streak` | Word Five |
| `cycles-streak` | Light Cycles |
| `matrix-best` | Memory Matrix |
| `arcade-muted` | `js/sfx.js` (arcade hub) |
| `aow-achievements`, `aow-difficulty`, `aow-muted`, `aow-welcome-seen` | Age of War |
| `startup-tycoon-v7`, `tycoon:*` | Startup Tycoon |
| `beagle-sim-v1`, `beagle:*` | Beagle Sim (the `?theme=beagle` variant of Startup Tycoon) |
| `startup_tycoon_theme`, `startup_tycoon_panels_collapsed`, `startup_tycoon_feed_open` | shared by both tycoon variants (cosmetic only) |
| `drug-lab-v1` | Grow Op |
| `homeless_village_v1` | Homeless Village |
| `hearthvale-v1` | Hearthvale |
| `voxel-garden-v1` | Voxel Isle |
| `studio-token`, `studio-chat-v1` | Eureka Studio (token stays in the browser, sent only to api.github.com) |
| `eureka-notes`, `eureka-todos`, `eureka-bookmarks`, `eureka-pomo-sessions`, `eureka-calendar-config`, `eureka-gt-clientid`, `eureka-gt-lists` | productivity view |
| `eureka-personal-pin`, `eureka-personal-*` | personal view — **stored unencrypted**; the PIN is a casual screen lock, not security, and the UI says so |

## Running locally

No build step, no install:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Opening `index.html` directly as a `file://` URL also mostly works, but some games/assets prefer being served over HTTP.

## Deployment

Deployed as a static site on Vercel. `vercel.json` sets `cleanUrls` (so `/tycoon` serves `tycoon/index.html`), a couple of legacy redirects, and long-lived cache headers for `vendor/`, `css/`, `js/`, and `assets/`. There's a custom `404.html`, plus `robots.txt` and `sitemap.xml` for crawlers.

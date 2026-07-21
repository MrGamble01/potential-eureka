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
- **Game of Life** — Conway's cellular automaton with click-to-draw, preset patterns, age-based cell coloring, and a live population sparkline

**Standalone pages:**
- **Age of War** (`ageofwar/`) — side-scrolling strategy game: march your army through the ages and crush the enemy base
- **Startup Tycoon** (`tycoon/`) — idle/story tycoon game with a 3D scene (`play.html`, `beagle.html`)
- **Grow Op** (`drug-lab.html`) — 3D room-builder with risk/heat mechanics
- **Homeless Village** (`homeless-village.html`) — 3D survival/village-building game
- **Hearthvale** (`hearthvale.html`) — cozy top-down town builder with procedural pixel-art, villagers, seasons, and a warm settlement to grow
- **Voxel Isle** (`voxel-garden.html`) — cozy voxel garden on a floating sky island (three.js): till soil, plant seeds, water them, harvest for coins, and level up to unlock new crops, decorations, sprinklers, and extra floating islets — with four seasons (snowy winters, autumn leaves), rain showers, a resident voxel sparrow, achievements, a photo mode, generative music, day/night, fireflies, and autosave
- **Eureka Studio** (`agentic-os.html`) — the dev office, live: each agent has a desk assigned to one of the games, and their status is driven by real GitHub data. When an open pull request touches a game's files, that game's agent is at the keyboard (animated typing, glowing monitor, a PR badge); when there's no open work, they nap. Clicking a desk lists the actual PRs with links; open issues are pinned to a corkboard as sticky notes and the latest commits on main fill the wall. Fetches straight from the public GitHub API in the visitor's browser (ETag-cached, polled every 60s) — no backend, no keys (an optional personal token, stored only in the browser, raises the rate limit)

The hub also has a few non-game utilities: a productivity view (notes, todos, pomodoro, bookmarks), a "Studio Crew" org chart, and a Hall of Fame view for high scores.

## Stack

- Plain HTML5 Canvas for 2D games; the 3D games (Startup Tycoon, Grow Op, Homeless Village) use a vendored copy of three.js in `vendor/` (no CDN, no npm) so they work fully offline
- Art is mostly procedural — drawn with Canvas 2D / WebGL at runtime rather than loaded from image assets
- Scores, saves, and preferences persist via `localStorage` (per game — see `js/*.js` and `homeless-village/js/save.js`)
- Shared arcade chrome (nav, cards, view-switching) lives in `css/arcade.css`, `css/arcade-chrome.css`, and the `data-view` routing in `index.html`; each game otherwise owns its own CSS/JS

## Running locally

No build step, no install:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Opening `index.html` directly as a `file://` URL also mostly works, but some games/assets prefer being served over HTTP.

## Deployment

Deployed as a static site on Vercel. `vercel.json` sets `cleanUrls` (so `/tycoon` serves `tycoon/index.html`), a couple of legacy redirects, and long-lived cache headers for `vendor/`, `css/`, `js/`, and `assets/`. There's a custom `404.html`, plus `robots.txt` and `sitemap.xml` for crawlers.

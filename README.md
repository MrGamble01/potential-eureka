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
- **Maze Solver** — generates mazes via recursive backtracking, then solves them with animated BFS, DFS, or A*
- **Game of Life** — Conway's cellular automaton with click-to-draw and preset patterns

**Standalone pages:**
- **Age of War** (`ageofwar/`) — side-scrolling strategy game: march your army through the ages and crush the enemy base
- **Startup Tycoon** (`tycoon/`) — idle/story tycoon game with a 3D scene (`play.html`, `beagle.html`)
- **Grow Op** (`drug-lab.html`) — 3D room-builder with risk/heat mechanics
- **Homeless Village** (`homeless-village.html`) — 3D survival/village-building game

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

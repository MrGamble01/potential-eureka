# Potential Eureka

A retro terminal-style dashboard with built-in arcade games. Zero dependencies — pure HTML, CSS, and JavaScript.

## Features

### Dashboard
- Real-time clock and calendar
- Simulated system monitor (CPU, memory, disk, network)
- Activity graph
- Rotating quotes
- Weather widget

### Games
- **Snake** — Classic arcade snake with WASD/arrow key controls, score tracking, and increasing difficulty
- **Maze Solver** — Generates random mazes via recursive backtracking, then solves them with animated BFS, DFS, or A* search
- **Game of Life** — Conway's cellular automaton with click-to-draw, preset patterns (Glider, Pulsar, Gosper Gun, etc.), speed control, and color-coded cell states

## Getting Started

Just open `index.html` in a browser:

```bash
open index.html
# or
python3 -m http.server 8000
```

No build step. No dependencies. No frameworks.

## Controls

| Game | Controls |
|------|----------|
| Snake | Arrow keys or WASD to move, Space to restart |
| Maze | Click Generate, pick an algorithm, click Solve |
| Game of Life | Click to draw cells, use Play/Step/Random buttons |

## Tech

- Vanilla HTML5 Canvas for all game rendering
- CSS custom properties for the retro terminal theme
- Scanline overlay effect for that CRT monitor feel

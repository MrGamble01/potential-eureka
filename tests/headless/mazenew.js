/*
 * MAZE-2 — Maze Runner: the next-level build must not outlive its run.
 *
 * winLevel() shows the clear message and arms `setTimeout(buildLevel, 900)`
 * so you get a beat to read it. Nothing cancelled that timer. Press N (or
 * New Game) inside those 900ms and newGame() built you a level-1 maze — and
 * 900ms later the stale timer built ANOTHER one over the top of it, throwing
 * away the maze you were already walking, your position in it, and the clock
 * you were racing.
 *
 *  A. Read the maze off the canvas and walk it to the exit (proves the
 *     harness can actually clear a level, so a silent no-op can't pass).
 *  B. Baseline: left alone, a cleared level DOES roll into the next one.
 *  C. MAZE-2: N inside the window leaves you on the maze N gave you.
 *  D. MAZE-2: the same through the New Game button.
 *  E. Zero page errors.
 *
 * Hook-free: the grid is read off the canvas by wall colour — the maze the
 * player is looking at — and driven with the same arrow keys they press.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

const COLS = 31, ROWS = 21;
const WINDOW_MS = 900;   // the clear-to-rebuild delay in js/maze.js

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// The maze as drawn. Walls are the only thing painted over the #0d1117
// background (rgba(255,255,255,0.08) → ~rgb(32,36,41)); the runner, the exit
// and the gems are bright marks sitting ON path cells, so anything that is
// not wall-coloured is a cell you can stand in.
const readGrid = page => page.evaluate(([COLS, ROWS]) => {
  const c = document.getElementById('maze-canvas');
  const x = c.getContext('2d');
  const cw = c.width / COLS, ch = c.height / ROWS;
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    let line = '';
    for (let col = 0; col < COLS; col++) {
      const d = x.getImageData(Math.floor(col * cw + cw / 2), Math.floor(r * ch + ch / 2), 1, 1).data;
      const wall = Math.abs(d[0] - 32) <= 6 && Math.abs(d[1] - 36) <= 6 && Math.abs(d[2] - 41) <= 6;
      line += wall ? '1' : '0';
    }
    rows.push(line);
  }
  return rows;
}, [COLS, ROWS]);

// Shortest path from the entrance to the exit. The generator carves a
// spanning tree, so there is exactly one and it always exists.
function route(grid) {
  const start = [1, 0], goal = [ROWS - 2, COLS - 1];
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const q = [start]; seen[start[0]][start[1]] = [null, null];
  while (q.length) {
    const [r, c] = q.shift();
    if (r === goal[0] && c === goal[1]) break;
    for (const [dr, dc, key] of [[-1, 0, 'ArrowUp'], [1, 0, 'ArrowDown'], [0, -1, 'ArrowLeft'], [0, 1, 'ArrowRight']]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (grid[nr][nc] === '1' || seen[nr][nc]) continue;
      seen[nr][nc] = [[r, c], key];
      q.push([nr, nc]);
    }
  }
  if (!seen[goal[0]][goal[1]]) return null;
  const keys = [];
  let cur = goal;
  while (cur && !(cur[0] === start[0] && cur[1] === start[1])) {
    const [prev, key] = seen[cur[0]][cur[1]];
    keys.push(key); cur = prev;
  }
  return keys.reverse();
}

const status = page => page.textContent('#maze-status');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  await page.goto(BASE + '/index.html#maze', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // Walk the maze that is on screen to the exit. Returns the moment the
  // clear message appeared — the start of the 900ms window under test.
  async function clearLevel() {
    const grid = await readGrid(page);
    const walls = grid.join('').split('1').length - 1;
    if (walls < 100) throw new Error('the canvas did not read as a maze (' + walls + ' wall cells)');
    const keys = route(grid);
    if (!keys) throw new Error('no route from the entrance to the exit in the maze as read');
    for (const k of keys) await page.keyboard.press(k);
    await page.waitForFunction(
      () => /cleared/i.test(document.getElementById('maze-status').textContent),
      null, { timeout: 8000 });
    return Date.now();
  }

  // ── A. the harness can really clear a level ──
  let clearedAt = await clearLevel();
  ok(/cleared/i.test(await status(page)), 'A: walking the maze as read off the canvas reaches the exit');

  // ── B. baseline: left alone, the next level still arrives ──
  const before = (await readGrid(page)).join('');
  await page.waitForTimeout(WINDOW_MS + 700);
  const after = (await readGrid(page)).join('');
  ok(before !== after, 'B: baseline — a cleared level still rolls into the next maze on its own');

  // ── C. N inside the window ──
  clearedAt = await clearLevel();
  await page.keyboard.press('n');
  const pressedIn = Date.now() - clearedAt;
  ok(pressedIn < WINDOW_MS, `C: caught the window — N pressed ${pressedIn}ms into the ${WINDOW_MS}ms rebuild delay`);
  await page.waitForTimeout(200);
  const fresh = (await readGrid(page)).join('');
  await page.waitForTimeout(WINDOW_MS + 700);
  ok((await readGrid(page)).join('') === fresh,
    'MAZE-2: the stale rebuild no longer replaces the maze N just gave you');
  ok(/LV 1/.test(await status(page)) || !/cleared/i.test(await status(page)),
    'C: and the new run is showing, not the old level-clear message');

  // ── D. the same through the New Game button ──
  clearedAt = await clearLevel();
  await page.click('#view-maze button.primary');
  const clickedIn = Date.now() - clearedAt;
  ok(clickedIn < WINDOW_MS, `D: caught the window — New Game clicked ${clickedIn}ms in`);
  await page.waitForTimeout(200);
  const freshB = (await readGrid(page)).join('');
  await page.waitForTimeout(WINDOW_MS + 700);
  ok((await readGrid(page)).join('') === freshB,
    'MAZE-2: the stale rebuild no longer replaces the maze New Game just gave you');

  // ── E. and the new maze is still playable, not a frozen board ──
  const grid = await readGrid(page);
  ok(route(grid) !== null, 'E: the maze you are left on is a real, solvable maze');

  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

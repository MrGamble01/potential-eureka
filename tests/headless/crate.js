/*
 * CRATE-1 — leaving Crate Escape on a solved board (re-runnable, no hooks).
 *
 *  A. The board can be read off the canvas at all (walls, goals, crates,
 *     player), and level 1 is solvable from what we read.
 *  B. Solving raises the win overlay and its "next puzzle" prompt.
 *  C. Leaving the view and coming back lands on the NEXT puzzle, not on the
 *     finished one with the prompt thrown away — and the ladder position is
 *     persisted, so a reload resumes there too.
 *  D. Leaving mid-puzzle is untouched: same level, same move count, same
 *     board when you return.
 *  E. Zero page errors.
 *
 * The board is read from pixels rather than from the module: CrateEscapeGame
 * is an IIFE exposing only its controls, and QA-23 settled that suites do not
 * get a window.__ hook bolted on to see inside one.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const WIDTH = 480, HEIGHT = 420;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const K = (x, y) => x + ',' + y;

// Grid size for a level, the one thing pixels cannot give us: it is the
// shipped generator's own formula (js/crateescape.js genLevel), and every
// read below cross-checks it — a wrong guess makes the outer ring stop
// reading as wall and assertion A fails loudly rather than silently.
const gridOf = n => [7 + Math.min(3, Math.floor((n - 1) / 5)), 6 + Math.min(3, Math.floor((n - 1) / 7))];

const hud = (page, id) => page.evaluate(i => document.getElementById(i).textContent.trim(), id);

/*
 * One evaluate, one frame: sample every cell's centre plus the four corners
 * of the goal marker's stroke rect (draw() strokes it at 28%..72%).
 *   centre   → wall #21262d · crate #F0883E · crate-on-goal #3FB950
 *              · player #22d3ee · bare floor
 *   corners  → the green goal stroke, where nothing is drawn over it
 * A crate on a goal announces the goal by being green; the one cell that can
 * hide a goal completely is the one the player stands on, which the caller
 * resolves by stepping off and pressing Z.
 */
function readBoard(page, gw, gh) {
  return page.evaluate(({ gw, gh, WIDTH, HEIGHT }) => {
    const c = document.getElementById('crate-canvas');
    const x = c.getContext('2d');
    const dpr = c.width / WIDTH;
    const T = Math.min(Math.floor(WIDTH / gw), Math.floor(HEIGHT / gh));
    const ox = (WIDTH - gw * T) / 2, oy = (HEIGHT - gh * T) / 2;
    const px = (u, v) => {
      const d = x.getImageData(Math.round(u * dpr), Math.round(v * dpr), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const cells = [];
    for (let y = 0; y < gh; y++) {
      for (let gx = 0; gx < gw; gx++) {
        const cx = ox + gx * T, cy = oy + y * T;
        const centre = px(cx + T / 2, cy + T / 2);
        const corners = [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]
          .map(([fx, fy]) => px(cx + T * fx, cy + T * fy));
        cells.push({ x: gx, y, centre, corners });
      }
    }
    return cells;
  }, { gw, gh, WIDTH, HEIGHT });
}

// Tight: the bare floor (rgba white .02 over #0d1117 ≈ 18,22,28) sits only
// ~15 per channel from the wall's #21262d, so a loose tolerance would read an
// empty room as solid rock.
const near = ([r, g, b], [R, G, B], tol = 10) =>
  Math.abs(r - R) <= tol && Math.abs(g - G) <= tol && Math.abs(b - B) <= tol;
// Green reads green whatever its glow has done to it, and cyan never does:
// #22d3ee is (34,211,238), so blue always beats green there.
const greenish = ([r, g, b]) => g > r + 30 && g > b + 30;

function classify(cells) {
  const wall = new Set(), crates = new Set(), goals = new Set();
  let player = null;
  for (const c of cells) {
    const at = K(c.x, c.y);
    if (near(c.centre, [33, 38, 45])) { wall.add(at); continue; }
    if (near(c.centre, [240, 136, 62])) crates.add(at);
    else if (near(c.centre, [63, 185, 80])) { crates.add(at); goals.add(at); }
    else if (near(c.centre, [34, 211, 238])) player = [c.x, c.y];
    if (!crates.has(at) && c.corners.some(greenish)) goals.add(at);
  }
  return { wall, crates, goals, player };
}

// The player's own cell is the only one that can hide a goal, so step off it
// and undo: Z restores position, crates AND the move counter, so the board is
// byte-for-byte where it was.
async function goalUnderPlayer(page, gw, gh, board) {
  const [x, y] = board.player;
  for (const [name, [dx, dy]] of Object.entries(DIRS)) {
    const to = K(x + dx, y + dy);
    if (board.wall.has(to) || board.crates.has(to)) continue;
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(90);
    const after = classify(await readBoard(page, gw, gh));
    await page.keyboard.press('z');
    await page.waitForTimeout(90);
    return after.goals.has(K(x, y));
  }
  return false;   // walled in on all four sides: not a board this game makes
}

// Sokoban BFS over (player, crates). Level 1 ships one crate in a 7x6 room,
// so this closes in milliseconds; the cap keeps a future harder level from
// hanging the battery instead of failing it.
function solve(board, gw, gh) {
  const goals = [...board.goals].sort().join(';');
  const start = { p: board.player, c: [...board.crates].sort() };
  const sig = s => s.p.join(',') + '|' + s.c.join(';');
  const done = s => s.c.slice().sort().join(';') === goals;
  if (done(start)) return [];
  const seen = new Set([sig(start)]);
  let q = [{ s: start, path: [] }];
  for (let step = 0; step < 200000 && q.length; step++) {
    const { s, path } = q.shift();
    for (const [name, [dx, dy]] of Object.entries(DIRS)) {
      const nx = s.p[0] + dx, ny = s.p[1] + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      if (board.wall.has(K(nx, ny))) continue;
      let c = s.c;
      if (c.includes(K(nx, ny))) {
        const bx = nx + dx, by = ny + dy;
        if (board.wall.has(K(bx, by)) || c.includes(K(bx, by))) continue;
        if (bx < 0 || by < 0 || bx >= gw || by >= gh) continue;
        c = c.filter(k => k !== K(nx, ny)).concat(K(bx, by)).sort();
      }
      const next = { p: [nx, ny], c };
      if (seen.has(sig(next))) continue;
      seen.add(sig(next));
      const p2 = path.concat(name);
      if (done(next)) return p2;
      q.push({ s: next, path: p2 });
    }
  }
  return null;
}

const leaveAndReturn = async page => {
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { location.hash = '#crateescape'; });
  await page.waitForTimeout(500);
};

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  // A fresh ladder: level 1, no bests, so the run below is the same one on
  // every re-run.
  await page.addInitScript(() => {
    localStorage.removeItem('crate-best');
    localStorage.removeItem('crate-moves');
    localStorage.setItem('crate-level', '1');
  });
  await page.goto(BASE + '/index.html#crateescape', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ---- A. read the board off the canvas -----------------------------------
  ok(await hud(page, 'crate-level') === '1', 'opens on level 1');
  let [gw, gh] = gridOf(1);
  let board = classify(await readBoard(page, gw, gh));
  const ring = [];
  for (let x = 0; x < gw; x++) { ring.push(K(x, 0), K(x, gh - 1)); }
  for (let y = 0; y < gh; y++) { ring.push(K(0, y), K(gw - 1, y)); }
  ok(ring.every(k => board.wall.has(k)), `the ${gw}x${gh} room reads as walled all round`);
  ok(!!board.player, 'the player reads off the canvas');
  ok(board.crates.size > 0, `crates read off the canvas (${board.crates.size})`);
  if (await goalUnderPlayer(page, gw, gh, board)) board.goals.add(K(...board.player));
  ok(board.goals.size === board.crates.size,
    `one pad per crate (${board.goals.size} pads, ${board.crates.size} crates)`);
  ok([...board.crates].some(k => !board.goals.has(k)), 'level 1 opens unsolved');

  const path = solve(board, gw, gh);
  ok(Array.isArray(path) && path.length > 0, `level 1 is solvable in ${path ? path.length : '?'} moves`);
  if (!path) { console.log('\ncannot continue without a solution'); await browser.close(); process.exit(1); }

  // ---- B. solve it --------------------------------------------------------
  for (const m of path) { await page.keyboard.press(KEYS[m]); await page.waitForTimeout(45); }
  await page.waitForTimeout(300);
  const overlay = await page.evaluate(() => {
    const el = document.getElementById('crate-overlay');
    return { shown: getComputedStyle(el).display !== 'none', text: el.textContent };
  });
  ok(overlay.shown, 'the win overlay is up');
  ok(/Solved in \d+ moves/.test(overlay.text), 'it says how many moves it took');
  ok(/next puzzle/i.test(overlay.text), 'it prompts for the next puzzle');
  ok(await hud(page, 'crate-solved') === '1', 'the ladder counts the solve');

  // ---- C. leave on the win, come back -------------------------------------
  // The prompt is the only thing that advances the ladder, and leaving the
  // view used to throw it away: the board stayed solved, SPACE stopped doing
  // anything, and the puzzle looked finished with nothing to press.
  await leaveAndReturn(page);
  ok(await hud(page, 'crate-level') === '2', 'coming back lands on the next puzzle, not the solved one');
  ok(await hud(page, 'crate-moves-hud') === '0', 'the new puzzle starts at zero moves');
  ok(await page.evaluate(() => localStorage.getItem('crate-level')) === '2',
    'the ladder position is persisted, so a reload resumes there too');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('crate-overlay')).display === 'none'),
    'no stale win overlay on the new puzzle');

  [gw, gh] = gridOf(2);
  board = classify(await readBoard(page, gw, gh));
  ok(!!board.player && board.crates.size > 0, 'level 2 reads off the canvas');
  if (await goalUnderPlayer(page, gw, gh, board)) board.goals.add(K(...board.player));
  ok([...board.crates].some(k => !board.goals.has(k)), 'level 2 is a real puzzle, not a solved board');

  // ---- D. leaving mid-puzzle still leaves the run alone --------------------
  let moved = null;
  for (const [name, [dx, dy]] of Object.entries(DIRS)) {
    const to = K(board.player[0] + dx, board.player[1] + dy);
    if (board.wall.has(to) || board.crates.has(to)) continue;
    await page.keyboard.press(KEYS[name]); await page.waitForTimeout(120);
    moved = name; break;
  }
  ok(moved !== null, 'a legal move exists on level 2');
  ok(await hud(page, 'crate-moves-hud') === '1', 'the move counts');
  const midBoard = JSON.stringify(classify(await readBoard(page, gw, gh)), (k, v) => v instanceof Set ? [...v].sort() : v);
  await leaveAndReturn(page);
  ok(await hud(page, 'crate-level') === '2', 'an unsolved level is not advanced by leaving');
  ok(await hud(page, 'crate-moves-hud') === '1', 'an unsolved run keeps its move count');
  const backBoard = JSON.stringify(classify(await readBoard(page, gw, gh)), (k, v) => v instanceof Set ? [...v].sort() : v);
  ok(backBoard === midBoard, 'and comes back to the same board you left');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/*
 * CE-1 — Crate Escape: leaving on a solved level must not strand you.
 *
 *  A. Harness proof-of-life: the board is read off the canvas and level 1
 *     is actually solved with the arrow keys a player presses, so nothing
 *     below can pass vacuously against a suite that never got that far.
 *  B. CE-1: solve, leave the view, come back — the finished puzzle must not
 *     still be sitting there with its banner gone and SPACE dead.
 *  C. Baseline: leaving an UNSOLVED level must still leave it exactly where
 *     you left it, so a fix that just reloads on every exit can't pass.
 *  D. Zero page errors.
 *
 * No hooks (QA-23): the module keeps its state private, so the grid is read
 * from the pixels and the level is driven through the keyboard.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// Canvas geometry and palette, mirrored from js/crateescape.js draw().
const W = 480, H = 420;
const WALL = [33, 38, 45];      // #21262d
const CRATE = [240, 136, 62];   // #F0883E  (off pad)
const DONE = [63, 185, 80];     // #3FB950  (on pad, and the empty pad's ring)
const PLAYER = [34, 211, 238];  // #22d3ee

// Room size is a pure function of the level number (genLevel()); the border
// assertion in readBoard() is what catches this drifting out of step.
const dimsFor = n => [7 + Math.min(3, Math.floor((n - 1) / 5)), 6 + Math.min(3, Math.floor((n - 1) / 7))];

const hud = (page, id) => page.evaluate(i => (document.getElementById(i) || {}).textContent, id);
const overlayShown = page => page.evaluate(() => {
  const ov = document.getElementById('crate-overlay');
  return !!ov && getComputedStyle(ov).display !== 'none';
});

/* Read walls / crates / player from cell centres, and the pads from the only
 * green pixels on an unsolved one-crate board (the pad ring is a stroke, so
 * an empty pad's centre reads as plain floor). */
function readBoard(page, gw, gh) {
  return page.evaluate(({ gw, gh, W, H }) => {
    const c = document.getElementById('crate-canvas');
    const x = c.getContext('2d');
    const dpr = c.width / W;
    const img = x.getImageData(0, 0, c.width, c.height).data;
    const at = (lx, ly) => {
      const px = Math.round(lx * dpr), py = Math.round(ly * dpr);
      const o = (py * c.width + px) * 4;
      return [img[o], img[o + 1], img[o + 2]];
    };
    const T = Math.min(Math.floor(W / gw), Math.floor(H / gh));
    const ox = (W - gw * T) / 2, oy = (H - gh * T) / 2;

    const cells = [];
    for (let y = 0; y < gh; y++) {
      const row = [];
      for (let gx = 0; gx < gw; gx++) row.push(at(ox + gx * T + T / 2, oy + y * T + T / 2));
      cells.push(row);
    }

    // Bounding box of every green pixel = the single pad's ring.
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let py = 0; py < c.height; py++) {
      for (let px = 0; px < c.width; px++) {
        const o = (py * c.width + px) * 4;
        if (Math.abs(img[o] - 63) < 26 && Math.abs(img[o + 1] - 185) < 26 && Math.abs(img[o + 2] - 80) < 26) {
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        }
      }
    }
    const green = maxX < 0 ? null
      : [Math.floor((((minX + maxX) / 2) / dpr - ox) / T), Math.floor((((minY + maxY) / 2) / dpr - oy) / T)];
    return { cells, green, T, ox, oy };
  }, { gw, gh, W, H });
}

// Tight: the floor (17,21,27) and a wall (33,38,45) are only ~17 apart per
// channel, so a loose match reads the whole room as solid.
const near = (rgb, ref) => Math.abs(rgb[0] - ref[0]) < 10 && Math.abs(rgb[1] - ref[1]) < 10 && Math.abs(rgb[2] - ref[2]) < 10;

/* Sokoban BFS over (player, crate) — one crate, so the state space is tiny. */
function solve(walls, player, crate, goal) {
  const DIRS = [[0, -1, 'ArrowUp'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft'], [1, 0, 'ArrowRight']];
  const gh = walls.length, gw = walls[0].length;
  const inside = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh;
  const enc = s => s.join(',');
  const start = [player[0], player[1], crate[0], crate[1]];
  const seen = new Set([enc(start)]);
  let q = [{ s: start, path: [] }];
  while (q.length) {
    const { s, path } = q.shift();
    if (s[2] === goal[0] && s[3] === goal[1]) return path;
    if (path.length > 60) continue;
    for (const [dx, dy, key] of DIRS) {
      const nx = s[0] + dx, ny = s[1] + dy;
      if (!inside(nx, ny) || walls[ny][nx]) continue;
      let cx = s[2], cy = s[3];
      if (nx === cx && ny === cy) {
        const px = cx + dx, py = cy + dy;
        if (!inside(px, py) || walls[py][px]) continue;
        cx = px; cy = py;
      }
      const ns = [nx, ny, cx, cy];
      if (seen.has(enc(ns))) continue;
      seen.add(enc(ns));
      q.push({ s: ns, path: [...path, key] });
    }
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#crateescape', { waitUntil: 'load' });
  await page.waitForTimeout(1400);

  // ── A. read level 1 and actually solve it ──────────────────────────
  ok(await hud(page, 'crate-level') === '1', 'a fresh visitor starts on level 1');
  const [gw, gh] = dimsFor(1);
  const { cells, green } = await readBoard(page, gw, gh);

  const walls = cells.map(row => row.map(p => near(p, WALL)));
  let border = true;
  for (let x = 0; x < gw; x++) if (!walls[0][x] || !walls[gh - 1][x]) border = false;
  for (let y = 0; y < gh; y++) if (!walls[y][0] || !walls[y][gw - 1]) border = false;
  ok(border, `the ${gw}x${gh} room reads back with a solid wall border (grid guard)`);

  let player = null, crate = null;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    if (near(cells[y][x], PLAYER)) player = [x, y];
    if (near(cells[y][x], CRATE)) crate = [x, y];
  }
  ok(!!player && !!crate && !!green, `board read: player ${player}, crate ${crate}, pad ${green}`);

  const path = solve(walls, player, crate, green);
  ok(!!path && path.length > 0, `a push route exists (${path ? path.length : 0} keys)`);
  for (const key of path || []) { await page.keyboard.press(key); await page.waitForTimeout(45); }
  await page.waitForTimeout(400);

  ok(await overlayShown(page), 'solving level 1 raises the Solved banner');

  // ── B. CE-1: leave while solved, come back ─────────────────────────
  await page.evaluate(() => { location.hash = 'arcade'; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { location.hash = 'crateescape'; });
  await page.waitForTimeout(600);

  const lvlBack = await hud(page, 'crate-level');
  ok(lvlBack === '2', `coming back from a solved level lands on the next puzzle (level ${lvlBack})`);
  ok(await hud(page, 'crate-moves-hud') === '0', 'the returned puzzle starts at 0 moves');

  const back = await readBoard(page, ...dimsFor(+lvlBack || 1));
  let orange = 0;
  for (const row of back.cells) for (const p of row) if (near(p, CRATE)) orange++;
  ok(orange > 0, 'at least one crate is off its pad again — a puzzle, not a finished board');

  // The one key the banner told you to press must still do something: on a
  // stranded solved board SPACE was dead, because solvedNow had been cleared.
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  ok(await hud(page, 'crate-level') === lvlBack, 'SPACE on the fresh puzzle does not skip a level');

  // ── C. baseline: an unsolved level survives the round trip ─────────
  // This is the other end of the fix: exiting must advance a SOLVED level and
  // nothing else, so "reload the level on every exit" can't pass either.
  const dims = dimsFor(+lvlBack || 1);
  let walked = false;
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.press(key); await page.waitForTimeout(120);
    if (await hud(page, 'crate-moves-hud') !== '0') { walked = true; break; }
  }
  ok(walked, 'the returned puzzle is playable — a move lands');
  const movesMid = await hud(page, 'crate-moves-hud');
  const mid = await readBoard(page, ...dims);

  await page.evaluate(() => { location.hash = 'arcade'; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { location.hash = 'crateescape'; });
  await page.waitForTimeout(600);

  ok(await hud(page, 'crate-level') === lvlBack, 'leaving an unsolved level does not advance it');
  ok(await hud(page, 'crate-moves-hud') === movesMid, `an unsolved level keeps your move count (${movesMid})`);
  const after = await readBoard(page, ...dims);
  ok(JSON.stringify(after.cells) === JSON.stringify(mid.cells),
    'an unsolved board comes back exactly as you left it, not re-rolled');

  // ── D. ────────────────────────────────────────────────────────────
  ok(errs.length === 0, `no page errors (${errs.join(' | ') || 'none'})`);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

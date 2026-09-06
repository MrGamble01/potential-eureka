/*
 * MAZE-1 — the runner never got control back after "Watch AI Solve".
 *
 * `solve()` in js/maze.js pauses the runner (`playing = false`) so the
 * BFS/DFS/A* demo can animate without the player also moving underneath
 * it — a deliberate, commented pause. But when the demo finished, nothing
 * ever set `playing` back to `true`. Leaving mid-demo hit the same freeze:
 * `destroy()` → `cancelSolve()` invalidated the run so `solve()` returned
 * without re-arming. `move()` refuses every arrow key
 * while `!playing`, and the only thing that resets `playing = true` is
 * `buildLevel()` — reached only by "New Game" or a level win. So once a
 * player pressed Solve out of curiosity, their runner was frozen on that
 * maze for good: no error, no message, arrow keys and swipes both just
 * silently did nothing until they gave up and started over.
 *
 * Verified by canvas signature, not a hook: maze.js is a classic
 * (non-module) script, but the game keeps no state on the DOM outside
 * the canvas pixels, and `Utils.sfx` is captured into a local `const`
 * at module load (`const sfx = Utils.sfx;`), so a later `Utils.sfx = spy`
 * never reaches it — a canvas pixel diff is the honest instrument here,
 * the same way `promises.js` reads source when a hook can't reach state.
 *
 * The moves themselves are deterministic despite the maze being randomly
 * generated: `generateGrid()` always starts its carve at [1,1] and the
 * entrance is always wired open at [1,0] (see buildLevel/generateGrid),
 * so (1,0) <-> (1,1) is open on every single run, on every layout, forever.
 * Right then left across that one guaranteed edge is enough to prove
 * control before Solve and again after it, with no dependency on the
 * random layout.
 *
 *   A. Fresh runner: ArrowRight (1,0)->(1,1) visibly moves the canvas.
 *   B. Trigger "Watch AI Solve" (BFS) and wait for it to finish.
 *   C. ArrowLeft (1,1)->(1,0) after the demo also visibly moves the
 *      canvas — the regression check. Reverting the `playing = true`
 *      fix in js/maze.js turns this into a no-op frame and fails it by
 *      name.
 *   D. Same again with a second algorithm (A*) from a fresh game, so the
 *      fix isn't shown to be an artifact of one algorithm's code path.
 *   E. Leave mid-solve (Back to Games) and come back. destroy() calls
 *      cancelSolve(), which used to increment solveRun and early-return
 *      from solve() without ever re-arming `playing` — the same freeze,
 *      via the leave-view path. ArrowRight after return must still move.
 *   F. Zero page errors.
 */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const snap = page => page.evaluate(() => document.getElementById('maze-canvas').toDataURL());
const sig = s => crypto.createHash('sha1').update(s).digest('hex');

async function waitForSolveDone(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.evaluate(() => document.getElementById('maze-status').innerHTML);
    if (/path:/.test(text)) return text;
    await page.waitForTimeout(150);
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

  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { location.hash = '#maze'; });
  await page.waitForTimeout(700);

  // ---- A. control works before any Solve ----
  await page.click('#maze-canvas');
  const sBefore = await snap(page);
  await page.keyboard.press('ArrowRight');   // (1,0) -> (1,1), always open
  await page.waitForTimeout(150);
  const sAfterRight = await snap(page);
  ok(sig(sBefore) !== sig(sAfterRight), 'before Solve: ArrowRight moves the runner off the entrance');

  // ---- B. run "Watch AI Solve" (BFS) to completion ----
  await page.evaluate(() => { document.getElementById('maze-algo').value = 'bfs'; });
  await page.click('#view-maze button:has-text("Solve")');
  const bfsStatus = await waitForSolveDone(page);
  ok(!!bfsStatus, 'BFS solve demo reported a completed path');
  await page.waitForTimeout(200);

  // ---- C. control resumes after the demo ends ----
  const sAfterSolve = await snap(page);
  await page.keyboard.press('ArrowLeft');    // (1,1) -> (1,0), always open
  await page.waitForTimeout(150);
  const sAfterLeft = await snap(page);
  ok(sig(sAfterSolve) !== sig(sAfterLeft),
     'after the BFS demo finishes, ArrowLeft still moves the runner (MAZE-1)');

  // ---- D. same guarantee holds for a second algorithm, fresh game ----
  await page.click('#view-maze button:has-text("New Game")');
  await page.waitForTimeout(200);
  await page.click('#maze-canvas');
  await page.evaluate(() => { document.getElementById('maze-algo').value = 'astar'; });
  await page.click('#view-maze button:has-text("Solve")');
  const astarStatus = await waitForSolveDone(page);
  ok(!!astarStatus, 'A* solve demo reported a completed path');
  await page.waitForTimeout(200);
  const sAfterAstar = await snap(page);
  await page.keyboard.press('ArrowRight');   // (1,0) -> (1,1), always open
  await page.waitForTimeout(150);
  const sAfterAstarMove = await snap(page);
  ok(sig(sAfterAstar) !== sig(sAfterAstarMove),
     'after the A* demo finishes too, ArrowRight still moves the runner');

  // ---- E. leave mid-solve and come back — cancelSolve must re-arm ----
  await page.click('#view-maze button:has-text("New Game")');
  await page.waitForTimeout(200);
  await page.click('#maze-canvas');
  await page.evaluate(() => { document.getElementById('maze-algo').value = 'bfs'; });
  await page.click('#view-maze button:has-text("Solve")');
  await page.waitForFunction(
    () => /solving/.test(document.getElementById('maze-status').innerHTML),
    null,
    { timeout: 3000 }
  );
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = '#maze'; });
  await page.waitForTimeout(500);
  await page.click('#maze-canvas');
  const sAfterLeave = await snap(page);
  await page.keyboard.press('ArrowRight');   // (1,0) -> (1,1), always open
  await page.waitForTimeout(150);
  const sAfterLeaveMove = await snap(page);
  ok(sig(sAfterLeave) !== sig(sAfterLeaveMove),
     'after leaving mid-solve and coming back, ArrowRight still moves the runner');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

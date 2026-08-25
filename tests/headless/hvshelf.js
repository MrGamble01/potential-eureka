/* HV-39 — the Community Shelf (classic-script page, no hook).
 * A. Constants 6/7; the shelf6 goal stands; THE SEAM: the sixth
 *    camp forms under the shelf — seven goodwill known.
 * B. THE SEAM below the shelf: a fourth camp (board only) starts
 *    five known.
 * C. The shelf6 goal completes exactly at six camps.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvshelf-init')) {
      sessionStorage.setItem('hvshelf-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-festival');
      localStorage.setItem('hv-fridge', JSON.stringify({ built: true, camps: 5 }));
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the sixth camp forms under the shelf
  const shelf = await t(() => ({
    at: FRIDGE_SHELF_AT, seed3: FRIDGE_SEED3,
    goal: GOALS.some(g => g.id === 'shelf6'),
    camps: loadFridge().camps, hasShelf: fridgeHasShelf(),
    goodwill: G.goodwill,
  }));
  ok(shelf.at === 6 && shelf.seed3 === 7 && shelf.goal,
    'shelf at 6 camps / seven known — the shelf6 goal stands');
  ok(shelf.camps === 6 && shelf.hasShelf && shelf.goodwill === 7,
    `the sixth camp forms under the community shelf — seven goodwill known (${shelf.goodwill})`);

  // B — below the shelf: board-only welcome
  await page.evaluate(() => {
    localStorage.setItem('hv-fridge', JSON.stringify({ built: true, camps: 3 }));
    localStorage.removeItem('homeless_village_v1');
    const real = Storage.prototype.setItem.bind(localStorage);
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const board = await t(() => ({
    camps: loadFridge().camps, hasShelf: fridgeHasShelf(), board: fridgeHasBoard(),
    goodwill: G.goodwill,
  }));
  ok(board.camps === 4 && !board.hasShelf && board.board && board.goodwill === 5,
    `a fourth camp starts board-only — five known (${board.goodwill})`);

  // C — the goal completes exactly at six
  const goal = await t(() => {
    const g = GOALS.find(x => x.id === 'shelf6');
    const at4 = g.value() >= g.target;
    saveFridge({ built: true, camps: 6 });
    return { at4, at6: g.value() >= g.target, target: g.target };
  });
  ok(!goal.at4 && goal.at6 && goal.target === 6, 'the shelf6 goal completes exactly at six camps');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

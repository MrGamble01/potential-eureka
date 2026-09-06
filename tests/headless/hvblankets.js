/*
 * HV-126 — the community shelf said blankets, and a fresh camp
 * never woke warmer.
 *
 * HV-39: at six camps the fridge grows a community shelf —
 * blankets, spare socks, a working can opener. The sixth camp
 * starts seven goodwill known. The log named the blankets. The
 * barrel never moved. Goodwill is how the block knows you.
 * Blankets are warmth.
 *
 *  A. Source: FRIDGE_SHELF_WARMTH stands; the shelf welcome in
 *     main.js assigns warmth. ui.js untouched. Seven known stays.
 *  B. THE SEAM: the sixth camp forms under the shelf — goodwill 7
 *     and the barrel up 8. The log names the blankets.
 *  C. A fourth camp (board only, no shelf) starts five known and
 *     does not take the blankets. Kind Stranger is still a food
 *     drop, not a shelf.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the live boot seam, same shape as hvshelf.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const shelfAt = main.indexOf('if(fridgeHasShelf()){');
const shelf = shelfAt >= 0 ? main.slice(shelfAt, shelfAt + 700) : '';

// --- A. source --------------------------------------------------------
ok(/FRIDGE_SHELF_WARMTH\s*=\s*8/.test(cfg) && /FRIDGE_SEED3\s*=\s*7/.test(cfg),
   'FRIDGE_SHELF_WARMTH is 8 — the blankets are warmth, seven known stays');
ok(shelf.length > 0 && /G\.warmth\s*=\s*Math\.min\s*\(\s*100\s*,\s*\(G\.warmth\|\|0\)\s*\+\s*FRIDGE_SHELF_WARMTH\s*\)/.test(shelf),
   'the shelf welcome assigns warmth from FRIDGE_SHELF_WARMTH');
ok(/blankets/.test(shelf) && /FRIDGE_SHELF_WARMTH/.test(shelf),
   'the shelf log still names the blankets and the warmth');
ok(!/FRIDGE_SHELF_WARMTH/.test(ui) && !/fridgeHasShelf/.test(ui),
   'ui.js was not given the shelf — it still only paints the HUD');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    // The on-screen feed keeps 6 lines. Capture every append so a
    // potluck + note cannot hide the shelf welcome.
    window.__blanketsLog = [];
    var watch = new MutationObserver(function () {
      var feed = document.getElementById('log-feed');
      if (!feed || feed.__blanketsObs) return;
      feed.__blanketsObs = true;
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes.forEach(function (n) {
            window.__blanketsLog.push(n.textContent || '');
          });
        });
      }).observe(feed, { childList: true });
    });
    watch.observe(document.documentElement, { childList: true, subtree: true });
    if (!sessionStorage.getItem('hvblankets-init')) {
      sessionStorage.setItem('hvblankets-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-festival');
      localStorage.setItem('hv-fridge', JSON.stringify({ built: true, camps: 5 }));
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // --- B. the sixth camp under the shelf --------------------------------
  const sixth = await t(() => ({
    at: FRIDGE_SHELF_AT, seed3: FRIDGE_SEED3,
    warm: typeof FRIDGE_SHELF_WARMTH === 'number' ? FRIDGE_SHELF_WARMTH : null,
    camps: loadFridge().camps, hasShelf: fridgeHasShelf(),
    goodwill: G.goodwill, warmth: G.warmth,
    log: (window.__blanketsLog || []).join(' ') + ' ' +
      Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
  }));
  ok(sixth.at === 6 && sixth.seed3 === 7 && sixth.warm === 8,
     'shelf at 6 camps / seven known / +8 warmth — the constants stand');
  ok(sixth.camps === 6 && sixth.hasShelf && sixth.goodwill === 7,
     `the sixth camp forms under the community shelf — seven goodwill known (${sixth.goodwill})`);
  ok(sixth.warmth === 88,
     `and the blankets warm the barrel (80 → ${sixth.warmth})`);
  ok(/blankets/.test(sixth.log) && /\+8/.test(sixth.log),
     `the log names the blankets (${sixth.log.slice(-140)})`);

  // --- C. board-only welcome is not the shelf --------------------------
  await page.evaluate(() => {
    localStorage.setItem('hv-fridge', JSON.stringify({ built: true, camps: 3 }));
    localStorage.removeItem('homeless_village_v1');
    const real = Storage.prototype.setItem.bind(localStorage);
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const board = await t(() => ({
    camps: loadFridge().camps, hasShelf: fridgeHasShelf(), board: fridgeHasBoard(),
    goodwill: G.goodwill, warmth: G.warmth,
    log: (window.__blanketsLog || []).join(' ') + ' ' +
      Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
  }));
  ok(board.camps === 4 && !board.hasShelf && board.board && board.goodwill === 5 && board.warmth === 80,
     `a fourth camp starts board-only — five known, barrel still 80 (${board.goodwill}, ${board.warmth})`);
  ok(!/blankets/.test(board.log),
     'the board-only welcome does not name the blankets');

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.warmth = 50; G.food = 0; G.goodwill = 10;
    triggerEvent(ev, true);
    Math.random = real;
    return { warmth: G.warmth, food: G.food, goodwill: G.goodwill,
      banner: document.getElementById('ev-title').textContent };
  });
  ok(stranger.warmth === 50 && stranger.food > 0 && stranger.goodwill === 10 && stranger.banner === 'Kind Stranger',
     `Kind Stranger is still a food drop, not a shelf (${stranger.food} food)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

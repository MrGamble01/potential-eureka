/*
 * HV-106 — Corner Fridge said every fresh camp starts 3 goodwill
 * known, then the board paid 5.
 *
 * The 🧊 tooltip is a purchase promise: "every fresh camp that forms
 * beside it starts 3 goodwill known." That was true for the first
 * camps. HV-36 bolts a bulletin board at three welcomed camps and
 * seeds 5. HV-39 grows a community shelf at six and seeds 7.
 * fridgeSeedNow() already knows that. The ACTIONS string never did.
 * Hover the button beside a boarded fridge and it still says 3.
 *
 *  A. Source: fridgeTooltip is built from fridgeSeedNow. ui.js is
 *     not this ticket.
 *  B. A bare corner still promises 3.
 *  C. Three welcomed camps (the board) make the tip say 5.
 *  D. Six welcomed camps (the shelf) make the tip say 7.
 *  E. Isolation: 15 goodwill still builds it; the 3/5/7 seeds stay;
 *     Start Over still cannot unplug it.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives saveFridge + refreshFridgeTip + buildActionUI.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');

const tipFn = /function fridgeTooltip\([\s\S]*?\n\}/.exec(cfg);
ok(!!tipFn, 'fridgeTooltip is still in config.js — guards the tip');
ok(tipFn && /fridgeSeedNow\(\)/.test(tipFn[0]),
  'HV-106: fridgeTooltip is built from fridgeSeedNow, not a frozen 3');

ok(/function refreshFridgeTip\(/.test(cfg),
  'refreshFridgeTip writes the live seed onto the ACTIONS row');

ok(/refreshFridgeTip\(\)/.test(main),
  'main.js refreshes the tip before the action row is painted');

ok(!/homeless-village\/js\/ui\.js/.test(cfg) && !/function buildActionUI/.test(cfg),
  'the tip lives in config.js — ui.js is not this ticket');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const tipFor = (camps) => page.evaluate((n) => {
    saveFridge({ built: true, camps: n });
    if (typeof refreshFridgeTip === 'function') refreshFridgeTip();
    buildActionUI();
    const btn = document.getElementById('action-fridge');
    return {
      tip: btn ? btn.getAttribute('data-tip') : '',
      seed: fridgeSeedNow(),
      board: fridgeHasBoard(),
      shelf: fridgeHasShelf(),
    };
  }, camps);

  // B. bare corner — 3 is still the first-camp promise
  const bare = await tipFor(0);
  ok(bare.seed === 3 && !bare.board && /starts 3 goodwill known/.test(bare.tip),
    `a bare corner still promises 3 (seed ${bare.seed})`);

  // C. the board — the tip must say 5, not the frozen 3
  const board = await tipFor(3);
  ok(board.seed === 5 && board.board && !board.shelf,
    `three camps put the board up and seed 5 (seed ${board.seed})`);
  ok(/starts 5 goodwill known/.test(board.tip),
    `the 🧊 tip names 5 once the board stands — not a frozen 3 (${board.tip.slice(-40)})`);
  ok(!/starts 3 goodwill known/.test(board.tip),
    'the boarded tip no longer promises 3');

  // D. the shelf — the tip must say 7
  const shelf = await tipFor(6);
  ok(shelf.seed === 7 && shelf.shelf,
    `six camps grow the shelf and seed 7 (seed ${shelf.seed})`);
  ok(/starts 7 goodwill known/.test(shelf.tip),
    `the 🧊 tip names 7 once the shelf stands (${shelf.tip.slice(-40)})`);

  // E. isolation
  const iso = await page.evaluate(() => ({
    cost: FRIDGE_COST,
    s1: FRIDGE_SEED, s2: FRIDGE_SEED2, s3: FRIDGE_SEED3,
    at2: FRIDGE_BOARD_AT, at3: FRIDGE_SHELF_AT,
    key: FRIDGE_KEY,
  }));
  ok(iso.cost === 15 && iso.key === 'hv-fridge',
    '15 goodwill still builds it, and it still lives in hv-fridge');
  ok(iso.s1 === 3 && iso.s2 === 5 && iso.s3 === 7 && iso.at2 === 3 && iso.at3 === 6,
    'the 3 / 5 / 7 seeds and the 3 / 6 camp gates stay where they were');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

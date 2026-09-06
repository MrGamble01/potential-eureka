/*
 * HV-179 — Busk said a set on the corner, then rain still paid
 * the dry-day take.
 *
 * The Scrap Guitar is "one set a day on the corner." finishAction
 * logs "Played a set on the corner." Rain already halves the
 * panhandle odds on that same corner (weatherDef().pan = 0.5);
 * the awning puts them back. buskPay() only doubled on a scorcher.
 * A rainy set still paid the clear-day take.
 *
 * Distinct from #823 (Cold Snap thins foot traffic / busk), #867
 * (Hand out flyers / a local shop), #784 (panhandle / the crash
 * course), and #847 (finished mural linger). This ticket is the
 * guitar corner vs rain. ui.js is not this ticket.
 *
 *  A. Source: buskPay names rain. The guitar still promises the corner.
 *  B. Morale 50, rain, no awning: take is 1, not 3.
 *  C. Clear still pays 3. Heat still doubles to 6.
 *  D. Rain under the awning still pays the dry take (3). Awning
 *     saves stay a panhandle tally.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives buskPay() + finishAction(buskAction()).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const payFn = /function buskPay\(\)\{([\s\S]*?)\n\}/.exec(cfg);

ok(/One set a day on the corner/.test(cfg),
  'the Scrap Guitar still promises one set a day on the corner');
ok(!!payFn, 'buskPay is still in config.js');
ok(payFn && /rain/.test(payFn[1]),
  'HV-178: buskPay names rain');
ok(/homeless-village\/js\/ui\.js/.test(player) === false && /homeless-village\/js\/ui\.js/.test(cfg) === false,
  'the rain cut lives in buskPay — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvbuskrain-init')) {
      sessionStorage.setItem('hvbuskrain-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const table = await page.evaluate(() => {
    G.structures.guitar = true;
    G.structures.awning = false;
    G.morale = 50;
    const at = (w, awn) => {
      G.weather = w;
      G.structures.awning = !!awn;
      return buskPay();
    };
    return {
      clear: at('clear', false),
      heat: at('heat', false),
      rain: at('rain', false),
      awning: at('rain', true),
      recipe: RECIPES.find(r => r.id === 'guitar').desc,
    };
  });
  ok(/on the corner/.test(table.recipe),
    `the recipe still names the corner (${table.recipe.slice(0, 70)})`);
  ok(table.clear === 3, `a clear set at 50 morale still pays 3 (${table.clear})`);
  ok(table.heat === 6, `a scorcher still doubles to 6 (${table.heat})`);
  ok(table.rain === 1,
    `HV-178: rain halves the corner take — 3 becomes 1, not 3 (${table.rain})`);
  ok(table.awning === 3,
    `the awning puts a rainy set back to the dry take (${table.awning})`);

  const live = await page.evaluate(() => {
    G.structures.guitar = true;
    G.structures.awning = false;
    G.weather = 'rain';
    G.morale = 50;
    G.goodwill = 0;
    G.buskDay = -1;
    G.busks = 0;
    G.awningSaves = 0;
    G.goalIndex = GOALS.length;
    finishAction(buskAction());
    return {
      gw: G.goodwill,
      morale: G.morale,
      saves: G.awningSaves,
      day: G.buskDay === G.days,
    };
  });
  ok(live.gw === 1 && live.morale === 52 && live.day,
    `a rainy set pays +1 goodwill and still lifts +2 morale (${live.gw} gw, morale ${live.morale})`);
  ok(live.saves === 0,
    'a rainy set does not steal the awning\'s panhandle tally');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

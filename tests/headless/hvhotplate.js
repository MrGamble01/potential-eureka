/*
 * HV-134 — Wave Marisol Down said still warm from the hotplate,
 * then only food moved.
 *
 * The success log promises a casserole still warm from the garage
 * hotplate. finishAction only added the dish to G.food. G.warmth
 * never moved. A hotplate casserole is warmth.
 *
 * Distinct from HV-40 (hvmarisol): that suite only pins food and
 * the visit tally. Distinct from HV-101 (#776): that is the
 * storyless refuse locking 30s. Distinct from HV-114 (#800): that
 * is the thermos coffee. Distinct from HV-113 (#797): that is the
 * bench's something warm.
 *
 *  A. Source: the marisol pay branch lifts warmth
 *     (MARISOL_WARMTH / G.warmth).
 *  B. The log still promises still warm. ui.js is untouched.
 *  C. A storyless wave and a garage favor do not lift warmth.
 *  D. A paid wave lifts food AND warmth; the log names warmth.
 *  E. A second wave the same session does not pay again.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'marisol'}) on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const branch = /else if\(a\.id==='marisol'\)\{([\s\S]*?)else if\(a\.id==='reunion'\)/.exec(player);
ok(!!branch, 'the marisol branch is still in player.js');
const pay = branch && /else \{\s*marisolCame=true;([\s\S]*?)saveGame\(\);/.exec(branch[1]);
ok(pay && /G\.warmth/.test(pay[1]) && /MARISOL_WARMTH/.test(pay[1]),
  'HV-134: a wave lifts warmth — a hotplate casserole is supposed to warm someone');
ok(/MARISOL_WARMTH\s*=\s*3/.test(cfg),
  'MARISOL_WARMTH is 3 beside the visitor constants');
ok(/still warm from the garage hotplate/.test(player),
  'the pay log still promises a casserole still warm from the hotplate');
ok(!/MARISOL_WARMTH/.test(ui), 'ui.js is untouched');

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
    if (!sessionStorage.getItem('hvhotplate-init')) {
      sessionStorage.setItem('hvhotplate-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-visitor');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-plaque');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const cold = await t(() => {
    marisolCame = false;
    G.goalIndex = GOALS.length;
    G.food = 10;
    G.warmth = 50;
    finishAction({ id: 'marisol' });
    return {
      tip: ACTIONS.find(a => a.id === 'marisol').tooltip,
      food: G.food,
      warmth: G.warmth,
      visits: loadMarisol().visits,
    };
  });
  ok(/casserole/.test(cold.tip), 'the live tooltip still says she leaves a casserole');
  ok(cold.warmth === 50 && cold.food === 10 && cold.visits === 0,
    `a storyless wave refuses — warmth stays put (${cold.warmth})`);

  const garage = await t(() => {
    G.goodwill = 10;
    G.garageCover = false;
    G.warmth = 50;
    finishAction({ id: 'garage' });
    return { warmth: G.warmth, cover: G.garageCover };
  });
  ok(garage.warmth === 50 && garage.cover,
    `Garage Favor still stows goods, not a hotplate (warmth ${garage.warmth})`);

  const seam = await t(() => {
    marisolCame = false;
    saveHvRec({ days: 5, beats: 0 });
    saveHvNote({ read: 0 });
    saveHvStar({ cheers: 0 });
    saveMarisol({ visits: 0 });
    G.goalIndex = GOALS.length;
    G.food = 10;
    G.warmth = 50;
    const dish = marisolDish();
    const lift = typeof MARISOL_WARMTH === 'number' ? MARISOL_WARMTH : 3;
    finishAction({ id: 'marisol' });
    const logs = Array.from(document.querySelectorAll('#log-feed .log-line')).map(el => el.textContent);
    return {
      food: G.food,
      warmth: G.warmth,
      dish,
      lift,
      visits: loadMarisol().visits,
      log: logs[logs.length - 1] || '',
    };
  });
  ok(seam.food === 10 + seam.dish && seam.visits === 1,
    `the wave still pays the casserole (food ${seam.food}, visits ${seam.visits})`);
  ok(seam.warmth === 50 + seam.lift,
    `HV-134: a wave lifts warmth by ${seam.lift} (50 → ${seam.warmth})`);
  ok(new RegExp('\\+' + seam.lift).test(seam.log) && (seam.log.match(/\+\d+/g) || []).length >= 2,
    `the log names the warmth (${seam.log.slice(-90)})`);

  const again = await t(() => {
    const food = G.food, warmth = G.warmth, visits = loadMarisol().visits;
    finishAction({ id: 'marisol' });
    return { food: G.food, warmth: G.warmth, visits: loadMarisol().visits, before: { food, warmth, visits } };
  });
  ok(again.food === again.before.food && again.warmth === again.before.warmth && again.visits === again.before.visits,
    'a second wave the same session does not pay again');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

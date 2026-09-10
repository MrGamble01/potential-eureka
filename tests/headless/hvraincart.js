/*
 * HV-232 — Deposit run said haul every can, then a rainy day
 * still paid a dry-day take.
 *
 * The cart tooltip is "Haul every can to the redemption center."
 * Rain already halves the panhandle corner (weatherDef().pan 0.5).
 * The cart haul is the other outdoor walk that day: every can to
 * the center, in one trip, in that same rain. finishAction still
 * paid floor(cans/2) goodwill and floor(cans/10) rep as if the
 * sky were clear.
 *
 * #868 / HV-178 is the same walk vs a cold snap sky. #869 is
 * Busk vs rain. #888 is forage vs rain. HV-243 / #938 is the
 * same walk vs a heat-wave sky (already on main). #925 took
 * HV-231 for the depot lift, so this ticket is HV-232. ui.js
 * is not this ticket.
 *
 *  A. Source: the deposit finisher still hauls every can. Rain
 *     still halves the corner. The finisher reads weather==='rain'.
 *     Cold is not this ticket. ui.js is not this ticket.
 *  B. Live: 10 cans on a clear sky still pay +5🩶 +1⭐.
 *  C. Live: the same 10 cans on rain paid the dry-day haul (the
 *     bug). After the fix they pay half, and the log names the rain.
 *  D. Cold still pays the posted rate — cold cart is HV-178.
 *     Heat still pays the scorcher 0.75 — heat cart is HV-243.
 *  E. A short haul is still refused; one run a day still holds.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction(depositAction()).
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

const depositBlock = /else if\(a\.id==='deposit'\)\{[\s\S]*?else if\(a\.id==='busk'\)/.exec(player);
const body = depositBlock ? depositBlock[0] : '';

ok(/Haul every can to the redemption center/.test(cfg),
  'the cart still promises a haul of every can');
ok(/pan:\s*0\.5/.test(cfg) && /name:'Rain'/.test(cfg),
  'rain still halves the panhandle corner');
ok(/a\.id==='deposit'/.test(player) && /hauled=G\.cans/.test(body),
  'the deposit finisher still hauls every can');
ok(/G\.weather==='rain'/.test(body) && /Math\.floor\(gw\s*\/\s*2\)/.test(body),
  'HV-232: the deposit finisher cuts the haul on a rainy sky');
ok(!/G\.weather==='cold'/.test(body),
  'cold is not this ticket — the cold cart haul is HV-178');
ok(!/G\.weather==='rain'/.test(ui),
  'ui.js untouched — the rain cut lives on the deposit haul');

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
    if (!sessionStorage.getItem('hvraincart-init')) {
      sessionStorage.setItem('hvraincart-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const haul = (weather, cans) => t(new Function(`
    G.structures.cart = true;
    G.cans = ${cans};
    G.goodwill = 0;
    G.rep = 0;
    G.weather = '${weather}';
    G.depositDay = -9;
    G.deposits = 0;
    G.goalIndex = GOALS.length;
    finishAction(depositAction());
    return {
      gw: G.goodwill,
      rep: G.rep || 0,
      cans: G.cans,
      deposits: G.deposits || 0,
      day: G.depositDay,
      days: G.days,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  `));

  const clear = await haul('clear', 10);
  ok(clear.gw === 5 && clear.rep === 1 && clear.cans === 0 && clear.deposits === 1,
    `a clear-sky haul still pays +5 goodwill +1 rep (${clear.gw} / ${clear.rep})`);

  const rain = await haul('rain', 10);
  ok(rain.gw === 2 && rain.rep === 0 && rain.cans === 0 && rain.deposits === 1,
    `HV-232: a rainy haul is +2 goodwill, not the dry-day +5 (${rain.gw} / ${rain.rep})`);
  ok(/rain/i.test(rain.log),
    `the refuse names the rain — not a silent half (${rain.log.slice(-80)})`);

  const cold = await haul('cold', 10);
  ok(cold.gw === 5 && cold.rep === 1,
    `cold without rain still pays the posted rate — cold cart is #868 (${cold.gw} / ${cold.rep})`);

  const heat = await haul('heat', 10);
  ok(heat.gw === 3 && heat.rep === 0,
    `heat still pays the scorcher cut — heat cart is HV-243 / #938 (${heat.gw} / ${heat.rep})`);

  const short = await haul('rain', 4);
  ok(short.cans === 4 && short.deposits === 0 && short.gw === 0,
    `a short haul is still refused even in the rain (cans ${short.cans})`);

  const twice = await t(() => {
    G.structures.cart = true;
    G.cans = 10;
    G.goodwill = 0;
    G.rep = 0;
    G.weather = 'rain';
    G.depositDay = -9;
    G.deposits = 0;
    finishAction(depositAction());
    const first = { gw: G.goodwill, deposits: G.deposits, day: G.depositDay };
    G.cans = 10;
    finishAction(depositAction());
    return { first, gw2: G.goodwill, deposits2: G.deposits, cans2: G.cans };
  });
  ok(twice.first.deposits === 1 && twice.deposits2 === 1 && twice.cans2 === 10 && twice.gw2 === twice.first.gw,
    'one run a day still holds — a second haul is refused');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

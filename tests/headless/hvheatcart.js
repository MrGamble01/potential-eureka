/*
 * HV-243 — Deposit run said haul every can, then a heat-wave
 * day still paid a cool-day take.
 *
 * The cart tooltip is "Haul every can to the redemption center."
 * Heat Wave already gifts the corner (weatherDef().pan 1.5) and
 * doubles a busk. The cart haul is the other outdoor walk that
 * day: every can to the center, in one trip, in that same
 * scorcher. finishAction still paid floor(cans/2) goodwill and
 * floor(cans/10) rep as if the sky were clear.
 *
 * Distinct from HV-232 / #926 (rain vs the cart — that ticket
 * halves the take), HV-178 / #868 (cold vs the cart), HV-169 /
 * #861 (Walk the dogs vs a scorcher). This ticket is the heat
 * vs the cart. ui.js is not this ticket.
 *
 *  A. Source: the deposit finisher still hauls every can. Heat
 *     Wave is still named in WEATHERS. The finisher reads
 *     weather==='heat' and applies 0.75. Rain's half-cut is
 *     HV-232. Cold is not this ticket. ui.js is not this ticket.
 *  B. Live: 10 cans on a clear sky still pay +5🩶 +1⭐.
 *  C. Live: the same 10 cans on heat paid the cool-day haul
 *     (the bug). After the fix they pay 0.75, and the log
 *     names the scorcher.
 *  D. Rain and cold do not steal the cut — those are other
 *     walks.
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
ok(/name:'Heat Wave'/.test(cfg) && /pan:\s*1\.5/.test(cfg),
  'Heat Wave still gifts the panhandle corner');
ok(/a\.id==='deposit'/.test(player) && /hauled=G\.cans/.test(body),
  'the deposit finisher still hauls every can');
ok(/G\.weather==='heat'/.test(body) && /0\.75/.test(body),
  'HV-243: the deposit finisher cuts the haul on a heat-wave sky');
ok(/G\.weather==='rain'/.test(body) && /Math\.floor\(gw\s*\/\s*2\)/.test(body),
  'HV-232 rain cut still lives on the deposit haul');
ok(!/G\.weather==='cold'/.test(body),
  'cold is not this ticket — the cold cart haul is #868');
ok(!/G\.weather==='heat'/.test(ui),
  'ui.js untouched — the heat cut lives on the deposit haul');

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
    if (!sessionStorage.getItem('hvheatcart-init')) {
      sessionStorage.setItem('hvheatcart-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
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
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  `));

  const boot = await t(() => ({
    name: WEATHERS.heat && WEATHERS.heat.name,
    label: depositAction().tooltip,
  }));
  ok(boot.name === 'Heat Wave' && /Haul every can/.test(boot.label),
    `the sky is still Heat Wave and the cart still hauls every can (${boot.name})`);

  const clear = await haul('clear', 10);
  ok(clear.gw === 5 && clear.rep === 1 && clear.cans === 0 && clear.deposits === 1,
    `a clear-sky haul still pays +5 goodwill +1 rep (${clear.gw} / ${clear.rep})`);

  const heat = await haul('heat', 10);
  ok(heat.gw === 3 && heat.rep === 0 && heat.cans === 0 && heat.deposits === 1,
    `HV-243: a scorcher haul is +3 goodwill, not the cool-day +5 (${heat.gw} / ${heat.rep})`);
  ok(/scorcher|heat/i.test(heat.log),
    `the log names the scorcher — not a silent cut (${heat.log.slice(-80)})`);

  const rain = await haul('rain', 10);
  ok(rain.gw === 2 && rain.rep === 0,
    `rain without heat still halves — rain cart is HV-232 / #926 (${rain.gw} / ${rain.rep})`);

  const cold = await haul('cold', 10);
  ok(cold.gw === 5 && cold.rep === 1,
    `cold without heat still pays the posted rate — cold cart is #868 (${cold.gw} / ${cold.rep})`);

  const short = await haul('heat', 4);
  ok(short.cans === 4 && short.deposits === 0 && short.gw === 0,
    `a short haul is still refused even in the scorcher (cans ${short.cans})`);

  const twice = await t(() => {
    G.structures.cart = true;
    G.cans = 10;
    G.goodwill = 0;
    G.rep = 0;
    G.weather = 'heat';
    G.depositDay = -9;
    G.deposits = 0;
    finishAction(depositAction());
    const first = { gw: G.goodwill, deposits: G.deposits };
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

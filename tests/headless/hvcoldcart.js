/* HV-178 — a cold morning said the cold gets into everything,
 * then the Deposit run still paid a summer haul.
 *
 * Dawn writes "The cold gets into everything — keep the fire fed."
 * Scavenge already rides weatherDef().scav (0.75 on a cold snap sky).
 * The cart haul is the other outdoor walk that day: every can to the
 * redemption center, in one trip, in that same cold. finishAction
 * still paid floor(cans/2) goodwill and floor(cans/10) rep as if the
 * sky were clear.
 *
 * Write-first against unfixed main. Hook-free. ui.js untouched.
 *
 * A. Source: the cold-dawn log still exists; the deposit finisher
 *    has no weather==='cold' cut.
 * B. Live: 10 cans on a clear sky still pay +5🩶 +1⭐.
 * C. Live: the same 10 cans on a cold snap sky paid the summer haul
 *    (the bug). After the fix they pay half, and the log names the cold.
 * D. Heat and rain do not steal the cut — this is the cold's walk.
 * E. A short haul is still refused; one run a day still holds.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');

(async () => {
  // A — source
  const depositBlock = /else if\(a\.id==='deposit'\)\{[\s\S]*?else if\(a\.id==='busk'\)/.exec(player);
  const body = depositBlock ? depositBlock[0] : '';
  ok(/The cold gets into everything/.test(loop),
    'dawn still writes that the cold gets into everything');
  ok(/a\.id==='deposit'/.test(player) && /hauled=G\.cans/.test(body),
    'the deposit finisher still hauls every can');
  ok(/G\.weather==='cold'/.test(body) && /Math\.floor\(gw\s*\/\s*2\)/.test(body),
    'HV-178: the deposit finisher cuts the haul on a cold snap sky');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvcoldcart-init')) {
      sessionStorage.setItem('hvcoldcart-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
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

  // B — a clear sky still pays the posted rate
  const clear = await haul('clear', 10);
  ok(clear.gw === 5 && clear.rep === 1 && clear.cans === 0 && clear.deposits === 1,
    `a clear-sky haul of 10 cans still pays +5🩶 +1⭐ (got +${clear.gw} / +${clear.rep})`);

  // C — the cold snap sky
  const cold = await haul('cold', 10);
  ok(cold.gw === 2 && cold.rep === 0 && cold.cans === 0 && cold.deposits === 1,
    `HV-178: a cold haul of 10 cans pays half — +2🩶, no rep (got +${cold.gw} / +${cold.rep})`);
  ok(/cold got into the haul|cold got into everything/i.test(cold.log),
    'the log names the cold on the haul');

  // D — heat and rain are not this ticket
  const heat = await haul('heat', 10);
  const rain = await haul('rain', 10);
  ok(heat.gw === 5 && rain.gw === 5,
    `heat and rain still pay the posted rate (heat +${heat.gw}, rain +${rain.gw})`);

  // E — the existing doors still hold
  const short = await t(() => {
    G.structures.cart = true;
    G.cans = 4;
    G.goodwill = 3;
    G.weather = 'cold';
    G.depositDay = -9;
    finishAction(depositAction());
    return { cans: G.cans, gw: G.goodwill };
  });
  ok(short.cans === 4 && short.gw === 3, 'a short haul is still refused free, even in the cold');

  const once = await t(() => {
    G.cans = 10;
    G.goodwill = 0;
    G.weather = 'clear';
    G.depositDay = G.days;
    G.deposits = 4;
    finishAction(depositAction());
    return { cans: G.cans, gw: G.goodwill, deposits: G.deposits };
  });
  ok(once.cans === 10 && once.gw === 0 && once.deposits === 4,
    'one run a day still holds — a second haul is refused');

  await page.screenshot({ path: '/tmp/hvcoldcart.png', fullPage: true });

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

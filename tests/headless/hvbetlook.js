/*
 * HV-284 — Rain Bet said a radio is the whole edge, then a
 * Lookout already saw tomorrow's sky.
 *
 * HV-28's own comment: fair-ish odds blind; the crafted radio
 * (or the Lookout) turns it into a read. forecastVisible() is
 * Lookout OR Radio. The 🎲 tooltip still sold the radio as the
 * whole edge, so a camp that already hired a Lookout thought it
 * still needed a weather band to take Dee's wager with a read.
 *
 * Radio confiscation is HV-176 / HV-248. Tomorrow staying blank
 * is HV-91. Lookout's worker card is not this sentence. Stake
 * and payout stay 2 against 5. ui.js is not this ticket.
 *
 *  A. Source: forecastVisible is Lookout or Radio.
 *  B. Source: the 🎲 row still stakes 2 against 5, one bet a day.
 *  C. HV-284: the tooltip names the Lookout as an edge.
 *  D. HV-284: the tooltip does not sell the radio as the sole edge.
 *  E. Live: a Lookout-only camp sees tomorrow; neither sees nothing.
 *  F. Live: the 🎲 title names the Lookout.
 *  G. A radio-only camp still sees tomorrow.
 *  H. Stake and payout stay 2 / 5.
 *  Z. Zero page errors.
 *
 * Hook-free. Reads production config + live page globals.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const visAt = config.indexOf('function forecastVisible');
const visBlock = visAt >= 0 ? config.slice(visAt, visAt + 160) : '';
const betAt = config.indexOf("id:'rainbet'");
const garageAt = config.indexOf("id:'garage'");
const betBlock = betAt >= 0 && garageAt > betAt ? config.slice(betAt, garageAt) : '';
const tipM = /tooltip:'([^']+)'/.exec(betBlock);
const tip = tipM ? tipM[1] : '';

ok(/lookout/.test(visBlock) && /radio/.test(visBlock),
  'forecastVisible is still Lookout or Radio');
ok(/one bet a day/.test(tip) && /rain side/.test(tip),
  'the 🎲 row still stakes the rain side, one bet a day');
ok(/Lookout/.test(tip),
  'HV-284: the Rain Bet tooltip names the Lookout as an edge');
ok(!/A radio is the whole edge/.test(tip) && /radio/i.test(tip),
  'HV-284: the tooltip still names the radio, not as the sole edge');
ok(!/homeless-village\/js\/ui\.js/.test(config),
  'the edge lives on the 🎲 tooltip — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvbetlook-init')) {
      sessionStorage.setItem('hvbetlook-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const sky = await t(() => {
    G.structures.radio = false;
    G.workers.lookout = true;
    const look = !!forecastVisible();
    G.workers.lookout = false;
    const neither = !!forecastVisible();
    G.structures.radio = true;
    const radio = !!forecastVisible();
    return { look, neither, radio, stake: RAINBET_STAKE, pay: RAINBET_PAY };
  });
  ok(sky.look && !sky.neither,
    `a Lookout-only camp sees tomorrow (look=${sky.look}, neither=${sky.neither})`);
  ok(sky.radio,
    'a radio-only camp still sees tomorrow');
  ok(sky.stake === 2 && sky.pay === 5,
    `stake and payout stay 2 / 5 (stake=${sky.stake}, pay=${sky.pay})`);

  const btn = await t(() => {
    const a = ACTIONS.find(x => x.id === 'rainbet');
    const el = document.getElementById('action-rainbet');
    return {
      tip: a && a.tooltip,
      title: el ? el.title : '',
    };
  });
  const live = (btn.tip || '') + ' ' + (btn.title || '');
  ok(/Lookout/.test(live),
    `HV-284: the 🎲 title names the Lookout (${(btn.title || btn.tip || '').slice(-80)})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

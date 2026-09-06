/* HV-211 — Wave Marisol Down said she leaves a casserole still
 * warm from the garage hotplate, then a rainy day still delivered
 * it dry.
 *
 * She swings past and leaves a casserole. Kind Stranger’s bag and
 * the fence-post tamales already know rain soaks food left outside.
 * finishAction never read G.weather. A plate that sat in the rain
 * is not a hotplate casserole.
 *
 * #817 is hotplate warmth. #881 is dawn tamales on the fence.
 * #884 is Kind Stranger’s bag. #776 is the storyless lock.
 * This is the wave in the rain.
 *
 *  A. Source: the casserole is still warm from the garage hotplate.
 *  B. Source: the marisol payout reads G.weather. ui.js does not.
 *  C. Live: rain, a story on the bridge — the pot does not move.
 *     The visit tally does not tick. The log names the rain.
 *  D. A clear day still pays the dish and ticks the tally.
 *  E. A storyless bridge still waves at nothing, rain or not.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction({id:'marisol'}).
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

const marisol = /\} else if\(a\.id==='marisol'\)\{([\s\S]*?)\n  \} else if\(a\.id==='reunion'\)/.exec(player);
const body = marisol ? marisol[1] : '';

ok(/still warm from the garage hotplate/.test(player)
  && /id:\s*'marisol'/.test(cfg)
  && /MARISOL DROPS BY/.test(player),
  'Wave Marisol Down still leaves a casserole warm from the hotplate');
ok(body && /G\.weather/.test(body),
  'HV-211: the casserole payout reads the sky');
ok(!/casserole sat in the rain|soaked it before/.test(ui),
  'ui.js untouched — the rain lives on the wave');

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
    if (!sessionStorage.getItem('hvwetcasserole-init')) {
      sessionStorage.setItem('hvwetcasserole-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-plaque');
      localStorage.removeItem('hv-visitor');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const wave = (weather) => page.evaluate((sky) => {
    saveHvRec({ days: 5, beats: 1 });
    saveHvStar({ cheers: 0 });
    saveMarisol({ visits: 0 });
    marisolCame = false;
    G.weather = sky;
    G.food = 10;
    log('HV210-CASSEROLE');
    finishAction({ id: 'marisol' });
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV210-CASSEROLE/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      food: G.food,
      visits: loadMarisol().visits,
      latch: !!marisolCame,
      soaked: /rain/i.test(newest) && /casserole|soak|wet|plate/i.test(newest),
      paid: /MARISOL DROPS BY/.test(newest) && /hotplate/.test(newest),
      storyless: /no story/i.test(newest),
    };
  }, weather);

  const wet = await wave('rain');
  ok(wet.food === 10 && wet.visits === 0 && !wet.latch && wet.soaked && !wet.paid,
    `HV-211: rain soaks the casserole (food ${wet.food}, visits ${wet.visits}, latch ${wet.latch})`);

  const dry = await wave('clear');
  ok(dry.food === 12 && dry.visits === 1 && dry.latch && dry.paid && !dry.soaked,
    `a clear day still pays the dish (food ${dry.food}, visits ${dry.visits})`);

  const bare = await page.evaluate(() => {
    localStorage.removeItem('hv-record');
    localStorage.removeItem('hv-letter');
    saveMarisol({ visits: 0 });
    marisolCame = false;
    G.weather = 'rain';
    G.food = 10;
    finishAction({ id: 'marisol' });
    return { food: G.food, visits: loadMarisol().visits };
  });
  ok(bare.food === 10 && bare.visits === 0,
    'a storyless bridge still waves at nothing, rain or not');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

/* HV-276 — Found $5 said a crumpled bill on the sidewalk,
 * then a rainy day still paid a dry-day five.
 *
 * The card is a crumpled bill on the sidewalk. Kind Stranger's
 * bag already feels the rain (#884). The sidewalk never did.
 * HV-70 made the title the amount — a dry five is still +5.
 * A pinned rainy trigger still handed over the dry-day five.
 *
 *  A. Source: the card is still Found $5 / a crumpled bill.
 *     The effect reads weather==='rain'. ui.js does not.
 *  B. Live: a rainy find pays +2 and names the soak.
 *  C. Clear, cold, and heat still pay +5 — HV-70's dry five.
 *  D. Morale still rises on a wet find.
 *  E. Kind Stranger on rain is still a food drop.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production event.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'found_money'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
const body = block ? block[1] : '';

ok(/title:'Found \$5'/.test(loop) && /crumpled bill on the sidewalk/.test(loop),
  'the card is still Found $5 — a crumpled bill on the sidewalk');
ok(body && /weather\s*===\s*'rain'/.test(body),
  'HV-276: Found $5 reads a rainy sidewalk');
ok(!/found_money/.test(ui) && !/weather\s*===\s*'rain'/.test(ui),
  'ui.js untouched — the soak lives on the event');

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
    if (!sessionStorage.getItem('hvfiverain-init')) {
      sessionStorage.setItem('hvfiverain-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const findAt = (weather) => page.evaluate((sky) => {
    const ev = EVENTS_GOOD.find(e => e.id === 'found_money');
    const real = Math.random;
    Math.random = () => 0.5;
    G.weather = sky;
    G.goodwill = 10;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    Math.random = real;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const last = lines[lines.length - 1] || '';
    return {
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      gw: G.goodwill,
      morale: G.morale,
      soaked: /soak|rain|wet/i.test(last),
      five: /\+5/.test(last),
    };
  }, weather);

  const rain = await findAt('rain');
  ok(rain.banner === 'Found $5' && /crumpled bill/i.test(rain.body),
    'the card still titles itself Found $5 on a wet sidewalk');
  ok(rain.gw === 12,
    `HV-276: a rainy find pays a soaked +2 (gw ${rain.gw})`);
  ok(rain.soaked && !rain.five,
    'the log names the soak, not a dry five');
  ok(rain.morale > 50,
    `morale still rises on a wet find (${rain.morale})`);

  const clear = await findAt('clear');
  ok(clear.gw === 15 && clear.five && !clear.soaked,
    `a clear find still pays the dry five (gw ${clear.gw})`);

  const cold = await findAt('cold');
  ok(cold.gw === 15,
    `a cold find still pays +5 (cold is not this ticket, gw ${cold.gw})`);

  const heat = await findAt('heat');
  ok(heat.gw === 15,
    `a scorcher still pays +5 (heat is not this ticket, gw ${heat.gw})`);

  const stranger = await page.evaluate(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.weather = 'rain';
    G.goodwill = 10;
    G.food = 0;
    triggerEvent(ev, true);
    Math.random = real;
    return { gw: G.goodwill, food: G.food };
  });
  ok(stranger.gw === 10 && stranger.food > 0,
    `Kind Stranger on rain is still a food drop (food=${stranger.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

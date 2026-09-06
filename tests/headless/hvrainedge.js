/* HV-101 — Rain Bet said a radio is the whole edge.
 *
 * Dee's tooltip: "A radio is the whole edge." The comment above the
 * stake constants already tells the truth: the crafted radio *or the
 * Lookout* turns the bet into a read. forecastVisible() is Lookout OR
 * Radio. The HUD arrow already respects that. A camp that hired a
 * Lookout and never built the band still sees tomorrow — and the
 * button still says they need a radio.
 *
 * Distinct from HV-90 / #760 (dawn's 📻 vs 👁️) and HV-91 / #758
 * (Radio built, tomorrow still null). This ticket is the Rain Bet
 * tip. ui.js is not this ticket; it still only paints a.tooltip.
 *
 * Write-first. Hook-free.
 *
 *  A. Source: the tip names the Lookout (or the shared forecast
 *     gate), not "a radio is the whole edge." 5 vs 2, rain side,
 *     one bet a day stay.
 *  B. Live: #action-rainbet's tip matches that edge.
 *  C. Isolation: a Lookout and no radio still sees tomorrow.
 *     Neither sees nothing. Radio-only still sees it.
 *  D. Isolation: the stake is still 2, one bet a day.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const betAt = cfg.indexOf("id:'rainbet'");
const bet = betAt >= 0 ? cfg.slice(betAt, betAt + 380) : '';

ok(betAt >= 0 && /id:'rainbet'/.test(bet),
  'Rain Bet is still on the action bar — guards the guard');
ok(/5 goodwill/.test(bet) && /your 2/.test(bet) && /rain side/.test(bet) && /one bet a day/.test(bet),
  'the tip still sells 5 vs 2, the rain side, one bet a day');
ok(!/radio is the whole edge/i.test(bet) && /[Ll]ookout/.test(bet),
  'HV-101: the tip names the Lookout — a radio is not the whole edge');
ok(/function forecastVisible\(\)\{[^}]*lookout[^}]*radio/.test(cfg.replace(/\n/g, ' ')),
  'forecastVisible() is still Lookout or Radio');
ok(!/rainbet/.test(ui) || !/whole edge/.test(ui),
  'ui.js is not this ticket — it still only paints a.tooltip');

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
    localStorage.setItem('hv-intro-seen', '1');
    if (!sessionStorage.getItem('hvrainedge-init')) {
      sessionStorage.setItem('hvrainedge-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const tip = await page.evaluate(() => {
    const el = document.getElementById('action-rainbet');
    return el ? el.getAttribute('data-tip') || '' : '';
  });
  ok(!!tip && /5/.test(tip) && /2/.test(tip) && /rain/i.test(tip),
    'B. the Rain Bet tip still quotes the stake');
  ok(!/radio is the whole edge/i.test(tip) && /lookout/i.test(tip),
    'HV-101: the Rain Bet tip names the Lookout');

  const edge = await page.evaluate(() => {
    const see = (lookout, radio) => {
      G.workers.lookout = lookout;
      G.structures.radio = radio;
      G.forecast = 'rain';
      updateHUD();
      const badge = document.getElementById('season-badge').textContent;
      return {
        visible: forecastVisible(),
        arrow: badge.indexOf(WEATHERS.rain.icon) >= 0 && badge.indexOf('\u2192') >= 0,
      };
    };
    return {
      lookout: see(true, false),
      radio: see(false, true),
      neither: see(false, false),
    };
  });
  ok(edge.lookout.visible && edge.lookout.arrow,
    'C. a Lookout and no radio still sees tomorrow');
  ok(edge.radio.visible && edge.radio.arrow,
    'C. a radio and no Lookout still sees tomorrow');
  ok(!edge.neither.visible && !edge.neither.arrow,
    'C. neither hired nor built sees nothing');

  const stake = await page.evaluate(() => {
    G.goalIndex = 9999;
    G.goodwill = 10;
    G.days = 8;
    G.rainBetDay = -9;
    G.rainBetOn = false;
    finishAction({ id: 'rainbet' });
    const first = { gw: G.goodwill, on: G.rainBetOn, day: G.rainBetDay };
    finishAction({ id: 'rainbet' });
    return { first: first, secondGw: G.goodwill };
  });
  ok(stake.first.gw === 8 && stake.first.on && stake.first.day === 8,
    'D. placing still takes exactly 2 and arms the bet');
  ok(stake.secondGw === 8,
    'D. a same-day second bet is still refused');

  ok(errs.length === 0, `live path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

/*
 * HV-265 — The fire held all night, then a scorcher still
 * gave the barrel the credit.
 *
 * A camp that wakes at 50+ warmth gets +2 morale and a log
 * that names the fire. A heat wave's bite is a gift — the
 * sky holds the camp, not the barrel. The line never read
 * the sky.
 *
 * A clear warm dawn still names the fire. Rain still names
 * the fire. A dead barrel is not this card. ui.js is not
 * this ticket.
 *
 *  A. Source: the warm-dawn line names the sky on heat.
 *  B. A scorcher warm dawn does not credit the barrel.
 *  C. A clear warm dawn still names the fire.
 *  D. Rain still names the fire — a wet sky is not this card.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production onNewDay.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const at = loop.indexOf('HV-13: a fire kept fed');
const end = loop.indexOf('HV-15: the sanitation unit');
const body = at >= 0 && end > at ? loop.slice(at, end) : '';

ok(/The fire held all night/.test(loop),
  'a warm dawn still says the fire held');
ok(/weather==='heat'/.test(body) && /sky, not the barrel/.test(body),
  'HV-265: the warm-dawn line names the sky on a scorcher');
ok(!/fireOutUntil/.test(body),
  'a dead barrel is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(loop),
  'the cut lives on the dawn fire line — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvskyheld-init')) {
      sessionStorage.setItem('hvskyheld-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const dawn = (forecast, warmth) => t(({ fc, w }) => {
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    const real = Math.random; Math.random = () => 0.99;
    G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
    G.lastEventDay = G.days + 5;
    G.forecast = fc; G.weather = 'clear';
    G.warmth = w; G.morale = 50; G.food = 20; G.population = 1; G.rep = 0;
    G.structures.coats = false; G.snapUntil = null;
    onNewDay();
    Math.random = real;
    window.log = prev;
    return {
      weather: G.weather,
      warmth: G.warmth,
      morale: G.morale,
      held: captured.some(m => /fire held all night/.test(m)),
      sky: captured.some(m => /sky, not the barrel/.test(m)),
    };
  }, { fc: forecast, w: warmth });

  const dry = await dawn('clear', 80);
  ok(dry.weather === 'clear' && dry.held && !dry.sky,
    `a clear warm dawn still names the fire (held=${dry.held})`);

  const hot = await dawn('heat', 80);
  ok(hot.weather === 'heat' && hot.sky && !hot.held,
    `HV-265: a scorcher does not credit the barrel (sky=${hot.sky}, held=${hot.held})`);
  ok(hot.morale === 49,
    `the camp still wakes with its chin up (morale=${hot.morale})`);

  const wet = await dawn('rain', 80);
  ok(wet.weather === 'rain' && wet.held && !wet.sky,
    `rain still names the fire — a wet sky is not this card (held=${wet.held})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

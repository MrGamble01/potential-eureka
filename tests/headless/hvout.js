/*
 * HV-210 — Fire Went Out said the barrel died overnight, then
 * the same dawn had already said the fire held.
 *
 * HV-13 logs The fire held all night when warmth is 50+ after
 * the night's drain. maybeEvent runs at the end of onNewDay.
 * Fire Went Out says The barrel fire died overnight. On a warm
 * morning the log already named the hold, then the card says
 * the barrel died in the night.
 *
 * Distinct from HV-83 (#747: the NEXT dawn after the card still
 * said the fire held — a day-stamp on last night). Distinct from
 * HV-153 (the sky stayed a scorcher), HV-162 (Firewood vs the
 * overnight kill), and HV-69 (Firewood relight). This is the
 * card × the hold the same dawn. Do not skip tomorrow's hold
 * (#747). Do not delay the fire-held line (hvfire D).
 *
 *  A. Source: maybeEvent skips fire_out when this dawn already
 *     heard the fire held.
 *  B. The card still says the barrel died overnight.
 *  C. Live: a warm dawn holds, then a pool that can only draw
 *     Fire Went Out does not. The hold line stays; the burn
 *     does not.
 *  D. A cold dawn (no hold) can still draw the card.
 *  E. Firewood relight is not this card — fire_out.effect still
 *     dims the barrel when the hold never fired.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives maybeEvent() on the production pool.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const maybe = src.slice(src.indexOf('function maybeEvent'), src.indexOf('function triggerEvent'));
const outFx = src.slice(src.indexOf("id:'fire_out'"), src.indexOf("id:'kind_stranger'"));
ok(/The barrel fire died overnight/.test(outFx),
  'Fire Went Out still says the barrel died overnight');
ok(/function maybeEvent/.test(maybe) && /fire_out/.test(maybe) && /fireHeldThisDawn/.test(maybe),
  'HV-210: maybeEvent skips fire_out when this dawn already heard the fire held');
ok(/The fire held all night/.test(src) && /G\.warmth\s*>=\s*50/.test(src),
  'HV-13: a 50+ wake still hears the fire held');

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
    if (!sessionStorage.getItem('hvout-init')) {
      sessionStorage.setItem('hvout-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const drawOut = (warmth) => page.evaluate((w) => {
    const lines = [];
    const realLog = log;
    log = function (s) { lines.push(String(s)); realLog(s); };
    const real = Math.random;
    Math.random = () => 0.99;
    G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
    G.lastEventDay = 99; G.days = 4;
    G.forecast = 'clear'; G.weather = 'clear'; G.season = 0; G.snapUntil = null;
    G.warmth = w; G.morale = 50; G.food = 20; G.health = 90; G.population = 1; G.rep = 0;
    G.workers.lookout = false; G.workers.cook = false; G.workers.scrapper = false;
    G.structures.garden = false; G.sweepWarned = false; G.packedUp = false;
    onNewDay();
    const flagged = !!G.fireHeldThisDawn;
    const held = lines.some(s => /fire held/i.test(s));
    const keptBad = EVENTS_BAD.splice(0, EVENTS_BAD.length);
    EVENTS_BAD.push(keptBad.find(e => e.id === 'fire_out'));
    G.lastEventDay = -2;
    let n = 0;
    Math.random = () => {
      n++;
      if (n === 1) return 0.5;
      if (n === 2) return 0.99;
      return 0;
    };
    maybeEvent();
    Math.random = real;
    EVENTS_BAD.splice(0, EVENTS_BAD.length);
    keptBad.forEach(e => EVENTS_BAD.push(e));
    log = realLog;
    return {
      warmth: G.warmth,
      held,
      burned: lines.some(s => /burned out|died overnight|cold and dark/i.test(s)),
      flagged,
      title: (document.getElementById('ev-title') || {}).textContent || '',
    };
  }, warmth);

  const warm = await drawOut(80);
  ok(warm.held && !warm.burned && warm.title !== 'Fire Went Out',
    `warm hold: fire held, Fire Went Out stays in the night (held=${warm.held}, burned=${warm.burned}, title=${warm.title})`);
  ok(warm.flagged, `HV-210: a warm dawn stamps fireHeldThisDawn (${warm.flagged})`);

  const cold = await drawOut(30);
  ok(!cold.held && cold.burned && cold.title === 'Fire Went Out',
    `cold dawn: no hold, the card can still land (held=${cold.held}, burned=${cold.burned}, title=${cold.title})`);

  const relight = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    G.fireHeldThisDawn = false;
    G.fireOutUntil = 0;
    ev.effect();
    return Date.now() < (G.fireOutUntil || 0);
  });
  ok(relight, 'Firewood relight is not this card — fire_out.effect still dims the barrel');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/* HV-71 — a Lookout sweep warning must survive an unrelated event.
 *
 * maybeEvent() arms G.sweepWarned and a 30s timer. onNewDay() then
 * calls checkDog() / checkArc(), which triggerEvent() the stray or
 * the Case Worker card. triggerEvent() cleared sweepWarned for EVERY
 * event, so the timer's `if(G.sweepWarned)` no-op'd and the sweep
 * never landed. The Lookout's only job became a lie on day 4 / day 10.
 *
 * Hook-free. Reverting the sweep-only clear fails the named assertion.
 * An actual sweep still dismisses the strip.
 *
 * A. Source: triggerEvent only clears the warning when ev.id==='sweep'.
 * B. A stray-dog banner does not cancel an armed warning.
 * C. Day-4 dawn (Lookout + sweep roll + Biscuit) keeps the warning.
 * D. The sweep event itself still clears the warning.
 * Z. Zero page errors. ui.js untouched.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const trigAt = loop.indexOf('function triggerEvent(ev,isGood){');
const trig = trigAt >= 0 ? loop.slice(trigAt, trigAt + 520) : '';

ok(/function triggerEvent/.test(trig) && /sweepWarned/.test(trig),
  'triggerEvent still owns the sweep-warning clear');
ok(/ev\.id\s*===\s*['"]sweep['"]/.test(trig) || /if\s*\(\s*ev\.id\s*===\s*['"]sweep['"]/.test(trig),
  'HV-71: triggerEvent only clears the warning when the sweep lands');
ok(/function showSweepWarning/.test(ui) && !/sweepWarned\s*=\s*false/.test(ui),
  'ui.js still only paints the strip — it does not own the latch');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => { localStorage.setItem('hv-intro-seen', '1'); });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const stray = await page.evaluate(() => {
    G.sweepWarned = true;
    G.packedUp = false;
    showSweepWarning(true, Date.now() + 30000);
    triggerEvent(DOG_EVENTS.stray, true);
    const strip = document.getElementById('sweep-warning');
    return {
      warned: !!G.sweepWarned,
      strip: strip && strip.style.display === 'block',
      title: document.getElementById('ev-title').textContent,
    };
  });
  ok(stray.warned && stray.strip,
    `HV-71: a stray-dog banner does not cancel an armed warning (warned=${stray.warned}, strip=${stray.strip}, title=${stray.title})`);

  const dawn = await page.evaluate(() => {
    const oldR = Math.random;
    Math.random = () => 0.1;
    G.days = 3;
    G.dog = 0;
    G.workers.lookout = true;
    G.lastEventDay = 0;
    G.sweepWarned = false;
    G.packedUp = false;
    G.health = 80; G.warmth = 80; G.food = 20; G.morale = 50;
    G.structures.tent = false; G.structures.workbench = false;
    G.structures.garden = false; G.structures.soup_kitchen = false;
    G.rainBetOn = false; G.rayDebt = 0; G.snapUntil = null;
    G.weather = 'clear'; G.forecast = 'clear';
    G.arcStage = 0; G.goodwill = 0;
    onNewDay();
    Math.random = oldR;
    const strip = document.getElementById('sweep-warning');
    return {
      days: G.days,
      dog: G.dog,
      warned: !!G.sweepWarned,
      strip: strip && strip.style.display === 'block',
      title: document.getElementById('ev-title').textContent,
    };
  });
  ok(dawn.days === 4 && dawn.dog === 1 && dawn.warned && dawn.strip,
    `day-4 Lookout + Biscuit keeps the warning (days=${dawn.days}, dog=${dawn.dog}, warned=${dawn.warned}, title=${dawn.title})`);

  const sweep = await page.evaluate(() => {
    G.sweepWarned = true;
    G.structures.tent = false; G.structures.garden = false;
    G.structures.soup_kitchen = false; G.structures.workbench = false;
    G.garageCover = false; G.packedUp = false; G.scraps = 0; G.food = 10;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'sweep'), false);
    const strip = document.getElementById('sweep-warning');
    return {
      warned: !!G.sweepWarned,
      strip: strip && strip.style.display === 'block',
      title: document.getElementById('ev-title').textContent,
    };
  });
  ok(!sweep.warned && !sweep.strip && /City Sweep/.test(sweep.title),
    `an actual sweep still clears the warning (warned=${sweep.warned}, title=${sweep.title})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

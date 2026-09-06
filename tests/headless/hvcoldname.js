/* HV-90 — a cold morning called itself a Cold Snap and the snap never started.
 *
 * Two systems share a name. HV-18's Cold Snap is G.snapUntil: two
 * brutal winter days, extra warmth drain, a goal that counts
 * snapsSurvived. The weather table's `cold` row is a single-day sky
 * with its own bite (warmth:12). Its name is also "Cold Snap".
 *
 * A quiet cold morning therefore logs "❄️ Cold Snap" while
 * snapActive() is false and the snap2 goal does not move. The
 * player reads the real snap on a day that is just cold.
 *
 * Distinct from HV-72 (the random-pool Cold Snap *card* never
 * stamps snapUntil) and HV-67 (Good Weather never assigned clear).
 * This ticket is the weather row's name, not the event and not
 * the snap latch.
 *
 * This suite is write-first and source-driven.
 *
 *  A. The weather table still has a `cold` row — guards the guard.
 *  B. Source: that row's name is not "Cold Snap". The event title
 *     and the HV-18 snap latch stay. ui.js is not this ticket.
 *  C. Live: a pinned cold dawn names the sky something else, and
 *     snapActive() stays false. The Cold Snap event is still titled
 *     Cold Snap. Reverting the weather name fails the named line.
 *  Z. Zero page errors.
 *
 * Hook-free. Reads WEATHERS.cold and drives onNewDay.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const coldAt = cfg.indexOf('cold:');
const coldRow = coldAt >= 0 ? cfg.slice(coldAt, coldAt + 180) : '';
const evAt = loop.indexOf("id:'cold_snap'");
const ev = evAt >= 0 ? loop.slice(evAt, evAt + 280) : '';

(async () => {
  ok(/cold:\s*\{/.test(cfg) && /warmth:\s*12/.test(coldRow),
     'the weather table still has a cold row with its own bite — guards the guard');

  ok(/name:'[^']+'/.test(coldRow) && !/name:'Cold Snap'/.test(coldRow),
     `a cold day's weather name is not Cold Snap (got ${coldRow.replace(/\s+/g,' ').slice(0,80)})`);

  ok(/title:'Cold Snap'/.test(ev) && /function snapAtDawn\(/.test(loop) && /snapUntil/.test(loop),
     'the Cold Snap *event* and the HV-18 snap latch keep the name — this ticket is the weather row');

  ok(!/Cold Snap/.test(ui) && !/WEATHERS\.cold/.test(ui),
     'ui.js is not this ticket — it still only paints the weather icon');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvcoldname-init')) {
      sessionStorage.setItem('hvcoldname-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const live = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.days = 5;
    G.forecast = 'cold';
    G.weather = 'clear';
    G.snapUntil = null;
    G.snapsSurvived = 0;
    G.lastEventDay = 99;
    G.dog = 0;
    onNewDay();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    const ev = EVENTS_BAD.find(e => e.id === 'cold_snap');
    return {
      weather: G.weather,
      name: weatherDef().name,
      snap: snapActive(),
      survived: G.snapsSurvived,
      evTitle: ev && ev.title,
      log,
    };
  });

  ok(live.weather === 'cold' && live.snap === false && live.survived === 0,
     `a pinned cold dawn is just weather — not a gripping snap (weather ${live.weather}, snap ${live.snap}, survived ${live.survived})`);
  ok(live.name && !/cold snap/i.test(live.name),
     `HV-90: a cold day's name is not Cold Snap (got ${JSON.stringify(live.name)})`);
  ok(live.evTitle === 'Cold Snap',
     `the Cold Snap event is still titled Cold Snap (got ${JSON.stringify(live.evTitle)})`);
  ok(!/❄️ Cold Snap|❄ Cold Snap/.test(live.log),
     `the dawn log does not call a quiet cold morning a Cold Snap`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/* HV-81 — Fire Went Out said overnight and relit in 30 seconds.
 *
 * The event card promises: "The barrel fire died overnight."
 * The effect wrote G.fireOutUntil = Date.now()+30000. A day is
 * ten minutes. Thirty seconds later the barrel was bright again
 * while the card was still the last thing you read.
 *
 * Same class as Dumpsters Locked (today vs a minute) and Old
 * Friend (briefly vs a timer that died on reload). #723 is
 * Firewood clearing the dark — not this duration lie.
 *
 * Write-first, hook-free, source-driven.
 *
 * A. The card still says overnight. The effect stamps G.fireOutDay
 *    (not Date.now()+30000). main.js reads the day, not a 30s clock.
 *    load migrates a missing stamp. ui.js is not touched.
 * B. Mid-day trigger: the remaining window is minutes, not ~30s,
 *    and fireOutDay === today. Wiping the wall-clock still leaves
 *    the barrel dark. A new dawn lifts it.
 *
 * Named assertion: HV-81: Fire Went Out lasts until dawn, not 30 seconds.
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
const save = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const evAt = loop.indexOf("id:'fire_out'");
const ev = evAt >= 0 ? loop.slice(evAt, evAt + 420) : '';

(async () => {
  ok(/overnight/i.test(ev),
     `the Fire Went Out card still promises "overnight" (got ${JSON.stringify((ev.match(/desc:'[^']+'/)||[''])[0])})`);

  ok(!/Date\.now\(\)\s*\+\s*30000/.test(ev),
     'the effect no longer writes a 30-second wall-clock');

  ok(/G\.fireOutDay\s*=\s*G\.days/.test(ev),
     'the dark is stamped on today — dawn, not a timer, owns the night');

  ok(/fireOutDay/.test(main) && /fireOutDay===G\.days/.test(main.replace(/\s/g,'')),
     'main.js dims the barrel from fireOutDay, not Date.now()+30s');

  ok(/fireOutDay:\s*-1/.test(cfg),
     'G defaults fireOutDay to -1 — a fresh camp is not dark');

  ok(/typeof G\.fireOutDay!=='number'/.test(save),
     'loadGame migrates a pre-HV-81 save that never wrote fireOutDay');

  ok(!/fireOutDay/.test(ui) && !/fire_out/.test(ui),
     'ui.js is not this ticket — it still only shows the event banner');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    ev: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'fire_out')),
    day: typeof G.fireOutDay === 'number' ? G.fireOutDay : null,
    dayLen: typeof DAY_LENGTH_MS === 'number' ? DAY_LENGTH_MS : 0,
  }));
  ok(!boot.intro && boot.ev,
     'a returning camp can fire Fire Went Out — not behind the crash course');
  ok(boot.day === -1 && boot.dayLen === 600000,
     `a fresh camp is not dark (fireOutDay ${boot.day}, day ${boot.dayLen}ms)`);

  // Mid-day: half a 10-minute day left. The old bug wrote ~30s.
  const mid = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const real = Math.random;
    Math.random = () => 0;
    G.days = 4;
    G.timeOfDay = 0.5;
    G.warmth = 80;
    const t0 = Date.now();
    ev.effect();
    Math.random = real;
    const remaining = G.fireOutUntil ? G.fireOutUntil - t0 : 0;
    const dark = typeof G.fireOutDay === 'number' && G.fireOutDay === G.days;
    return {
      remaining, lockDay: G.fireOutDay, days: G.days, dark,
      warmth: G.warmth,
    };
  });
  ok(mid.lockDay === 4 && mid.dark,
     `the dark is stamped on today (fireOutDay ${mid.lockDay}, dark=${mid.dark})`);
  ok(mid.remaining > 240000 && mid.remaining <= 300000,
     `HV-81: Fire Went Out lasts until dawn, not 30 seconds (remaining ${mid.remaining}ms)`);

  // The tell of the old bug: wipe the 30s timer. If the night was only
  // that timer, the barrel lights. If the night is the day, it stays dark.
  const wiped = await page.evaluate(() => {
    G.fireOutUntil = 0;
    const dark = typeof G.fireOutDay === 'number' && G.fireOutDay === G.days;
    return { dark, lockDay: G.fireOutDay, days: G.days };
  });
  ok(wiped.dark,
     `wiping the wall-clock still leaves the barrel dark (dark=${wiped.dark}, fireOutDay ${wiped.lockDay})`);

  // Dawn lifts it — same day increment the rest of the camp uses.
  const dawn = await page.evaluate(() => {
    G.days = (G.days || 0) + 1;
    const dark = typeof G.fireOutDay === 'number' && G.fireOutDay === G.days;
    return { dark, lockDay: G.fireOutDay, days: G.days };
  });
  ok(!dawn.dark,
     `a new dawn lifts the dark (day ${dawn.days}, fireOutDay ${dawn.lockDay})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

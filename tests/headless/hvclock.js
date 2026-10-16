/* HV-62 — a hostile clock must not burn days on load.
 *
 * tickDay does `if (timeOfDay >= 1) { timeOfDay -= 1; onNewDay(); }`
 * once a frame. loadGame() never clamped timeOfDay. A save with
 * timeOfDay: 50 therefore fired one dawn per frame until the number
 * dropped under 1 — measured on main: days 3 → 17, health 80 → 0,
 * warmth 80 → 0 in 2.5 seconds. The camp died. saves.js only asserts
 * the page still boots; it does not assert the day stayed put.
 *
 * Hook-free: write the real save key, load the real page, read G.
 * Reverting the load clamp fails the named assertion; a legal 0.25
 * clock is the other direction (do not reset a healthy save to dawn).
 *
 * A. Source: loadGame clamps timeOfDay into [0, 1).
 * B. timeOfDay: 50 keeps days/health/warmth.
 * C. A legal 0.25 clock is left alone.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const save = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
ok(/timeOfDay/.test(save) && /G\.timeOfDay\s*=\s*0/.test(save)
  && /timeOfDay\s*>=\s*1|timeOfDay\s*<\s*0/.test(save),
  'HV-62: loadGame clamps timeOfDay into [0, 1)');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  async function boot(tod, extra) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(([clock, more]) => {
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.setItem('homeless_village_v1', JSON.stringify(Object.assign({
        timeOfDay: clock,
        days: 3,
        health: 80,
        warmth: 80,
        food: 30,
        fridgeSeeded: true,
      }, more || {})));
    }, [tod, extra || {}]);
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2500);
    const st = await page.evaluate(() => ({
      days: G.days,
      tod: G.timeOfDay,
      health: G.health,
      warmth: G.warmth,
      over: !!document.getElementById('hv-gameover'),
    }));
    return { page, ctx, errs, st };
  }

  // B — the named assertion. Revert the load clamp and days jump,
  // health hits 0, and the camp ends.
  {
    const { ctx, errs, st } = await boot(50);
    ok(st.days === 3 && st.tod >= 0 && st.tod < 1 && st.health > 0 && !st.over,
      `HV-62: a timeOfDay of 50 does not burn days (days=${st.days}, tod=${st.tod.toFixed(3)}, health=${st.health})`);
    ok(errs.length === 0, `hostile 50: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  {
    const { ctx, errs, st } = await boot(-1);
    ok(st.days === 3 && st.tod >= 0 && st.tod < 1 && st.health > 0,
      `HV-62: a negative clock is parked, not wrapped (days=${st.days}, tod=${st.tod.toFixed(3)})`);
    ok(errs.length === 0, `hostile -1: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // C — a healthy mid-morning save must not be reset to dawn.
  {
    const { ctx, errs, st } = await boot(0.25);
    ok(st.tod >= 0.25 && st.tod < 0.26 && st.days === 3,
      `a legal 0.25 clock keeps walking from 0.25 (tod=${st.tod.toFixed(4)})`);
    ok(errs.length === 0, `legal clock: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

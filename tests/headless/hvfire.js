/*
 * HV-13 — The Fire Held (re-runnable: classic scripts, globals
 * reachable, save cleared on boot). High warmth stops being only
 * survival pressure: a camp that wakes with 50+ warmth after the
 * night's drain starts the day +2 morale up.
 *  A. Warm dawn: warmth 80 → 72 after the drain, morale -3 +2 = 49, log line.
 *  B. Cold camp: warmth 30 → 22, no bonus (morale 47).
 *  C. The boundary: exactly 50 after the drain still counts.
 *  D. The morale cap applies before the decay (99 → 100 → 97).
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvfire-init')) {
      sessionStorage.setItem('hvfire-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // one dawn under controlled skies; the dog arc is parked out of range
  const dawn = (warmth, morale) => t(new Function(`
    const real = Math.random; Math.random = () => 0.99;
    G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
    G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.weather = 'clear';
    G.warmth = ${warmth}; G.morale = ${morale}; G.food = 20; G.population = 1; G.rep = 0;
    onNewDay();
    Math.random = real;
    return { warmth: G.warmth, morale: G.morale,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  `));

  // A. warm dawn
  const warm = await dawn(80, 50);
  ok(warm.warmth === 72 && warm.morale === 49,
    `warm dawn: 80 → 72, morale -3 +2 = 49 (${warm.morale})`);
  ok(warm.log.includes('fire held'), 'the log tells the story');

  // B. cold camp
  const cold = await dawn(30, 50);
  ok(cold.warmth === 22 && cold.morale === 47,
    `cold camp: no bonus, plain -3 decay (${cold.morale})`);

  // C. the boundary — exactly 50 after the drain
  const edge = await dawn(58, 50);
  ok(edge.warmth === 50 && edge.morale === 49,
    `waking at exactly 50 still counts (${edge.warmth}, ${edge.morale})`);

  // D. cap order: +2 clamps at 100, then the -3 decay lands
  const capped = await dawn(80, 99);
  ok(capped.morale === 97, `the cap applies before the decay: 99 → 100 → 97 (${capped.morale})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

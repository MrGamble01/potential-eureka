/*
 * VOX-8 — the Duck's Dabble (re-runnable: classic scripts, fresh isle).
 *  A. The duck lives on the pond; no finds yet; Duck's Hoard registered.
 *  B. A dabble grants exact pocket change (r=.5 → +9) and counts the find.
 *  C. The rare branch surfaces the locket (r=.05 → +30).
 *  D. The timer drives dabbles and re-arms exactly (150 + r×120).
 *  E. Winter ices the pond — the timer never runs.
 *  F. duckFinds rides the save spread; five finds earn 🏆 Duck's Hoard.
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
    if (!sessionStorage.getItem('voxduck-init')) {
      sessionStorage.setItem('voxduck-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => ({ duck: !!pondDuck, finds: state.duckFinds || 0,
    ach: ACH.some(a => a[0] === 'duckfinds5') }));
  ok(fresh.duck && fresh.finds === 0, 'the duck paddles the pond, no finds yet');
  ok(fresh.ach, "Duck's Hoard is on the achievement list");

  // B — pocket change, exact
  const change = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    const c0 = state.coins;
    duckDabble();
    Math.random = real;
    return { gained: state.coins - c0, finds: state.duckFinds };
  });
  ok(change.gained === 9 && change.finds === 1,
    `a dabble surfaces 5 + (.5×8|0) = 9 coins (${change.gained})`);

  // C — the locket
  const locket = await t(() => {
    const real = Math.random; Math.random = () => 0.05;
    const c0 = state.coins;
    duckDabble();
    Math.random = real;
    return { gained: state.coins - c0, finds: state.duckFinds };
  });
  ok(locket.gained === 30 && locket.finds === 2, `the rare locket pays +30 (${locket.gained})`);

  // D — the timer path, in one frame
  const timer = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    duckDabbleT = 0.1;
    const f0 = state.duckFinds;
    updateDuckDabble(0.2);
    Math.random = real;
    return { fired: state.duckFinds - f0, rearm: duckDabbleT };
  });
  ok(timer.fired === 1 && Math.abs(timer.rearm - 210) < 1e-9,
    `the timer fires and re-arms 150 + .5×120 = 210 (${timer.rearm})`);

  // E — winter gate
  const winter = await t(() => {
    const day0 = state.day;
    while (seasonOf(state.day).key !== 'winter') state.day++;
    duckDabbleT = 0.1;
    const f0 = state.duckFinds;
    updateDuckDabble(0.2);
    const out = { fired: state.duckFinds - f0, t: duckDabbleT };
    duckDabbleT = 999;   // disarm before thawing, or the live loop fires it
    state.day = day0;
    return out;
  });
  ok(winter.fired === 0 && Math.abs(winter.t - 0.1) < 1e-9, 'winter ices the pond — the timer never runs');

  // F — the hoard + persistence
  const hoard = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    duckDabble(); duckDabble();   // finds 3 (B, C, the timer leg) + 2 = 5
    Math.random = real;
    checkAch();
    save();
    return { finds: state.duckFinds, ach: !!(state.ach && state.ach.duckfinds5) };
  });
  ok(hoard.finds === 5 && hoard.ach, `five finds earn 🏆 Duck's Hoard (${hoard.finds})`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const back = await t(() => ({ finds: state.duckFinds, ach: !!(state.ach && state.ach.duckfinds5) }));
  ok(back.finds === 5 && back.ach, `the hoard rides the save (${back.finds})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/*
 * VOX-2 — the Angler's Log (re-runnable: classic script, globals reachable,
 * save cleared on first load).
 * Catch determinism: Math.random is pinned to one constant c for the whole
 * reel-in window; c picks the species (weighted-scan window) AND the size
 * (min + c·range), so both are computable in the test.
 * Weights: perch 5, tropic 3, crab 2, puffer 1, koi 0.35, boot 2, weed 2
 * → total 15.35. Windows: perch ≤0.3257, tropic ≤0.5212, crab ≤0.6515,
 * puffer ≤0.7166, koi ≤0.7394.
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
    if (!sessionStorage.getItem('va-init')) {
      sessionStorage.setItem('va-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = fn => page.evaluate(fn);

  await t(() => {
    window.__cast = c => new Promise(res => {
      const real = Math.random;
      Math.random = () => c;
      state.day = 1;              // spring — pond open
      fishingT = 0;
      goFishing(0, 0);
      setTimeout(() => {
        Math.random = real;
        res({ log: JSON.parse(JSON.stringify(state.fishLog || {})), count: state.fishCount || 0 });
      }, 900);
    });
  });

  // A. fresh
  const fresh = await t(() => ({ log: state.fishLog || null, count: state.fishCount || 0,
    alm: (renderAlmanac(), document.getElementById('almBody').textContent) }));
  ok(!fresh.log && fresh.count === 0 && !fresh.alm.includes('ANGLER'), 'fresh isle: no log, almanac hides the section');

  // B. c=0.2 → perch at 0.4+0.2·2.1 = 0.8kg
  const first = await t(() => window.__cast(0.2));
  ok(first.log.perch && first.log.perch.n === 1 && first.log.perch.best === 0.8,
    `first perch logged at 0.8kg (${JSON.stringify(first.log.perch)})`);

  // C. c=0.32 → 1.1kg record; c=0.05 → 0.5kg doesn't dent it
  const big = await t(() => window.__cast(0.32));
  const small = await t(() => window.__cast(0.05));
  ok(big.log.perch.best === 1.1 && small.log.perch.best === 1.1 && small.log.perch.n === 3,
    `record climbs to 1.1kg and holds against 0.5kg (×${small.log.perch.n})`);

  // D. almanac section
  const alm = await t(() => { renderAlmanac(); return document.getElementById('almBody').textContent; });
  ok(alm.includes('ANGLER') && alm.includes('Perch ×3') && alm.includes('best 1.1kg'), 'almanac shows the log row');
  ok(alm.includes('???'), 'uncaught species stay ???');

  // E. koi (c=0.72 → 6.3kg) + the rest → Compleat Angler
  const koi = await t(() => window.__cast(0.72));
  ok(koi.log.koi && koi.log.koi.n === 1 && koi.log.koi.best === 6.3, `the Golden Koi lands at ${koi.log.koi && koi.log.koi.best}kg`);
  ok(await t(() => !!state.achFlags.koi && !!state.ach.koi), 'The Golden One unlocks');
  await t(() => window.__cast(0.4));    // tropic
  await t(() => window.__cast(0.6));    // crab
  const all = await t(() => window.__cast(0.7));   // puffer
  ok(Object.keys(all.log).length === 5 && await t(() => !!state.ach.angler),
    'five species → 🏆 Compleat Angler');

  // F. winter freeze
  const frozen = await t(() => {
    state.day = 10; fishingT = 0;
    const before = state.fishCount;
    goFishing(0, 0);
    return { before, after: state.fishCount, toast: document.body.textContent.includes('frozen solid') };
  });
  ok(frozen.after === frozen.before && frozen.toast, 'winter: the pond is frozen solid');

  // G. persistence
  await t(() => { state.day = 1; save(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ perch: state.fishLog && state.fishLog.perch, ach: !!state.ach.angler }));
  ok(back.perch && back.perch.best === 1.1 && back.ach, 'log + achievements survive reload');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

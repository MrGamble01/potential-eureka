/*
 * VOX-7 — Rainbow's End (re-runnable: classic scripts, fresh isle each run).
 *  A. No rainbow: mult 1; Pot of Gold registered.
 *  B. spawnRainbow(): the arc holds 24s and the mult is ×1.25.
 *  C. A livestock cash-in pays exactly sell × market × 1.25, and flags the ach.
 *  D. A crop harvest pays the seasoned price rounded ×1.25.
 *  E. The arc fades and the window closes (mult back to 1).
 *  F. checkAch() lands 🏆 Pot of Gold.
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
    if (!sessionStorage.getItem('voxrainbow-init')) {
      sessionStorage.setItem('voxrainbow-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => ({ up: !!rainbow, mult: rainbowMult(),
    ach: ACH.some(a => a[0] === 'potofgold') }));
  ok(!fresh.up && fresh.mult === 1, 'no rainbow: no premium');
  ok(fresh.ach, 'Pot of Gold is on the achievement list');

  // B
  const arc = await t(() => { spawnRainbow(); return { up: !!rainbow, t: rainbowT, mult: rainbowMult() }; });
  ok(arc.up && arc.t === 24 && arc.mult === 1.25, `the arc holds and the window opens (×${arc.mult})`);

  // C — livestock cash-in, exact
  const beast = await t(() => {
    const type = Object.keys(ANIMALS)[0];
    const a = spawnAnimal(type, 3.5, 3.5, 1, 1);
    const c0 = state.coins;
    cashInAnimal(a);
    return { type, gained: state.coins - c0,
      want: Math.round(ANIMALS[type].sell * sellMult() * 1.25),
      flag: !!state.achFlags.rainbowSale };
  });
  ok(beast.gained === beast.want && beast.flag,
    `the ${beast.type} sells at the rainbow premium (+${beast.gained})`);

  // D — crop harvest, exact through the season chain
  const crop = await t(() => {
    const type = Object.keys(PLANTS)[0];
    const def = PLANTS[type];
    const p = addPlant(4, surfaceY(4, 5), 5, type, true, 1, 2, false);
    let want = def.sell;
    if (inSeason(def)) want = Math.round(want * 1.4);
    want = Math.round(want * 1.25);
    const c0 = state.coins;
    actOnPlant(p);
    return { type, gained: state.coins - c0, want };
  });
  ok(crop.gained === crop.want, `the ${crop.type} harvest pays the seasoned price ×1.25 (+${crop.gained})`);

  // E — the arc fades
  const fade = await t(() => { rainbowT = 0.01; updateRainbow(0.02); return { up: !!rainbow, mult: rainbowMult() }; });
  ok(!fade.up && fade.mult === 1, 'the arc fades and the window closes');

  // F — the trophy
  const gold = await t(() => { checkAch(); return !!(state.ach && state.ach.potofgold); });
  ok(gold, '🏆 Pot of Gold lands');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

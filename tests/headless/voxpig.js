/* VOX-20 — the Truffle Pig (one-shot, classic-script globals).
 * A. The 🐖 pig in the shop (760 / lvl 9 / kind pig), the sty
 *    renders, Snout of Gold registered, the how-to bullet is in.
 * B. No pig: a shower passing over roots nothing.
 * C. Pig in the sty: rain falls, rain lifts — exactly +20 🪙, the
 *    tally ticks; a second dry tick pays nothing (one truffle a
 *    shower).
 * D. A second shower pays again — the payoff re-arms with the
 *    weather.
 * E. Five truffles crown Snout of Gold; the tally rides the save and
 *    a legacy save migrates clean.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('voxpig-init')) {
      sessionStorage.setItem('voxpig-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.trufflepig;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: pigCubes(BUILDINGS.trufflepig).length,
      ach: ACH.some(a => a[0] === 'truffle5'),
      howto: document.body.innerHTML.includes('Truffle Pig</b> (level 9)') };
  });
  ok(fresh.def && fresh.def.cost === 760 && fresh.def.lvl === 9 && fresh.def.kind === 'pig'
    && fresh.cubes >= 8, 'the 🐖 Truffle Pig is in the shop (760 / lvl 9) and renders');
  ok(fresh.ach && fresh.howto, 'Snout of Gold registered; the how-to bullet is in');

  // B — no pig
  const pigless = await t(() => {
    state.buildings = state.buildings || {};
    delete state.buildings.trufflepig;
    state.coins = 500;
    rainActive = true;  updateTrufflePig(0.05);
    rainActive = false; updateTrufflePig(0.05);
    return { coins: state.coins, truffles: state.truffles || 0 };
  });
  ok(pigless.coins === 500 && pigless.truffles === 0, 'no pig — a passing shower roots nothing');

  // C — the first shower
  const rooted = await t(() => {
    state.buildings.trufflepig = { x: 6, z: 6 };
    state.coins = 500;
    rainActive = true;  updateTrufflePig(0.05);
    rainActive = false; updateTrufflePig(0.05);
    const one = { coins: state.coins, truffles: state.truffles };
    updateTrufflePig(0.05);   // still dry — no second truffle
    return { one, coinsAfterDry: state.coins };
  });
  ok(rooted.one.coins === 520 && rooted.one.truffles === 1,
    'the rain lifts and the pig roots exactly +20 🪙');
  ok(rooted.coinsAfterDry === 520, 'one truffle a shower — a second dry tick pays nothing');

  // D — the payoff re-arms with the weather
  const rearmed = await t(() => {
    rainActive = true;  updateTrufflePig(0.05);
    rainActive = false; updateTrufflePig(0.05);
    return { coins: state.coins, truffles: state.truffles };
  });
  ok(rearmed.coins === 540 && rearmed.truffles === 2, 'a second shower pays again');

  // E — the crown + persistence
  const crowned = await t(() => {
    state.truffles = 5;
    return ACH.find(a => a[0] === 'truffle5')[3]();
  });
  ok(crowned, 'five truffles crown Snout of Gold');
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ truffles: state.truffles, built: pigBuilt() }));
  ok(back.truffles === 5 && back.built, 'the tally and the sty ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.truffles; delete sv.state.buildings.trufflepig;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ truffles: state.truffles || 0, built: pigBuilt() }));
  ok(legacy.truffles === 0 && !legacy.built, 'a pre-VOX-20 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

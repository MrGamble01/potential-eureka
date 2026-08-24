/* VOX-15 — the Ice Hut & Ice Fishing (one-shot, classic-script globals).
 * A. Fresh isle: the 🛖 Ice Hut in the shop (750 / lvl 8 / kind icehut),
 *    the hut renders in cubes, Hard Water registered, the winter table
 *    reads 34/48/200, the how-to bullet is in.
 * B. Winter without the hut: the pond stays frozen — no cast starts.
 * C. Winter with the hut: a forced-low roll lands an Arctic Char —
 *    coins land, the Angler's Log opens a char page, the ice tally
 *    ticks; a forced ice-chunk roll pays 6 but is no catch (tally and
 *    log untouched, no fish good stocked).
 * D. The Moon Koi lands on its seeded window and opens its log page.
 * E. Summer casts still fish the old table and never tick the tally.
 * F. Five ice catches crown Hard Water.
 * G. The tally and the hut ride the save; a legacy save migrates clean.
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
    if (!sessionStorage.getItem('voxice-init')) {
      sessionStorage.setItem('voxice-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.icehut;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: icehutCubes(BUILDINGS.icehut).length,
      ach: ACH.some(a => a[0] === 'ice5'),
      table: ICE_CATCH.filter(f => f.id).map(f => f.coins).join(','),
      howto: document.body.innerHTML.includes('Ice Hut</b> (level 8)') };
  });
  ok(fresh.def && fresh.def.cost === 750 && fresh.def.lvl === 8 && fresh.def.kind === 'icehut'
    && fresh.cubes >= 8, 'the 🛖 Ice Hut is in the shop (750 / lvl 8) and renders in cubes');
  ok(fresh.ach && fresh.table === '34,48,200' && fresh.howto,
    'Hard Water registered; the winter table reads 34/48/200; the how-to bullet is in');

  // find a winter day and a summer day
  const days = await t(() => {
    let w = 0, s = 0;
    for (let d = 1; d < 40 && !(w && s); d++) {
      const k = seasonOf(d).key;
      if (!w && k === 'winter') w = d;
      if (!s && k === 'summer') s = d;
    }
    return { w, s };
  });

  // B — frozen without the hut
  const frozen = await t(d => {
    state.day = d.w;
    fishingT = 0;
    goFishing(10, 10);
    return { casting: fishingT > 0, hut: icehutBuilt() };
  }, days);
  ok(!frozen.hut && !frozen.casting, 'winter without the hut: the pond stays frozen — no cast starts');

  // C — the char and the ice chunk
  await t(() => {
    state.buildings = state.buildings || {};
    state.buildings.icehut = 1;
    state.coins = 1000;
    fishingT = 0;
    Math.random = () => 0.01;   // r ≈ 0.103 → Arctic Char
    goFishing(10, 10);
  });
  await page.waitForTimeout(1000);
  const char = await t(() => ({
    coins: state.coins, log: state.fishLog && state.fishLog.char,
    tally: state.iceCatches || 0, casting: fishingT > 0 }));
  ok(char.coins === 1034 && char.log && char.log.n === 1 && char.tally === 1,
    'a forced-low winter roll lands an Arctic Char: +34 🪙, the log opens, the tally ticks');
  await t(() => {
    fishingT = 0;
    Math.random = () => 0.9;    // r ≈ 9.27 → the 🧊 chunk
    goFishing(10, 10);
  });
  await page.waitForTimeout(1000);
  const chunk = await t(() => ({
    coins: state.coins, tally: state.iceCatches || 0,
    fishGood: (state.goods && state.goods.fish) || 0 }));
  ok(chunk.coins === 1040 && chunk.tally === 1 && chunk.fishGood === 0,
    'an ice chunk pays 6 but is no catch — tally and crate untouched');

  // D — the Moon Koi
  await t(() => {
    fishingT = 0;
    Math.random = () => 0.805;  // r ≈ 8.29 → the 🌙 Moon Koi window
    goFishing(10, 10);
  });
  await page.waitForTimeout(1000);
  const koi = await t(() => ({
    log: state.fishLog && state.fishLog.icekoi, coins: state.coins, tally: state.iceCatches }));
  ok(koi.log && koi.log.n === 1 && koi.log.best > 0 && koi.coins === 1240 && koi.tally === 2,
    'the Moon Koi lands on its seeded window: +200 🪙, its log page opens');

  // E — summer fishes the old table
  const summer = await t(d => {
    state.day = d.s;
    fishingT = 0;
    Math.random = () => 0.01;   // → Perch on the old table
    goFishing(10, 10);
    return null;
  }, days);
  await page.waitForTimeout(1000);
  const perch = await t(() => ({
    log: state.fishLog && state.fishLog.perch, tally: state.iceCatches }));
  ok(perch.log && perch.log.n === 1 && perch.tally === 2,
    'a summer cast fishes the old table and never ticks the ice tally');

  // F — the crown
  const crowned = await t(() => {
    state.iceCatches = 5;
    return ACH.find(a => a[0] === 'ice5')[3]();
  });
  ok(crowned, 'five ice catches crown Hard Water');

  // G — persistence + legacy migration
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ tally: state.iceCatches, hut: icehutBuilt() }));
  ok(back.tally === 5 && back.hut, 'the tally and the hut ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.iceCatches; delete sv.state.buildings.icehut;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ tally: state.iceCatches || 0, hut: icehutBuilt() }));
  ok(legacy.tally === 0 && !legacy.hut, 'a pre-VOX-15 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

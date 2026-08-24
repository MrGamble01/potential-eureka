/*
 * VOX-6 — cat gifts (re-runnable: classic scripts, fresh isle each run).
 *  A. Fresh isle: no cat, no trust, Little Hunter is on the achievement list.
 *  B. Five hellos build trust; the gift timer only fires for a trusted cat,
 *     then a bundle lands at the cat's feet, pickable, timer re-armed exactly.
 *  C. Exact rewards: pocket change (r=.5 → +13 🪙), a stockpile good (r=.3,
 *     coins untouched), the lost ring (r=.05 → +45 🪙).
 *  D. Five gifts earn 🏆 Little Hunter.
 *  E. catPets/catGifts ride the save; the cat and its trust survive reload.
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
    if (!sessionStorage.getItem('voxcat-init')) {
      sessionStorage.setItem('voxcat-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const t = fn => page.evaluate(fn);

  // A. fresh isle
  const fresh = await t(() => ({ cat: !!townCat, pets: state.catPets || 0,
    ach: ACH.some(a => a[0] === 'catgift5') }));
  ok(!fresh.cat && fresh.pets === 0, 'fresh isle: no cat, no trust');
  ok(fresh.ach, 'Little Hunter is on the achievement list');

  // B. trust gate + the first bundle, in one frame so the live loop
  // can't interleave
  const gift = await t(() => {
    state.buildings.tavern = { x: 3, z: 3 };
    spawnCat();
    catGiftT = 0.1;
    updateCatGift(0.2);                    // untrusted: the timer never runs
    const before = !!catGift;
    for (let i = 0; i < 5; i++) petCat();
    const real = Math.random; Math.random = () => 0.5;
    catGiftT = 0.1;
    updateCatGift(0.2);                    // trusted: the bundle drops
    Math.random = real;
    return { before, after: !!catGift, pets: state.catPets, timer: catGiftT,
      pick: !!catGift && getPickables().includes(catGift.mesh) };
  });
  ok(!gift.before, 'an untrusted cat brings nothing');
  ok(gift.pets === 5 && gift.after, `five hellos open the gift loop (pets ${gift.pets})`);
  ok(Math.abs(gift.timer - 210) < 1e-9, `timer re-arms 150 + .5×120 = 210 (${gift.timer})`);
  ok(gift.pick, 'the bundle is tappable (in the pickable set)');

  // C1. pocket change: r=.5 → 8 + (.5×10|0) = 13
  const pocket = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    const c0 = state.coins;
    openCatGift();
    Math.random = real;
    return { coins: state.coins - c0, gifts: state.catGifts, gone: !catGift };
  });
  ok(pocket.coins === 13 && pocket.gifts === 1 && pocket.gone,
    `pocket change: +13 coins, gift consumed (${pocket.coins})`);

  // C2. a good for the stockpile: r=.3, coins untouched
  const good = await t(() => {
    const real = Math.random; Math.random = () => 0.3;
    spawnCatGift();
    const ks = goodsKeys(), k = ks[(0.3 * ks.length) | 0];
    const g0 = state.goods[k] || 0, c0 = state.coins;
    openCatGift();
    Math.random = real;
    return { k, gained: (state.goods[k] || 0) - g0, coins: state.coins - c0, gifts: state.catGifts };
  });
  ok(good.gained === 1 && good.coins === 0 && good.gifts === 2,
    `the bundle held a ${good.k} for the stockpile (+${good.gained}, coins +${good.coins})`);

  // C3. the lost ring: r=.05 → flat +45
  const ring = await t(() => {
    const real = Math.random; Math.random = () => 0.05;
    spawnCatGift();
    const c0 = state.coins;
    openCatGift();
    Math.random = real;
    return { coins: state.coins - c0, gifts: state.catGifts };
  });
  ok(ring.coins === 45 && ring.gifts === 3, `rare: the lost ring pays +45 (${ring.coins})`);

  // D. two more gifts earn Little Hunter
  const hunter = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    spawnCatGift(); openCatGift();
    spawnCatGift(); openCatGift();
    Math.random = real;
    return { gifts: state.catGifts, ach: !!(state.ach && state.ach.catgift5) };
  });
  ok(hunter.gifts === 5 && hunter.ach, `five gifts earn 🏆 Little Hunter (${hunter.gifts})`);

  // E. persistence: counters ride the save, the cat returns with the tavern
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const back = await t(() => ({ pets: state.catPets, gifts: state.catGifts,
    cat: !!townCat, trusts: catTrusts(), ach: !!(state.ach && state.ach.catgift5) }));
  ok(back.pets === 5 && back.gifts === 5 && back.ach, `reload keeps trust and the tally (${back.pets}/${back.gifts})`);
  ok(back.cat && back.trusts, 'the cat is back and still trusts you');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

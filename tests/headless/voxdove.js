/* VOX-13 — the Dovecote (one-shot, classic-script globals).
 * A. Fresh isle: the dovecote in the shop at 700/lvl 7, the house
 *    renders, Par Avion registered, the how-to knows it, banner dark.
 * B. No dovecote (or no stockpile) → the clock never runs.
 * C. With both up, a pinned letter lands: a held good, 2–4 of it, at
 *    exactly 1.75× base value, on a 90s window; the banner lights.
 * D. A short stockpile can't fill it; a stocked one sends the dove
 *    home heavy — goods down, coins up by the exact premium, tally up.
 * E. An unanswered letter flies home at zero and rearms the clock.
 * F. Five filled orders crown Par Avion; the tally rides the save.
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
    if (!sessionStorage.getItem('voxdove-init')) {
      sessionStorage.setItem('voxdove-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.dovecote;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: doveCubes(d).length, built: dovecoteBuilt(),
      ach: ACH.some(a => a[0] === 'dove5'),
      howto: document.body.innerHTML.includes('Dovecote'),
      dark: document.getElementById('doveHud').style.display === 'none' };
  });
  ok(fresh.def && fresh.def.cost === 700 && fresh.def.lvl === 7 && fresh.def.kind === 'dove',
    'the dovecote is in the shop at 700 coins, level 7');
  ok(fresh.cubes >= 8 && !fresh.built && fresh.ach && fresh.howto && fresh.dark,
    `the house renders (${fresh.cubes} cubes); Par Avion registered; the banner is dark`);

  // B — no dovecote, no clock
  const idle = await t(() => {
    doveNextT = 50;
    updateDoves(10);
    return { t: doveNextT, order: !!doveOrder };
  });
  ok(idle.t === 50 && !idle.order, 'no dovecote — the clock never runs');

  // C — a pinned letter lands
  const landed = await t(() => {
    state.buildings = state.buildings || {};
    state.buildings.dovecote = { x: 8, z: 8 };
    state.buildings.market = state.buildings.market || { x: 6, z: 6 };  // stockpiles() on
    state.goods.honey = 10;
    const real = Math.random; Math.random = () => 0;   // pick the first held good, qty 2
    doveNextT = 0.01;
    updateDoves(0.1);
    Math.random = real;
    const held = Object.keys(state.goods).filter(k => state.goods[k] > 0);
    return { order: doveOrder ? { good: doveOrder.good, qty: doveOrder.qty, pay: doveOrder.pay, expire: doveOrder.expire } : null,
      wantPay: doveOrder ? Math.round(doveOrder.qty * goodDef(doveOrder.good).yield * 1.75) : null,
      heldFirst: held[0],
      lit: document.getElementById('doveHud').style.display !== 'none' };
  });
  ok(landed.order && landed.order.good === landed.heldFirst && landed.order.qty === 2
    && landed.order.pay === landed.wantPay && landed.order.expire === 90 && landed.lit,
    `a letter lands: 2× ${landed.order && landed.order.good} at exactly 1.75× base (${landed.order && landed.order.pay} 🪙)`);

  // D — short, then stocked
  const filled = await t(() => {
    const good = doveOrder.good, pay = doveOrder.pay, qty = doveOrder.qty;
    const stock0 = state.goods[good];
    state.goods[good] = qty - 1;
    fillDoveOrder();
    const short = { order: !!doveOrder, coins: state.coins };
    state.goods[good] = 6;
    const coins0 = state.coins;
    fillDoveOrder();
    return { short, good, left: state.goods[good], gained: state.coins - coins0,
      pay, filled: state.doveFilled, order: !!doveOrder };
  });
  ok(filled.short.order, 'a short stockpile can\'t fill the letter');
  ok(!filled.order && filled.left === 4 && filled.gained === filled.pay && filled.filled === 1,
    `a stocked one sends the dove home heavy (+${filled.gained} 🪙, tally 1)`);

  // E — the unanswered letter
  const flown = await t(() => {
    doveNextT = 0.01;
    const real = Math.random; Math.random = () => 0.5;
    updateDoves(0.1);                 // a fresh letter
    const had = !!doveOrder;
    doveOrder.expire = 0.05;
    updateDoves(0.1);                 // it flies home
    Math.random = real;
    return { had, order: !!doveOrder, rearmed: doveNextT >= 239 && doveNextT <= 360,
      dark: document.getElementById('doveHud').style.display === 'none' };
  });
  ok(flown.had && !flown.order && flown.rearmed && flown.dark,
    'an unanswered letter flies home at zero and rearms the clock');

  // F — the crown + persistence
  await t(() => { state.doveFilled = 5; checkAch(); save(); });
  const crowned = await t(() => !!(state.ach && state.ach.dove5));
  ok(crowned, 'five filled orders crown Par Avion');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const back = await t(() => ({ filled: state.doveFilled, built: dovecoteBuilt(),
    ach: !!(state.ach && state.ach.dove5) }));
  ok(back.filled === 5 && back.built && back.ach, 'the tally, the dovecote and the crown ride the save');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

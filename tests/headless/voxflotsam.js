/*
 * VOX-4 — flotsam & the Pier (re-runnable; classic script, no hook).
 *  A. The ⚓ Pier is registered (cost 560, lvl 5, sprite cubes) and the
 *     🏆 Beachcomber ach + how-to line exist.
 *  B. A crate spawns on a pond cell when the timer runs out (not winter).
 *  C. Cracking it pays exact pinned-random coins; no good on a miss roll.
 *  D. With a Pier: ×1.6 coins, the good lands on the same roll, and the
 *     wait timer runs twice as fast.
 *  E. An ignored crate sinks at 60s, paying nothing.
 *  F. Winter ice: no spawns.
 *  G. Beachcomber unlocks at five crates; the count rides the save.
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
    if (!sessionStorage.getItem('vf-init')) {
      sessionStorage.setItem('vf-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = fn => page.evaluate(fn);

  // A. registration
  const a = await t(() => ({
    def: BUILDINGS.pier, cubes: buildingCubes(BUILDINGS.pier).length,
    ach: ACH.some(x => x[0] === 'flotsam5'),
    howto: document.body.innerHTML.includes('Flotsam'),
  }));
  ok(a.def && a.def.ico === '⚓' && a.def.cost === 560 && a.def.lvl === 5 && a.cubes >= 8,
    `the Pier is registered with a ${a.cubes}-cube sprite`);
  ok(a.ach && a.howto, 'Beachcomber ach + how-to line exist');

  // B. spawn on the pond
  const b = await t(() => {
    state.day = 2;                        // spring — open water
    flotsamNextT = 0.01;
    updateFlotsam(0.1);
    const m = flotsam && flotsam.mesh.position;
    return { spawned: !!flotsam,
      onPond: !!flotsam && W.pondCells.some(([x, z]) => x === flotsam.x && z === flotsam.z),
      y: m && m.y, waterY: W.waterY };
  });
  ok(b.spawned && b.onPond, 'the crate bobs up on a pond cell');
  ok(b.y > b.waterY && b.y < b.waterY + 1, `it floats at the surface (y=${b.y && b.y.toFixed(2)})`);

  // C. crack it open — exact pinned coins, no good on 0.5 vs 0.3
  const c = await t(() => {
    const oldR = Math.random;
    Math.random = () => 0.5;
    const coins0 = state.coins, earned0 = state.totalEarned, goods0 = goodsTotal();
    openFlotsam();
    Math.random = oldR;
    return { d: state.coins - coins0, e: state.totalEarned - earned0,
      goodsDelta: goodsTotal() - goods0, opened: state.flotsamOpened, gone: !flotsam };
  });
  ok(c.d === 43 && c.e === 43, `the 0.5 roll pays exactly 25+18 = 43 coins (+${c.d})`);
  ok(c.goodsDelta === 0 && c.opened === 1 && c.gone, 'no good on a 0.5 vs 0.30 roll; crate consumed');

  // D. the Pier: ×1.6 coins, good lands, timer runs double
  const d = await t(() => {
    const oldR = Math.random;
    state.buildings.pier = { x: 8, z: 8 };    // positions are {x,z} objects
    Math.random = () => 0.4;                  // spawn cell + coins + good rolls all pinned
    flotsamNextT = 0.01; updateFlotsam(0.1);  // spawn (timer decrement irrelevant here)
    const ks = goodsKeys(), expectGood = ks[(0.4 * ks.length) | 0];
    const coins0 = state.coins, g0 = state.goods[expectGood] || 0;
    openFlotsam();
    const paid = state.coins - coins0;
    const gotGood = (state.goods[expectGood] || 0) - g0;
    flotsam = null; flotsamNextT = 10;
    updateFlotsam(1);                          // pier: 10 − 1×2 = 8
    const timer = flotsamNextT;
    Math.random = oldR;
    return { paid, gotGood, expectGood, timer, opened: state.flotsamOpened };
  });
  ok(d.paid === 62, `with the Pier the 0.4 roll pays round(39×1.6) = 62 (+${d.paid})`);
  ok(d.gotGood === 1, `and the 0.4 good roll lands one ${d.expectGood} in the stockpile`);
  ok(Math.abs(d.timer - 8) < 0.001, `the Pier runs the wait timer at double speed (10→${d.timer})`);

  // E. an ignored crate sinks
  const e = await t(() => {
    const oldR = Math.random; Math.random = () => 0.4;
    flotsamNextT = 0.01; updateFlotsam(0.1);
    Math.random = oldR;
    const coins0 = state.coins;
    flotsam.t = FLOTSAM_DRIFT - 0.05;
    updateFlotsam(0.1);
    return { gone: !flotsam, paid: state.coins - coins0, opened: state.flotsamOpened };
  });
  ok(e.gone && e.paid === 0 && e.opened === 2, 'an ignored crate sinks after 60s, paying nothing');

  // F. winter ice
  const f = await t(() => {
    let winterDay = 1;
    for (let day = 1; day < 80; day++) if (seasonOf(day).key === 'winter') { winterDay = day; break; }
    state.day = winterDay;
    flotsam = null; flotsamNextT = 0.01;
    updateFlotsam(1);
    const frozen = !flotsam;
    state.day = 2;
    return { frozen, winterDay };
  });
  ok(f.frozen, `no crates through winter ice (day ${f.winterDay})`);

  // G. Beachcomber + persistence
  const g1 = await t(() => {
    state.flotsamOpened = 5;
    checkAch();
    save();
    return { ach: !!state.ach.flotsam5 };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const g2 = await t(() => ({ opened: state.flotsamOpened, ach: !!state.ach.flotsam5 }));
  ok(g1.ach, '🏆 Beachcomber unlocks at five crates');
  ok(g2.opened === 5 && g2.ach, 'the count and the trophy ride the wholesale state save');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

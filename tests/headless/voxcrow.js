/*
 * VOX-1 — crows & the scarecrow (re-runnable: classic script, globals
 * reachable, save cleared on first load).
 *  A. A crow lands on the only growing crop; first sighting explains itself.
 *  B. A scarecrow within 6 blocks makes a crop untouchable; distant crops
 *     still get raided.
 *  C. An ignored crow pecks 35% of the grow bar away and flees.
 *  D. Tapping (shooCrow) counts up and unlocks 🏆 Crow Patrol at 5.
 *  E. No crows in winter; spring resumes them.
 *  F. The shoo counter and achievement survive reload.
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
    if (!sessionStorage.getItem('vc-init')) {
      sessionStorage.setItem('vc-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = fn => page.evaluate(fn);

  // A. first crow lands on the only growing crop
  const first = await t(() => {
    for (const p of [...W.plants.values()]) removePlant(p);   // clean field
    const p = addPlant(2, 8, 2, 'sunflower');
    spawnCrow();
    return { landed: !!crow && crow.p === p, seen: !!state.achFlags.crowSeen,
      pickable: !!crow && crow.mesh.children.every(c => c.userData.crow),
      toast: document.body.textContent.includes('eyeing your crops') };
  });
  ok(first.landed, 'a crow lands on the only growing crop');
  ok(first.seen && first.toast, 'first sighting explains tap-to-shoo + scarecrow');
  ok(first.pickable, 'every crow part is tappable (userData.crow)');

  // B. scarecrow guard radius
  const guard = await t(() => {
    shooCrow(false); updateCrow(3);                       // clear the sitter
    addPlant(4, 8, 4, 'scarecrow');                       // 2.8 blocks from the sunflower
    spawnCrow();
    const guarded = crow === null;
    const far = addPlant(20, 8, 20, 'carrot');            // ~22 blocks out — fair game
    spawnCrow();
    return { guarded, raided: !!crow && crow.p === far };
  });
  ok(guard.guarded, 'a scarecrow within 6 blocks keeps the crow away');
  ok(guard.raided, 'a distant crop still gets raided');

  // C. the peck
  const peck = await t(() => {
    const p = crow.p, def = PLANTS[p.type];
    p.prog = def.grow * 0.5; p.stage = 1;
    crow.t = 17.9;
    updateCrow(0.2);
    return { prog: p.prog, expected: def.grow * 0.15, fled: crow.state === 'flee',
      toast: document.body.textContent.includes('pecked your Carrot') };
  });
  ok(Math.abs(peck.prog - peck.expected) < 1e-9, `an ignored crow pecks 35% of the grow bar away (${peck.prog.toFixed(1)})`);
  ok(peck.fled && peck.toast, 'then flees, with a toast naming the crop');

  // D. shoo counter → Crow Patrol at 5
  const patrol = await t(() => {
    updateCrow(3);                                        // finish the flee
    state.crowsShooed = 0;
    for (let i = 0; i < 5; i++) {
      spawnCrow();
      if (!crow) return { fail: 'no crow on round ' + i };
      shooCrow(true);
      updateCrow(3);
    }
    return { count: state.crowsShooed, ach: !!state.ach.crow5,
      toast: document.body.textContent.includes('Crow Patrol') };
  });
  ok(patrol.count === 5, `five taps counted (${patrol.count})`);
  ok(patrol.ach && patrol.toast, '🏆 Crow Patrol unlocks at 5');

  // E. winter gate
  const winter = await t(() => {
    state.day = 10;                                       // winter (3-day seasons)
    crowNextT = -5;
    updateCrow(0.5);
    const inWinter = crow === null;
    state.day = 1;                                        // spring
    crowNextT = -5;
    updateCrow(0.5);
    return { inWinter, inSpring: crow !== null };
  });
  ok(winter.inWinter, 'crows sit out the winter');
  ok(winter.inSpring, 'spring brings them back');

  // F. persistence
  await t(() => { shooCrow(false); updateCrow(3); save(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ count: state.crowsShooed, ach: !!state.ach.crow5 }));
  ok(back.count === 5 && back.ach, 'shoo counter + achievement survive reload');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/* VOX-19 — the Owl Roost (one-shot, classic-script globals).
 * A. The 🦉 roost in the shop (720 / lvl 8 / kind owl), the roost
 *    renders, Night Watch registered, the how-to bullet is in.
 * B. Daylight: a due timer never hunts.
 * C. A dry night hunt pays exactly 9 🪙 and ticks the tally; the
 *    timer re-arms 140–260s.
 * D. A wet night pays double: owlPay reads 18 wet, 9 dry.
 * E. Ten hunts crown Night Watch; the tally rides the save and a
 *    legacy save migrates clean.
 * Z. Zero page errors.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('voxowl-init')) {
      sessionStorage.setItem('voxowl-init', '1');
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, level: 10,
          buildings: { owlroost: { x: 8, z: 8 }, vane: { x: 4, z: 4 } }, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // Inspect through real rendered mesh hits; one evaluation keeps animation
  // frames from advancing the controlled clock between a tap and its snapshot.
  await page.waitForFunction(() => typeof doAction === 'function' && W.buildingMeshes.owlroost);
  const inspect = await t(() => {
    const snapshots = [];
    const snapshot = () => ({ coins: state.coins, catches: state.owlCatches, timer: owlNextT });
    const tap = (key = 'owlroost') => {
      const mesh = W.buildingMeshes[key];
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      const origin = box.getCenter(new THREE.Vector3());
      origin.y = box.max.y + 2;
      const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0];
      if (!hit || hit.object.userData.buildingKey !== key) throw new Error('Missing real building hit: ' + key);
      document.getElementById('toasts').replaceChildren();
      const before = snapshot();
      doAction(hit);
      snapshots.push({ before, after: snapshot() });
      return document.querySelector('#toasts .toast')?.textContent;
    };
    state.time = 0;
    delete state.owlCatches;
    owlNextT = 41.2;
    rainActive = false;
    const emptyDay = tap();
    state.owlCatches = 7;
    const day = tap();
    updateOwlRoost(10);
    const dayT = owlNextT;
    state.time = CYCLE * 0.95;
    const dry = tap();
    updateOwlRoost(10);
    const nightT = owlNextT, later = tap();
    rainActive = true;
    const wet = tap();
    const sibling = tap('vane');
    state.owlCatches = 0;
    return { emptyDay, day, dayT, dry, later, nightT, wet, sibling, snapshots,
      siblingExpected: BUILDINGS.vane.ico + ' ' + BUILDINGS.vane.name + ' — ' + BUILDINGS.vane.desc };
  });
  assert.equal(inspect.emptyDay, '🦉 Owl Roost — asleep till dusk (0 hunts)');
  assert.equal(inspect.day, '🦉 Owl Roost — asleep till dusk (7 hunts)');
  assert.doesNotMatch(inspect.day, /next hunt in|\d+\s*s\b/i);
  assert.equal(inspect.dayT, 41.2);
  assert.equal(inspect.dry, '🦉 Owl Roost — next hunt in 42s · 9 🪙');
  assert.equal(inspect.later, '🦉 Owl Roost — next hunt in 32s · 9 🪙');
  assert.equal(inspect.nightT, 41.2 - 10);
  assert.equal(inspect.wet, '🦉 Owl Roost — next hunt in 32s · 18 🪙');
  assert.equal(inspect.sibling, inspect.siblingExpected);
  for (const { before, after } of inspect.snapshots) assert.deepEqual(after, before);
  ok(true, 'real mesh inspect: asleep tally, advancing rounded-up ETA, wet/dry pay, daylight hold, unchanged taps and generic sibling');

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.owlroost;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: owlCubes(BUILDINGS.owlroost).length,
      ach: ACH.some(a => a[0] === 'owl10'),
      howto: document.body.innerHTML.includes('Owl Roost</b> (level 8)') };
  });
  ok(fresh.def && fresh.def.cost === 720 && fresh.def.lvl === 8 && fresh.def.kind === 'owl'
    && fresh.cubes >= 7, 'the 🦉 Owl Roost is in the shop (720 / lvl 8) and renders');
  ok(fresh.ach && fresh.howto, 'Night Watch registered; the how-to bullet is in');

  // B — daylight
  const asleep = await t(() => {
    state.buildings = state.buildings || {};
    state.buildings.owlroost = { x: 5, z: 5 };
    state.coins = 500;
    state.time = 0;                 // dawn — daylight
    rainActive = false;
    owlNextT = 0.01;
    updateOwlRoost(0.05);
    return { coins: state.coins, catches: state.owlCatches || 0, night: isNight() };
  });
  ok(!asleep.night && asleep.coins === 500 && asleep.catches === 0,
    'daylight — a due timer never hunts, the owl sleeps');

  // C — the dry night hunt
  const hunted = await t(() => {
    state.time = CYCLE * 0.95;      // deep night
    rainActive = false;
    owlNextT = 0.01;
    updateOwlRoost(0.05);
    return { night: isNight(), coins: state.coins, catches: state.owlCatches,
      timer: owlNextT, dry: owlPay() };
  });
  ok(hunted.night && hunted.dry === 9 && hunted.coins === 509 && hunted.catches === 1,
    'a dry night hunt pays exactly 9 🪙 and ticks the tally');
  ok(hunted.timer >= 140 && hunted.timer <= 260, 'the timer re-arms 140–260s');

  // D — the wet night
  const wet = await t(() => {
    rainActive = true;
    const w = owlPay();
    rainActive = false;
    return { wet: w, dry: owlPay() };
  });
  ok(wet.wet === 18 && wet.dry === 9, 'a wet night pays double (18 wet, 9 dry)');

  // E — the crown + persistence
  const crowned = await t(() => {
    state.owlCatches = 10;
    return ACH.find(a => a[0] === 'owl10')[3]();
  });
  ok(crowned, 'ten hunts crown Night Watch');
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ catches: state.owlCatches, built: owlBuilt() }));
  ok(back.catches === 10 && back.built, 'the tally and the roost ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.owlCatches; delete sv.state.buildings.owlroost;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ catches: state.owlCatches || 0, built: owlBuilt() }));
  ok(legacy.catches === 0 && !legacy.built, 'a pre-VOX-19 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

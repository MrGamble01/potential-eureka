/* Hook-free Ferry Landing inspection: real mesh hits, live decor tips and seasonal clocks. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, level: 10,
          coins: 500, ferryVisits: 2, day: 1,
          buildings: { ferry: { x: 8, z: 8 }, vane: { x: 4, z: 4 } }, goods: {} },
        edits: [], wet: [], islets: [],
        plants: [{ x: 2, y: 4, z: 2, type: 'lantern', prog: 0, stage: 0 }],
        animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof doAction === 'function' && W.buildingMeshes.ferry);
    const result = await page.evaluate(() => {
      const taps = [];
      const snapshot = () => ({ coins: state.coins, visits: state.ferryVisits, timer: ferryNextT });
      const tap = (key = 'ferry') => {
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
        taps.push({ before, after: snapshot() });
        return document.querySelector('#toasts .toast')?.textContent;
      };
      while (seasonOf(state.day).key === 'winter') state.day++;
      ferryNextT = 41.2;
      const before = snapshot();
      const firstPay = ferryPay(), first = tap();
      updateFerry(10);
      const later = tap(), greenT = ferryNextT;
      const decor = addPlant(3, 4, 2, 'gnome', true);
      const decoratedPay = ferryPay(), decorated = tap();
      removePlant(decor);
      const removed = tap();
      while (seasonOf(state.day).key !== 'winter') state.day++;
      updateFerry(10);
      const winter = tap(), winterT = ferryNextT;
      while (seasonOf(state.day).key === 'winter') state.day++;
      const resumed = tap();
      ferryNextT = -0.2;
      const due = tap();
      while (seasonOf(state.day).key !== 'winter') state.day++;
      updateFerry(10);
      const frozenDue = tap(), frozenDueT = ferryNextT;
      const sibling = tap('vane');
      const after = snapshot();
      while (seasonOf(state.day).key === 'winter') state.day++;
      updateFerry(0.1);
      const docked = snapshot();
      return { first, firstPay, later, greenT, decorated, decoratedPay, removed,
        winter, winterT, resumed, due, frozenDue, frozenDueT, sibling, taps, before, after, docked,
        siblingExpected: BUILDINGS.vane.ico + ' ' + BUILDINGS.vane.name + ' — ' + BUILDINGS.vane.desc };
    });
    assert.equal(result.firstPay, 10);
    assert.equal(result.first, '⛴️ Ferry Landing — next dock in 42s · tip 10 🪙');
    assert.equal(result.later, '⛴️ Ferry Landing — next dock in 32s · tip 10 🪙');
    assert.equal(result.greenT, 41.2 - 10);
    assert.equal(result.decoratedPay, 12);
    assert.equal(result.decorated, '⛴️ Ferry Landing — next dock in 32s · tip 12 🪙');
    assert.equal(result.removed, result.later);
    console.log('PASS real ferry mesh taps show rounded-up advancing seconds and live placed-decor tips');
    for (const text of [result.winter, result.frozenDue]) {
      assert.equal(text, '⛴️ Ferry Landing — frozen for winter');
      assert.doesNotMatch(text, /\d+\s*s\b|next dock|tip/i);
    }
    assert.equal(result.winterT, result.greenT);
    assert.equal(result.frozenDueT, -0.2);
    assert.equal(result.resumed, result.later);
    assert.equal(result.due, '⛴️ Ferry Landing — next dock in 0s · tip 10 🪙');
    console.log('PASS winter holds the clock, including a due crossing; thaw restores ETA and due taps clamp to zero');
    for (const tap of result.taps) assert.deepEqual(tap.after, tap.before);
    assert.equal(result.after.coins, result.before.coins);
    assert.equal(result.after.visits, result.before.visits);
    assert.equal(result.sibling, result.siblingExpected);
    assert.equal(result.docked.coins, result.after.coins + result.firstPay);
    assert.equal(result.docked.visits, result.after.visits + 1);
    assert.ok(result.docked.timer >= 120 && result.docked.timer <= 240);
    assert.deepEqual(errors, []);
    console.log('PASS taps preserve coins/visits/timer, sibling description stays generic, green docking still pays; no page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

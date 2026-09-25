/* Hook-free Balloon Tours taps: real mesh hits, live ETA and grounded weather. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
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
          buildings: { balloon: { x: 8, z: 8 }, vane: { x: 4, z: 4 } }, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof doAction === 'function' && W.buildingMeshes.balloon);
    const result = await page.evaluate(() => {
      const tap = (key = 'balloon') => {
        const mesh = W.buildingMeshes[key];
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        const origin = box.getCenter(new THREE.Vector3());
        origin.y = box.max.y + 2;
        const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0];
        if (!hit || hit.object.userData.buildingKey !== key) throw new Error('Missing real building hit: ' + key);
        document.getElementById('toasts').replaceChildren();
        doAction(hit);
        return document.querySelector('#toasts .toast')?.textContent;
      };
      rainActive = false;
      while (seasonOf(state.day).key === 'winter') state.day++;
      tourNextT = 41.2;
      const before = { coins: state.coins, tours: state.tours || 0 };
      const first = tap();
      const afterTap = tourNextT;
      updateTours(10);
      const later = tap();
      rainActive = true;
      updateTours(10);
      const rain = tap(), rainT = tourNextT;
      rainActive = false;
      while (seasonOf(state.day).key !== 'winter') state.day++;
      updateTours(10);
      const winter = tap(), winterT = tourNextT;
      while (seasonOf(state.day).key === 'winter') state.day++;
      const resumed = tap();
      const sibling = tap('vane');
      return { first, later, rain, winter, resumed, afterTap, rainT, winterT,
        before, after: { coins: state.coins, tours: state.tours || 0 }, sibling,
        siblingExpected: BUILDINGS.vane.ico + ' ' + BUILDINGS.vane.name + ' — ' + BUILDINGS.vane.desc };
    });
    assert.equal(result.first, '🎈 Balloon Tours — next tour in 42s');
    assert.equal(result.later, '🎈 Balloon Tours — next tour in 32s');
    assert.equal(result.afterTap, 41.2);
    console.log('PASS real balloon mesh taps show rounded-up, advancing tour seconds');
    for (const text of [result.rain, result.winter]) {
      assert.match(text, /^🎈 Balloon Tours — .*\b(grounded|lashed)\b/i);
      assert.doesNotMatch(text, /\d+\s*s\b|next tour in/i);
    }
    assert.equal(result.rainT, 41.2 - 10);
    assert.equal(result.winterT, result.rainT);
    assert.equal(result.resumed, result.later);
    console.log('PASS rain and winter name grounding, pause the clock and preserve the resumed ETA');
    assert.equal(result.sibling, result.siblingExpected);
    assert.deepEqual(result.after, result.before);
    assert.deepEqual(errors, []);
    console.log('PASS sibling description, coins and tour tally unchanged; no page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

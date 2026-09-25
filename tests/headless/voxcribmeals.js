/* Hook-free Corn Crib inspect: production save, rendered meshes and doAction. */
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
        state: { helpSeen: true, muted: true, musicOff: true, coins: 1234, level: 8,
          cribMeals: 0, buildings: { corncrib: { x: 6, z: 6 }, vane: { x: -6, z: 6 } }, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof doAction === 'function' &&
      W.buildingMeshes.corncrib && W.buildingMeshes.vane);
    const result = await page.evaluate(() => {
      const inspect = key => {
        const mesh = W.buildingMeshes[key];
        if (!scene.children.includes(mesh) || mesh.userData.buildingKey !== key)
          throw new Error('Missing real building mesh: ' + key);
        const before = { coins: state.coins, meals: state.cribMeals };
        document.getElementById('toasts').replaceChildren();
        doAction({ object: mesh, point: mesh.position.clone() });
        return { before, after: { coins: state.coins, meals: state.cribMeals },
          toast: document.querySelector('#toasts .toast')?.textContent };
      };
      // Keep each tap and snapshot atomic so ambient simulation cannot affect it.
      const zero = inspect('corncrib');
      state.cribMeals = 7;
      const live = inspect('corncrib');
      state.cribMeals = 12;
      const later = inspect('corncrib');
      const sibling = inspect('vane');
      delete state.cribMeals;
      const legacy = inspect('corncrib');
      const d = BUILDINGS.vane;
      return { zero, live, later, legacy, sibling, crib: CRIB_BITE, crow: CROW_BITE,
        generic: d.ico + ' ' + d.name + ' — ' + d.desc };
    });
    for (const [name, count] of [['zero', 0], ['live', 7], ['later', 12], ['legacy', 0]]) {
      const tap = result[name];
      assert.match(tap.toast, new RegExp('blunted ' + count + ' crow raids'));
      assert.ok(tap.toast.includes(result.crib + '× growth'));
      assert.ok(tap.toast.includes(result.crow + '×'));
      assert.match(tap.toast, /permanently softened/);
      if (!count) assert.match(tap.toast, /stands ready/);
      assert.deepEqual(tap.after, tap.before);
      console.log('PASS ' + name + ': live tally, permanent blunt and unchanged coins/meals');
    }
    assert.equal(result.crib, 0.15);
    assert.equal(result.crow, 0.35);
    assert.equal(result.sibling.toast, result.generic);
    assert.deepEqual(result.sibling.after, result.sibling.before);
    console.log('PASS sibling vane keeps generic description without spending');
    assert.deepEqual(errors, []);
    console.log('PASS no page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

/* Hook-free apiary inspection through real building mesh hits and doAction. */
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
        state: { helpSeen: true, muted: true, musicOff: true, coins: 100, level: 6,
          buildings: { apiary: { x: 5, z: 5 }, vane: { x: -5, z: -5 }, market: { x: 5, z: -5 } },
          goods: { honey: 3 } },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof doAction === 'function' && W.buildingMeshes.apiary && W.buildingMeshes.vane);
    const result = await page.evaluate(() => {
      // All snapshots and controlled updates run in one task, avoiding frame races.
      const snapshot = () => ({ honeyT, goods: { ...state.goods }, coins: state.coins });
      const tap = key => {
        const mesh = W.buildingMeshes[key];
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        const origin = box.getCenter(new THREE.Vector3());
        origin.y = box.max.y + 5;
        const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObject(mesh, false)[0];
        if (!hit || hit.object !== mesh) throw new Error('Missing real building hit: ' + key);
        document.getElementById('toasts').replaceChildren();
        const before = snapshot();
        doAction(hit);
        return { before, after: snapshot(), toast: document.querySelector('#toasts .toast')?.textContent };
      };
      honeyT = 9.2;
      state.goods.honey = 3;
      const initial = tap('apiary');
      const repeat = tap('apiary');
      updateApiary(1.4);
      const advanced = tap('apiary');
      state.goods.honey = 8;
      const live = tap('apiary');
      delete state.goods.honey;
      const empty = tap('apiary');
      delete state.buildings.market;
      const missing = tap('apiary');
      honeyT = 16.2;
      const due = tap('apiary');
      const sibling = tap('vane');
      const bd = BUILDINGS.vane;
      return { initial, repeat, advanced, live, empty, missing, due, sibling,
        siblingDesc: bd.ico + ' ' + bd.name + ' — ' + bd.desc };
    });
    for (const [name, tapped] of Object.entries(result)) {
      if (name !== 'siblingDesc') assert.deepEqual(tapped.after, tapped.before, name + ': tap preserves timer, goods and coins');
    }
    assert.equal(result.initial.toast, '🐝 Apiary — next comb in 7s · 3 🍯');
    assert.equal(result.repeat.toast, result.initial.toast);
    assert.equal(result.advanced.toast, '🐝 Apiary — next comb in 6s · 3 🍯');
    assert.ok(Math.abs(result.advanced.before.honeyT - 10.6) < 1e-9);
    assert.deepEqual(result.advanced.before.goods, result.initial.before.goods);
    assert.equal(result.advanced.before.coins, result.initial.before.coins);
    console.log('PASS rounded-up ETA advances with updateApiary; repeated mesh taps preserve timer, goods and coins');
    assert.equal(result.live.toast, '🐝 Apiary — next comb in 6s · 8 🍯');
    assert.equal(result.empty.toast, '🐝 Apiary — next comb in 6s · 0 🍯');
    assert.equal(result.missing.toast, '🐝 Apiary — next comb in 6s · 0 🍯 · no stockpiles; combs pay coins');
    assert.equal(result.due.toast, '🐝 Apiary — next comb in 0s · 0 🍯 · no stockpiles; combs pay coins');
    console.log('PASS live honey, zero fallback, missing stockpiles and nonnegative ETA');
    assert.equal(result.sibling.toast, result.siblingDesc);
    console.log('PASS vane keeps its generic description');
    assert.deepEqual(errors, []);
    console.log('PASS no page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

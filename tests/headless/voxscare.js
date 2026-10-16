/* Hook-free scarecrow inspection through production plant mesh hits. */
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
        state: { helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof actOnPlant === 'function' && W.blocks.size > 0);
    const result = await page.evaluate(() => {
      for (const p of [...W.plants.values()]) removePlant(p);
      const scare = addPlant(0, 8, 0, 'scarecrow');
      const near = addPlant(1, 8, 0, 'sunflower');
      const boundary = addPlant(6, 12, 0, 'carrot');
      boundary.stage = 1; // height does not change crow protection
      addPlant(4, 8, 4, 'tomato');
      const ripe = addPlant(2, 8, 0, 'pumpkin');
      ripe.stage = 2;
      addPlant(6, 8, 1, 'lavender'); // just outside the circle
      addPlant(20, 8, 20, 'carrot');
      const fence = addPlant(0, 8, 1, 'fence');
      const other = addPlant(20, 8, 19, 'scarecrow');
      const tap = (p, tool) => {
        state.tool = tool;
        document.getElementById('toasts').replaceChildren();
        let mesh;
        p.mesh.traverse(child => { if (child.userData.plantKey) mesh = child; });
        if (!mesh) throw new Error('Missing production plant hit mesh');
        doAction({ object: mesh });
        return document.getElementById('toasts').textContent;
      };
      const initial = tap(scare, state.tool);
      near.stage = 2;
      const live = tap(scare, 'water');
      const distant = tap(other, 'hoe');
      const silent = tap(fence, 'water');
      for (const p of [...W.plants.values()]) if (PLANTS[p.type]) removePlant(p);
      const empty = tap(scare, 'hoe');
      const intact = W.plants.get(k3(scare.x, scare.y, scare.z)) === scare;
      const pickedToast = tap(scare, 'pick');
      const removed = !W.plants.has(k3(scare.x, scare.y, scare.z));
      tap(fence, 'pick');
      return { initial, live, distant, silent, empty, intact, pickedToast, removed,
        fenceRemoved: !W.plants.has(k3(fence.x, fence.y, fence.z)) };
    });
    assert.deepEqual(errors, []);
    console.log('PASS no page errors');
    assert.equal(result.initial, '🎃 Guarding 3 crops within 6 blocks');
    console.log('PASS default mesh tap counts only growing crops within the inclusive horizontal radius');
    assert.equal(result.live, '🎃 Guarding 2 crops within 6 blocks');
    assert.equal(result.distant, '🎃 Guarding 1 crop within 6 blocks');
    assert.equal(result.empty, '🎃 Guarding 0 crops within 6 blocks');
    assert.equal(result.intact, true);
    console.log('PASS live, per-scarecrow and empty counts across non-pick tools');
    assert.equal(result.silent, '');
    assert.equal(result.pickedToast, '');
    assert.equal(result.removed, true);
    assert.equal(result.fenceRemoved, true);
    console.log('PASS other decor stays silent and pickaxe still removes decor');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

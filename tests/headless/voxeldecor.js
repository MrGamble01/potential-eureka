/* Decorations must render fully grown, including legacy stage-zero saves. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE + '/voxel-garden.html');
    await page.waitForFunction(() => typeof placeSelected === 'function' && typeof W !== 'undefined');
    const placed = await page.evaluate(() => {
      state.level = 99; state.coins = 10000;
      const positions = [];
      for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
        const y = surfaceY(x, z) + 1;
        if (getB(x, y - 1, z) && !getB(x, y, z) && !W.plants.has(k3(x, y, z))) positions.push([x, y, z]);
      }
      const results = Object.keys(DECOR).map(type => {
        const [x, y, z] = positions.pop();
        state.blockSel = type;
        placeSelected(x, y, z);
        const plant = W.plants.get(k3(x, y, z));
        return { type, stage: plant.stage, cubes: cubesFor(type, plant.stage, plant.vseed).length,
          expected: cubesFor(type, 2, plant.vseed).length };
      });
      const [x, y, z] = positions.pop();
      addPlant(x, y, z, Object.keys(PLANTS)[0]);
      save();
      const legacy = JSON.parse(localStorage.getItem(SAVE_KEY));
      legacy.plants.forEach(p => { if (DECOR[p.type]) p.stage = 0; });
      legacy.savedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(legacy));
      return results;
    });
    for (const p of placed) {
      assert.equal(p.stage, 2, `${p.type}: placed at full size`);
      assert.equal(p.cubes, p.expected, `${p.type}: correct model`);
    }
    await page.reload();
    const restored = await page.evaluate(() => [...W.plants.values()].map(p => ({
      type: p.type, stage: p.stage, decor: !!DECOR[p.type]
    })));
    assert.equal(restored.filter(p => p.decor).length, placed.length);
    assert.ok(restored.filter(p => p.decor).every(p => p.stage === 2), 'legacy decorations heal');
    assert.ok(restored.some(p => !p.decor && p.stage === 0), 'new crops still begin as seedlings');
    assert.deepEqual(errors, []);
    console.log(`PASS ${placed.length} decoration models, legacy saves, crop seedlings, no page errors`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

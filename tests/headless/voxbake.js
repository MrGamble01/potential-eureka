/* Hook-free bakery taps: live ETA/stock, windmill yield, and an empty oven, without baking. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const width of [1280, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(() => {
        localStorage.setItem('voxel-garden-v1', JSON.stringify({
          v: 1, seed: 1, savedAt: Date.now(),
          state: { helpSeen: true, muted: true, musicOff: true, coins: 100,
            level: 8, buildings: { bakery: { x: 4, z: 4 } },
            goods: { crop: 6, bread: 4 }, loaves: 11 },
          edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
        }));
      });
      await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof doAction === 'function' && W.buildingMeshes.bakery && typeof reportBakery === 'function');
      const reports = await page.evaluate(() => {
        // Seed and tap atomically so animation frames cannot change the snapshot.
        // Use the real building mesh and production action; no injected game hooks.
        const snapshot = () => ({ state: JSON.stringify(state), bakeT, bakeMsgT });
        const tap = (crops, timer, mill) => {
          if (crops === null) delete state.goods.crop;
          else state.goods.crop = crops;
          state.goods.bread = 4;
          state.loaves = 11;
          if (mill) state.buildings.windmill = { x: 8, z: 2 };
          else delete state.buildings.windmill;
          bakeT = timer;
          const before = snapshot();
          document.getElementById('toasts').replaceChildren();
          doAction({ object: W.buildingMeshes.bakery });
          return { before, after: snapshot(),
            toasts: [...document.querySelectorAll('#toasts .toast')].map(el => el.textContent) };
        };
        return [
          tap(6, 4.25, false),
          tap(6, 8.2, false),
          tap(6, 0, false),
          tap(0, 3, false),
          tap(null, 3, false),
          tap(6, 1.2, true),
          tap(6, 5.1, true),
          tap(0, 2, true),
          tap(6, 5.5, true),
        ];
      });
      for (const report of reports) {
        assert.deepEqual(report.after, report.before, 'tap leaves all state and baking timers unchanged');
        assert.equal(report.toasts.length, 1, 'one clear toast per tap');
      }
      for (const [index, eta] of [[0, 5], [1, 1], [2, 9]]) {
        assert.match(reports[index].toasts[0], new RegExp(`Next loaf in ${eta}s`));
        assert.match(reports[index].toasts[0], /🌾 Crops remaining 6/);
        assert.match(reports[index].toasts[0], /Bread on hand 4/);
        assert.doesNotMatch(reports[index].toasts[0], /Windmill|2 loaves/);
      }
      for (const report of reports.slice(3, 5)) {
        assert.match(report.toasts[0], /🥖 The oven waits for crops/);
        assert.match(report.toasts[0], /Crop stock 0/);
        assert.match(report.toasts[0], /Bread on hand 4/);
        assert.doesNotMatch(report.toasts[0], /Windmill ready/);
      }
      for (const [index, eta] of [[5, 5], [6, 1]]) {
        assert.match(reports[index].toasts[0], new RegExp(`Next bake \\(2 loaves\\) in ${eta}s`));
        assert.match(reports[index].toasts[0], /🌾 Crops remaining 6/);
        assert.match(reports[index].toasts[0], /Bread on hand 4/);
      }
      assert.match(reports[7].toasts[0], /The oven waits for crops/);
      assert.match(reports[7].toasts[0], /Crop stock 0/);
      assert.match(reports[7].toasts[0], /Windmill ready/);
      assert.match(reports[8].toasts[0], /The windmill bake \(2 loaves\) is ready/);
      assert.match(reports[8].toasts[0], /🌾 Crops remaining 6/);
      assert.match(reports[8].toasts[0], /Bread on hand 4/);
      assert.deepEqual(errors, [], 'zero page errors');
      console.log(`PASS ${width}px: rounded-up ETA, crop/bread stock, windmill yield, empty/missing crops, read-only taps, zero page errors`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

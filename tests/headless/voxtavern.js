/* Hook-free tavern taps: live next-meal ETA, next good, stock, and villager pace, without serving. */
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
            level: 8, buildings: { tavern: { x: 4, z: 4 } },
            goods: { crop: 6, bread: 4 }, meals: 11 },
          edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
        }));
      });
      await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof doAction === 'function' && W.buildingMeshes.tavern && typeof reportTavern === 'function');
      const reports = await page.evaluate(() => {
        // Seed and tap atomically so animation frames cannot change the snapshot.
        // Use the real building mesh, villager spawn, and production action.
        const setCrew = (n) => {
          while (W.workers.length < n) spawnWorker('all', 'Ada', 2, 2);
          while (W.workers.length > n) {
            const w = W.workers.pop();
            if (w.mesh) { scene.remove(w.mesh); w.mesh.geometry.dispose(); }
          }
        };
        const snapshot = () => ({ state: JSON.stringify(state), tavernT, mealMsgT, crew: W.workers.length });
        const tap = (goods, timer, crew) => {
          state.goods = goods;
          state.meals = 11;
          state.coins = 100;
          setCrew(crew);
          tavernT = timer;
          mealMsgT = 9;
          const before = snapshot();
          document.getElementById('toasts').replaceChildren();
          doAction({ object: W.buildingMeshes.tavern });
          return { before, after: snapshot(),
            toasts: [...document.querySelectorAll('#toasts .toast')].map(el => el.textContent) };
        };
        return [
          tap({ crop: 6, bread: 4 }, 4.25, 0),
          tap({ crop: 6, bread: 4 }, 13.2, 0),
          tap({ crop: 6, bread: 4 }, 0, 0),
          tap({ crop: 2, bread: 8 }, 14, 0),
          tap({ crop: 0, bread: 0 }, 3, 0),
          tap({}, 3, 0),
          tap({ chicken: 4, bread: 4 }, 6, 0),
          tap({ crop: 6, bread: 4 }, 7.2, 1),
          tap({ crop: 6, bread: 4 }, 12.1, 1),
          tap({ crop: 6, bread: 4 }, 12.5, 1),
          tap({ crop: 0 }, 2, 1),
          tap({ crop: 5, bread: 9 }, 6.1, 2),
          tap({ crop: 6, bread: 4 }, 20, 0),
        ];
      });
      for (const report of reports) {
        assert.deepEqual(report.after, report.before, 'tap leaves stock, meals, coins, timer and crew unchanged');
        assert.equal(report.toasts.length, 1, 'one clear toast per tap');
        assert.doesNotMatch(report.toasts[0], /Villager roles/);
      }
      for (const [index, eta] of [[0, 10], [1, 1], [2, 14]]) {
        assert.match(reports[index].toasts[0], new RegExp('Next meal in ' + eta + 's'));
        assert.match(reports[index].toasts[0], /🌾 next/);
        assert.match(reports[index].toasts[0], /Goods remaining 10/);
        assert.match(reports[index].toasts[0], /Meals served 11/);
        assert.doesNotMatch(reports[index].toasts[0], /villager/);
      }
      assert.match(reports[3].toasts[0], /The next meal is ready/);
      assert.match(reports[3].toasts[0], /🍞 next/);
      assert.match(reports[3].toasts[0], /Goods remaining 10/);
      assert.match(reports[3].toasts[0], /Meals served 11/);
      for (const report of reports.slice(4, 6)) {
        assert.match(report.toasts[0], /🍺 The kitchen waits for goods/);
        assert.match(report.toasts[0], /Goods stock 0/);
        assert.match(report.toasts[0], /Meals served 11/);
        assert.doesNotMatch(report.toasts[0], /next|villager/);
      }
      assert.match(reports[6].toasts[0], /Next meal in 8s/);
      assert.match(reports[6].toasts[0], /🥚 next/);
      assert.match(reports[6].toasts[0], /Goods remaining 8/);
      for (const [index, eta] of [[7, 6], [8, 1]]) {
        assert.match(reports[index].toasts[0], new RegExp('Next meal in ' + eta + 's'));
        assert.match(reports[index].toasts[0], /🌾 next/);
        assert.match(reports[index].toasts[0], /Goods remaining 10/);
        assert.match(reports[index].toasts[0], /1 villager at the tables/);
      }
      assert.match(reports[9].toasts[0], /The next meal is ready/);
      assert.match(reports[9].toasts[0], /🌾 next/);
      assert.match(reports[9].toasts[0], /1 villager at the tables/);
      assert.match(reports[10].toasts[0], /The kitchen waits for goods/);
      assert.match(reports[10].toasts[0], /Goods stock 0/);
      assert.match(reports[10].toasts[0], /1 villager at the tables/);
      assert.match(reports[11].toasts[0], /Next meal in 6s/);
      assert.match(reports[11].toasts[0], /🍞 next/);
      assert.match(reports[11].toasts[0], /Goods remaining 14/);
      assert.match(reports[11].toasts[0], /2 villagers at the tables/);
      assert.match(reports[12].toasts[0], /The next meal is ready/);
      assert.match(reports[12].toasts[0], /🌾 next/);
      assert.doesNotMatch(reports[12].toasts[0], /villager/);
      assert.deepEqual(errors, [], 'zero page errors');
      console.log(`PASS ${width}px: rounded-up ETA, next good, stock, meals, villager tables, empty kitchen, read-only taps, zero page errors`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

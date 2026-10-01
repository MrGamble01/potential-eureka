/* Hook-free brewery taps: live ETA/stock and an empty still, without brewing. */
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
            level: 8, buildings: { brewery: { x: 4, z: 4 } },
            goods: { honey: 5, mead: 3 }, meads: 9 },
          edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
        }));
      });
      await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof doAction === 'function' && W.buildingMeshes.brewery);
      const reports = await page.evaluate(() => {
        // Seed and tap atomically so animation frames cannot change the snapshot.
        // Use the real building mesh and production action; no injected game hooks.
        const snapshot = () => ({ state: JSON.stringify(state), brewT, brewMsgT });
        const tap = (honey, timer) => {
          if (honey === null) delete state.goods.honey;
          else state.goods.honey = honey;
          state.goods.mead = 3;
          state.meads = 9;
          brewT = timer;
          const before = snapshot();
          document.getElementById('toasts').replaceChildren();
          doAction({ object: W.buildingMeshes.brewery });
          return { before, after: snapshot(),
            toasts: [...document.querySelectorAll('#toasts .toast')].map(el => el.textContent) };
        };
        return [tap(5, 4.25), tap(5, 11.8), tap(0, 4.25), tap(null, 4.25)];
      });
      for (const report of reports) {
        assert.deepEqual(report.after, report.before, 'tap leaves all state and brewing timers unchanged');
        assert.equal(report.toasts.length, 1, 'one clear toast per tap');
      }
      for (const [index, eta] of [[0, 8], [1, 1]]) {
        assert.match(reports[index].toasts[0], new RegExp(`Next mead bottle in ${eta}s`));
        assert.match(reports[index].toasts[0], /🍯 Honey remaining 5/);
        assert.match(reports[index].toasts[0], /Mead on hand 3/);
      }
      for (const report of reports.slice(2)) {
        assert.match(report.toasts[0], /🍶 The still waits for honey/);
        assert.match(report.toasts[0], /Honey stock 0/);
        assert.match(report.toasts[0], /Mead on hand 3/);
      }
      assert.deepEqual(errors, [], 'zero page errors');
      console.log(`PASS ${width}px: rounded-up ETA, honey/mead stock, empty/missing honey, read-only taps, zero page errors`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

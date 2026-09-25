/* Hook-free Sugar Shack report: session seed, frozen clock, real canvas taps. */
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
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(() => {
        if (sessionStorage.getItem('voxsugar-seeded')) return;
        sessionStorage.setItem('voxsugar-seeded', '1');
        localStorage.setItem('voxel-garden-v1', JSON.stringify({
          v: 1, seed: 1, savedAt: Date.now(),
          state: { helpSeen: true, muted: true, musicOff: true, coins: 100, level: 7,
            day: 1, sapBoils: 3, buildings: { sugarshack: { x: 5, z: 5 } }, goods: {} },
          edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
        }));
      });
      await page.clock.install();
      await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof W !== 'undefined' && W.buildingMeshes.sugarshack);
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      await page.clock.runFor(1000);
      const point = await page.evaluate(() => {
        const mesh = W.buildingMeshes.sugarshack;
        const box = new THREE.Box3().setFromObject(mesh);
        // Find a visible part of the real shack with no HUD intercepting the click.
        for (let fy = 0.8; fy >= 0.2; fy -= 0.15) {
          for (let fx = 0.2; fx <= 0.8; fx += 0.15) {
            const p = new THREE.Vector3(box.min.x + fx * (box.max.x - box.min.x),
              box.min.y + fy * (box.max.y - box.min.y), (box.min.z + box.max.z) / 2).project(camera);
            const x = (p.x + 1) * innerWidth / 2, y = (1 - p.y) * innerHeight / 2;
            if (document.elementFromPoint(x, y) === renderer.domElement &&
                raycastAt(x, y)?.object === mesh) return { x, y };
          }
        }
        throw new Error('No visible sugar shack canvas target');
      });
      const snapshot = () => page.evaluate(() => ({ timer: sugarNextT, coins: state.coins,
        boils: state.sapBoils, goods: { ...state.goods } }));
      async function tap() {
        await page.evaluate(() => document.getElementById('toasts').replaceChildren());
        const before = await snapshot();
        await page.mouse.click(point.x, point.y);
        const toast = await page.locator('#toasts .toast').last().textContent();
        assert.deepEqual(await snapshot(), before, 'tap preserves timer, coins, boils and goods');
        return toast;
      }
      await page.evaluate(() => { state.day = 1; sugarNextT = 42.2; rainActive = false; });
      const dry = await tap();
      assert.match(dry, /🍁.*43s.*12.*dry.*24.*rain.*3 boils so far/);
      assert.equal(await tap(), dry, 'repeat tap stays read-only');
      await page.evaluate(() => { rainActive = true; sugarNextT = 9.1; });
      assert.match(await tap(), /10s.*24.*wet.*rain doubles.*3 boils so far/);
      for (const [day, season] of [[4, 'Summer'], [7, 'Autumn'], [10, 'Winter']]) {
        await page.evaluate(day => { state.day = day; }, day);
        assert.match(await tap(), new RegExp(season + '.*sap sleeps until spring'));
      }
      await page.evaluate(() => { state.day = 1; sugarNextT = -0.1; state.sapBoils = 0; });
      assert.match(await tap(), /0s.*0 boils so far/);
      await page.evaluate(() => { delete state.buildings.sugarshack; });
      assert.match(await tap(), /🍁 Build a Sugar Shack/);
      assert.deepEqual(errors, [], 'zero page errors');
      console.log(`PASS ${width}: spring ETA, dry/wet pay, lifetime tally, all sleeping seasons, due/unbuilt edges, read-only repeated canvas taps, zero page errors`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

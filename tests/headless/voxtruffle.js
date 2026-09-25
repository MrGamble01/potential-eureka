/* Hook-free Truffle Pig tap reports, using the production mesh and doAction. */
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
        localStorage.setItem('voxel-garden-v1', JSON.stringify({
          v: 1, seed: 1, savedAt: Date.now(),
          state: { helpSeen: true, muted: true, musicOff: true, coins: 500, level: 9,
            truffles: 7, buildings: { trufflepig: { x: 6, z: 6 } }, goods: {} },
          edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
        }));
      });
      await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof doAction === 'function' && !!W.buildingMeshes.trufflepig);
      // Seed weather and tap synchronously: no animation tick can award a truffle
      // between our before/after snapshots. No game hooks or replaced functions.
      const results = await page.evaluate(() => {
        const mesh = W.buildingMeshes.trufflepig;
        const snapshot = () => JSON.stringify({ state, rainActive, pigWasRaining, rainLeft, rainT });
        const tap = () => {
          document.getElementById('toasts').replaceChildren();
          const before = snapshot();
          doAction({ object: mesh });
          doAction({ object: mesh });
          return { before, after: snapshot(), toasts: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent) };
        };
        rainActive = true;
        pigWasRaining = true;
        const wet = tap();
        rainActive = false;
        const dry = tap(); // pending rain-lift reward must remain pending
        delete state.truffles;
        const legacy = tap();
        delete state.buildings.trufflepig;
        const absent = tap();
        return { wet, dry, legacy, absent };
      });
      for (const [name, result] of Object.entries(results)) {
        assert.equal(result.after, result.before, `${width} ${name}: taps are read-only`);
        assert.equal(result.toasts.length, 2, `${width} ${name}: one toast per tap`);
        assert.equal(result.toasts[0], result.toasts[1]);
        assert.match(result.toasts[0], /^🐖/u);
      }
      assert.match(results.wet.toasts[0], /waiting.*shower.*rain lifts.*20 🪙/u);
      assert.match(results.dry.toasts[0], /Ready for the next shower.*Lifetime truffles: 7/u);
      assert.match(results.legacy.toasts[0], /Ready for the next shower.*Lifetime truffles: 0/u);
      assert.match(results.absent.toasts[0], /Build.*first/u);
      assert.deepEqual(errors, [], `${width}: zero page errors`);
      console.log(`PASS ${width}px: wet, dry, missing tally, absent pig; one toast per tap; unchanged state/weather; zero page errors`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

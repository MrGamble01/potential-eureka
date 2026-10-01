/* Hook-free placement: occupied blocks explain refusal without charging twice. */
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
        state: { helpSeen: true, muted: true, musicOff: true, coins: 100, level: 2, buildings: {}, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof placeSelected === 'function' && W.blocks.size > 0);
    const result = await page.evaluate(() => {
      // Find real ground with empty air above it; use only production functions.
      const ground = [...W.blocks.keys()].map(k => k.split(',').map(Number)).find(([x, y, z]) =>
        Math.abs(x) < 10 && Math.abs(z) < 10 && y < 24 &&
        !getB(x, y + 1, z) && !W.plants.has(k3(x, y + 1, z)));
      if (!ground) throw new Error('No clear ground found');
      const [x, gy, z] = ground, y = gy + 1;
      const snapshot = () => ({ block: getB(x, y, z), coins: state.coins, decor: state.decor,
        plants: W.plants.size });
      const refuse = () => {
        document.getElementById('toasts').replaceChildren();
        placeSelected(x, y, z);
        return { ...snapshot(), toast: document.querySelector('#toasts .toast')?.textContent };
      };
      state.blockSel = 2;
      const before = snapshot();
      placeSelected(x, y, z);
      const first = snapshot();
      const second = refuse();
      state.blockSel = 'fence';
      const decorRefuse = refuse();
      // A clear cell atop the new block still accepts decor normally.
      placeSelected(x, y + 1, z);
      const placedDecor = { type: W.plants.get(k3(x, y + 1, z))?.type,
        coins: state.coins, decor: state.decor };
      document.getElementById('toasts').replaceChildren();
      state.blockSel = 2;
      placeSelected(x, y + 1, z);
      const plantRefuse = { type: W.plants.get(k3(x, y + 1, z))?.type,
        block: getB(x, y + 1, z), coins: state.coins, decor: state.decor,
        toast: document.querySelector('#toasts .toast')?.textContent };
      return { before, first, second, decorRefuse, placedDecor, plantRefuse,
        blockCost: BLOCKS[2].cost, decorCost: DECOR.fence.cost };
    });
    const { before, first, second, decorRefuse, placedDecor, plantRefuse } = result;
    assert.equal(before.block, 0);
    assert.deepEqual(first, { ...before, block: 2, coins: before.coins - result.blockCost, decor: before.decor + 1 });
    console.log('PASS first block places and charges once');
    for (const refused of [second, decorRefuse]) {
      assert.equal(refused.toast, 'Something is in the way');
      const { toast, ...unchanged } = refused;
      assert.deepEqual(unchanged, first);
    }
    console.log('PASS occupied block refuses block and decor with a toast and no changes');
    assert.deepEqual(placedDecor, { type: 'fence', coins: first.coins - result.decorCost, decor: first.decor + 1 });
    assert.deepEqual(plantRefuse, { ...placedDecor, block: 0, toast: 'Something is in the way' });
    console.log('PASS successful decor and existing plant refusal stay intact');
    assert.deepEqual(errors, []);
    console.log('PASS no page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

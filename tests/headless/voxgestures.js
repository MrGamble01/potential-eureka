/* Voxel Isle: camera gestures and cancelled touches must never use a tool.
 * Dispatch browser PointerEvents through the real canvas handlers; inspect
 * actual terrain/till totals, without replacing raycasting or doAction.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html');
    await page.waitForTimeout(1500);
    await page.locator('[data-tool="hoe"]').click();
    const results = await page.evaluate(() => {
      const cv = renderer.domElement;
      const out = [];
      for (const kind of ['tap', 'cancel', 'pinch-first', 'pinch-second', 'pinch-cancel', 'drag', 'tap-after']) {
        // Find visible, bare soil using production picking. No fixed camera assumptions.
        let target;
        for (let y = 180; y < innerHeight - 180 && !target; y += 8) {
          for (let x = 24; x < innerWidth - 24; x += 8) {
            const hit = raycastAt(x, y);
            if (!hit || !hit.object.userData.isTerrain) continue;
            const cell = cellFromHit(hit, true);
            const [bx, by, bz] = cell;
            if ([1, 2].includes(getB(...cell)) && !getB(bx, by + 1, bz)) {
              target = { x, y, cell }; break;
            }
          }
        }
        if (!target) throw new Error('No visible soil for ' + kind);
        const { x, y, cell } = target;
        const emit = (type, id, px = x, py = y) => cv.dispatchEvent(new PointerEvent(type, {
          bubbles: true, pointerId: id, pointerType: 'touch', clientX: px, clientY: py,
        }));
        const before = state.tills;
        const block = getB(...cell);
        emit('pointerdown', 1);
        if (kind.startsWith('pinch')) {
          emit('pointerdown', 2, x + 30, y);
          const distance = cam.tdist;
          emit('pointermove', 2, x + 60, y);
          out.push({ kind: kind + '-zoom', passed: cam.tdist !== distance });
          // Keep each case away from the zoom clamp.
          cam.tdist = distance;
          const first = kind === 'pinch-second' ? 2 : 1;
          emit(kind === 'pinch-cancel' ? 'pointercancel' : 'pointerup', first);
          emit('pointermove', first === 1 ? 2 : 1, x + 1, y);
          emit('pointerup', first === 1 ? 2 : 1);
        } else {
          if (kind === 'drag') emit('pointermove', 1, x + 20, y);
          emit(kind === 'cancel' ? 'pointercancel' : 'pointerup', 1);
        }
        const tap = kind === 'tap' || kind === 'tap-after';
        out.push({ kind, passed: tap
          ? state.tills === before + 1 && getB(...cell) === 5
          : state.tills === before && getB(...cell) === block });
      }
      return out;
    });
    for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.kind}`);
    assert.ok(results.every(r => r.passed), 'gestures preserve terrain; deliberate taps till it');
    assert.deepEqual(errors, [], 'zero page errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

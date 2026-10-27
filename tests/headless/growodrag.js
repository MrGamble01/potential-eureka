/*
 * Drag pans the map. A twitch under 6px does not. A drag does not tap a lot.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8124';

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.setDefaultTimeout(20000);
    await page.addInitScript(() => localStorage.removeItem('growop-cartel-v1'));
    await page.goto(BASE + '/games/grow-op/index.html', { waitUntil: 'load' });
    await page.locator('#btn-start-operation').click();
    await page.evaluate(() => window.__growOp.frameValley());
    await page.waitForTimeout(500);
    const read = () => page.evaluate(() => {
      const scene = window.__growOp.scene();
      const cam = scene.cameras.main;
      return { x: cam.scrollX, y: cam.scrollY, slot: scene.sim.state.selectedSlotId || '' };
    });
    const before = await read();
    const box = await page.locator('#phaser-mount canvas').boundingBox();
    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.42;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 4, cy + 1, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(80);
    const twitch = await read();
    ok(Math.hypot(twitch.x - before.x, twitch.y - before.y) < 3, 'sub-6px move does not pan');

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(80);
    const dragged = await read();
    ok(Math.hypot(dragged.x - twitch.x, dragged.y - twitch.y) > 8, 'drag pans the map');
    ok(dragged.slot === twitch.slot, 'drag does not tap a lot');

    const spot = await page.evaluate(() => {
      const scene = window.__growOp.scene();
      return scene.worldToScreen(scene.slots.slot_rp_farm1.def.x, scene.slots.slot_rp_farm1.def.y);
    });
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(200);
    const tapped = await page.evaluate(() => ({
      slot: window.__growOp.sim.state.selectedSlotId,
      card: !document.getElementById('lot-card').hidden,
    }));
    ok(tapped.slot === 'slot_rp_farm1' && tapped.card, 'tap opens the plantation panel');
  } catch (err) {
    ok(false, String(err && err.message || err).split('\n')[0]);
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();

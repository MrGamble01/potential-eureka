/* Held camera keys must stop on window blur, even when keyup is lost.
 * Observe the real minimap pixels: no camera exports or source rewriting.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  try {
    for (const width of [1280, 768]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(() => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 1, time: 8, seenIntro: true, muted: true,
          townName: 'Camera keys', res: { wood: 40, stone: 20, food: 30, gold: 25 },
          villagers: [], buildings: [],
        }));
      });
      await page.goto(BASE + '/hearthvale.html');
      // The camera intentionally works while paused; freeze other minimap motion.
      await page.keyboard.press('Space');
      // Minimap redraws every 250 ms; allow a full refresh after each input.
      const pixels = () => page.locator('#minimap').evaluate(canvas => canvas.toDataURL());
      const mini = await page.locator('#minimap').boundingBox();
      for (const key of ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
        await page.mouse.click(mini.x + mini.width / 2, mini.y + mini.height / 2);
        await page.waitForTimeout(400);
        const before = await pixels();
        await page.keyboard.down(key);
        await page.waitForTimeout(400);
        ok(await pixels() !== before, `${width} ${key}: held key pans the viewport`);
        // Model leaving the window while held, then releasing outside it: no keyup.
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await page.waitForTimeout(400);
        const blurred = await pixels();
        await page.waitForTimeout(350);
        ok(await pixels() === blurred, `${width} ${key}: lost keyup after blur leaves the camera still`);
        await page.keyboard.up(key);
      }
      await page.mouse.click(mini.x + mini.width / 2, mini.y + mini.height / 2);
      await page.waitForTimeout(400);
      const before = await pixels();
      await page.keyboard.down('d');
      await page.waitForTimeout(400);
      ok(await pixels() !== before, `${width}: a fresh press still pans after blur`);
      await page.keyboard.up('d');
      await page.waitForTimeout(400);
      const released = await pixels();
      await page.waitForTimeout(350);
      ok(await pixels() === released, `${width}: normal keyup still stops panning`);
      await context.close();
    }
    ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  } finally { await browser.close(); }
  console.log(`${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });

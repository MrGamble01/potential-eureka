/* Hearthvale construction inspector: real clicks and supported saves, no hooks.
 * Keep the selected site open while it builds; completion must replace Cancel
 * with the finished building's actions without requiring another selection.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  for (const width of [1280, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      localStorage.setItem('hearthvale-v1', JSON.stringify({
        seed: 12345, day: 1, time: 8, seenIntro: true, muted: true,
        townName: 'Builders', _nextId: 2,
        res: { wood: 40, stone: 20, food: 30, gold: 25 }, villagers: [],
        buildings: [{ id: 1, type: 'farm', tx: 28, ty: 21,
          done: false, buildTotal: 30, buildLeft: 15 }],
      }));
    });
    await page.goto(BASE + '/hearthvale.html');
    const mini = await page.locator('#minimap').boundingBox();
    await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
    await page.mouse.click(width / 2, 450);
    ok(await page.locator('#p-sub').textContent() === 'Under construction', `${width}: click selects the construction site`);
    const percent = async () => {
      const text = await page.locator('#p-stats').textContent();
      return Number((text.match(/(\d+)%/) || [])[1]);
    };
    const initial = await percent();
    const cancel = await page.locator('#p-demolish').elementHandle();
    await page.waitForTimeout(1200);
    ok(await percent() > initial, `${width}: progress advances while the inspector stays open`);
    ok(await cancel.evaluate(el => el.isConnected), `${width}: progress updates preserve the Cancel control`);
    await page.waitForTimeout(5500);
    ok(await page.locator('#p-sub').textContent() !== 'Under construction' &&
      await page.locator('#p-demolish').textContent() === 'Remove' &&
      await page.locator('#p-upgrade').count() === 1,
      `${width}: completion replaces stale Cancel with finished building actions`);
    ok(await page.locator('#panel').evaluate(el => el.classList.contains('show')),
      `${width}: completion keeps the inspector open`);
    if (await page.locator('#p-upgrade').count()) await page.click('#p-upgrade');
    ok(/Lv2/.test(await page.locator('#p-name').textContent()), `${width}: newly available Upgrade works`);
    // Reload the seeded site and cancel it before completion.
    await page.reload();
    const again = await page.locator('#minimap').boundingBox();
    await page.mouse.click(again.x + again.width * 28.5 / 56, again.y + again.height * 21.5 / 42);
    await page.mouse.click(width / 2, 450);
    await page.click('#p-demolish');
    const cancelled = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
    ok(cancelled.buildings.length === 0 && cancelled.res.wood === 50,
      `${width}: cancelling an unfinished site still returns all materials`);
    await page.waitForTimeout(6500);
    ok(!(await page.locator('#panel').evaluate(el => el.classList.contains('show'))),
      `${width}: a cancelled site never reopens its inspector`);
    await context.close();
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

/* Hearthvale windmill lift: supported saves + real clicks, no game hooks. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  for (const width of [1280, 768]) {
    for (const scenario of ['empty', 'one', 'two', 'live']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(scenario => {
        const buildings = [
          { id: 1, type: 'windmill', tx: 28, ty: 21, done: true },
          // Just outside this mill's range; another mill's farm is also excluded.
          { id: 2, type: 'farm', tx: 33, ty: 21, done: true },
          { id: 3, type: 'windmill', tx: 40, ty: 21, done: true },
          { id: 4, type: 'farm', tx: 42, ty: 21, done: true },
          { id: 5, type: 'farm', tx: 28, ty: 24, done: false, buildTotal: 9999, buildLeft: 9999 },
        ];
        // Centre offset (4.5, 4): inclusive boundary AND Chebyshev, not radial.
        if (scenario !== 'empty') buildings.push({ id: 6, type: 'farm', tx: 32, ty: 25, done: true });
        if (scenario === 'two' || scenario === 'live') buildings.push({
          id: 7, type: 'farm', tx: 24, ty: 18, done: scenario === 'two', buildTotal: 30, buildLeft: 15,
        });
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 1, time: 8, seenIntro: true, muted: true,
          townName: 'Windward', _nextId: 8,
          res: { wood: 40, stone: 20, food: 30, gold: 25 }, villagers: [], buildings,
        }));
      }, scenario);
      await page.goto(BASE + '/hearthvale.html');
      const select = async (tx, ty) => {
        const mini = await page.locator('#minimap').boundingBox();
        await page.mouse.click(mini.x + mini.width * (tx + 0.5) / 56,
          mini.y + mini.height * (ty + 0.5) / 42);
        await page.mouse.click(width / 2, 450);
      };
      await select(28, 21);
      const report = page.locator('#p-windmill');
      const count = scenario === 'empty' ? 0 : scenario === 'two' ? 2 : 1;
      const expected = count ? `🌬️ Lifts ${count} farm${count === 1 ? '' : 's'} nearby (+50% food)`
        : '🌬️ No farms in range yet (+50% food when a Farm is close)';
      ok(await report.textContent() === expected, `${width} ${scenario}: correct finished-farm count and +50% reminder`);
      const stats = await page.locator('#p-stats').textContent();
      ok(['Worker', 'Produces', 'Consumes'].every(label => stats.includes(label)),
        `${width} ${scenario}: existing production and worker rows remain`);
      if (scenario === 'live') {
        const span = await report.elementHandle();
        await page.waitForFunction(() => document.getElementById('p-windmill')?.textContent ===
          '🌬️ Lifts 2 farms nearby (+50% food)', null, { timeout: 15000 });
        ok(await span.evaluate(el => el.isConnected), `${width}: construction updates the open panel in place`);
        await page.keyboard.press('Escape');
        await select(24, 18);
        ok(await page.locator('#p-name').textContent() === 'Farm', `${width}: select completed farm for removal`);
        await page.click('#p-demolish');
        await select(28, 21);
        ok(await report.textContent() === '🌬️ Lifts 1 farm nearby (+50% food)',
          `${width}: reopening after removal recomputes the count`);
      }
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `zero page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

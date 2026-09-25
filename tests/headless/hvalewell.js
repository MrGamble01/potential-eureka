/* Hearthvale well wish panel: supported saves + real clicks, no game hooks. */
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
    for (const scenario of ['first', 'returning', 'dawn']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(scenario => {
        const save = {
          seed: 12345, day: 1, time: scenario === 'dawn' ? 22 : 8,
          seenIntro: true, muted: true, townName: 'Wishing Well', _nextId: 2,
          res: { wood: 40, stone: 20, food: 30, gold: 25 }, villagers: [],
          buildings: [{ id: 1, type: 'well', tx: 28, ty: 21, done: true }],
        };
        if (scenario !== 'first') save.wishes = 4;
        if (scenario === 'dawn') save.wishDay = save.day;
        localStorage.setItem('hearthvale-v1', JSON.stringify(save));
      }, scenario);
      await page.goto(BASE + '/hearthvale.html');
      const mini = await page.locator('#minimap').boundingBox();
      await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
      await page.mouse.click(width / 2, 450);
      ok(await page.locator('#p-name').textContent() === 'Well', `${width} ${scenario}: selects finished well`);
      const status = page.locator('#p-wish-stat');
      const tally = page.locator('#p-wishes-stat');
      ok(await tally.textContent() === (scenario === 'first' ? 'No wishes yet' : '4 granted'),
        `${width} ${scenario}: lifetime tally (including missing save field)`);
      if (scenario === 'dawn') {
        ok(await status.textContent() === '💧 Heard today’s wish' && await page.locator('#p-wish').isDisabled(),
          `${width}: saved wish is heard today`);
        const span = await status.elementHandle();
        const button = await page.locator('#p-wish').elementHandle();
        await page.waitForFunction(() => document.getElementById('r-day').textContent === '2', null, { timeout: 15000 });
        await page.waitForFunction(() => document.getElementById('p-wish-stat').textContent === 'Ready · 3🪙');
        ok(await span.evaluate(el => el.isConnected) && await button.evaluate(el => el.isConnected) &&
          await page.locator('#panel').evaluate(el => el.classList.contains('show')),
          `${width}: dawn refreshes stats in place while panel stays open`);
        ok(await tally.textContent() === '4 granted', `${width}: dawn preserves lifetime tally`);
      } else {
        ok(await status.textContent() === 'Ready · 3🪙' && await page.locator('#p-wish').isEnabled(),
          `${width} ${scenario}: ready with the existing wish cost`);
        await page.click('#p-wish');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
        const count = scenario === 'first' ? 1 : 5;
        ok(saved.wishes === count && saved.wishDay === saved.day,
          `${width} ${scenario}: real wish increments saved tally once`);
        ok(await status.textContent() === '💧 Heard today’s wish' && await tally.textContent() === `${count} granted` &&
          await page.locator('#p-wish').isDisabled(), `${width} ${scenario}: panel reflects granted wish`);
      }
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `zero page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

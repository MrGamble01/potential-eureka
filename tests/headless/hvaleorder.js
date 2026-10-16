/* Standing orders: supported saves and real Trader controls, no game hooks. */
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
    for (const good of ['wood', 'stone', 'food']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(good => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 12, traderDay: 12, time: 10, seenIntro: true,
          townName: 'Order test', muted: false, buildings: [], villagers: [],
          res: { wood: 14.5, stone: 14.5, food: 14.5, gold: 100 },
          order: { k: good, qty: 15, pay: 60, byDay: 18 }, ordersFilled: 1,
        }));
        // Observe real Web Audio calls without replacing any game functions.
        window.orderTones = [];
        const set = AudioParam.prototype.setValueAtTime;
        AudioParam.prototype.setValueAtTime = function(value, time) {
          window.orderTones.push(value);
          return set.call(this, value, time);
        };
      }, good);
      await page.goto(BASE + '/hearthvale.html');
      const mini = await page.locator('#minimap').boundingBox();
      await page.mouse.click(mini.x + mini.width * 23 / 56, mini.y + mini.height * 22 / 42);
      await page.mouse.click(width / 2, 445);
      await page.locator('#trader.show').waitFor();
      const label = `${width} ${good}`;
      const snapshot = () => page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        const s = JSON.parse(localStorage.getItem('hearthvale-v1'));
        return { res: s.res, order: s.order, ordersFilled: s.ordersFilled, chronicle: s.chronicle };
      });
      const before = await snapshot();
      const reason = `Standing order needs 15 ${good}; you have 14 (1 short).`;
      ok(await page.locator('#order-fill').isDisabled(), `${label}: short stock disables Deliver`);
      ok(await page.locator('#order-fill').getAttribute('title') === reason, `${label}: tooltip explains need, stock and shortfall`);
      await page.evaluate(() => { window.orderTones.length = 0; });
      await page.locator('#order-fill').evaluate(button => { button.disabled = false; button.click(); button.click(); });
      ok((await page.locator('#toasts').textContent()).includes(reason), `${label}: forced refusals explain the shortfall`);
      ok(await page.evaluate(() => window.orderTones.filter(v => v === 150).length === 2), `${label}: each refusal plays error SFX`);
      ok(JSON.stringify(await snapshot()) === JSON.stringify(before), `${label}: refusals preserve goods, gold, order, count and chronicle`);
      // Buying one good rerenders the strip and crosses the fractional-stock boundary.
      await page.click(`[data-act="buy"][data-k="${good}"][data-q="1"]`);
      const ready = await snapshot();
      ok(!(await page.locator('#order-fill').isDisabled()), `${label}: enough stock enables Deliver`);
      ok(!((await page.locator('#order-fill').getAttribute('title')) || '').includes('short'), `${label}: affordable tooltip drops shortfall`);
      // Keep the old button to prove a second call cannot pay the completed order twice.
      await page.locator('#order-fill').evaluate(button => { button.click(); button.click(); });
      const after = await snapshot();
      const expected = { ...ready.res, [good]: ready.res[good] - 15, gold: ready.res.gold + 60 };
      ok(JSON.stringify(after.res) === JSON.stringify(expected) && after.order === null && after.ordersFilled === 2,
        `${label}: delivery consumes exactly 15, pays 60 and completes once`);
      ok((await page.locator('#toasts').textContent()).includes('Standing order delivered — the merchant pays 60 gold on the spot.'), `${label}: success toast unchanged`);
      ok(after.chronicle.filter(entry => entry.t === "Delivered the merchant's standing order for 60 gold").length === 1,
        `${label}: successful delivery recorded once`);
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

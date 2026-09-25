/* Hunter's Lodge: supported saves and real clicks only; no game hooks. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  try {
    for (const width of [1280, 768]) {
      for (const scenario of [
        { name: 'spring', day: 1, status: 'Sleeps until winter', tally: 0, pelt: 'In 2 hunts' },
        { name: 'winter countdown', day: 19, hunts: 3, status: 'Next hunt in 2 days', tally: 3, pelt: 'Next hunt brings a pelt' },
        { name: 'party out', day: 21, hunts: 2, status: 'Party out today', tally: 2, pelt: 'In 2 hunts' },
        { name: 'returned', day: 21, hunts: 4, lastHuntDay: 21, status: 'Returned at dawn', tally: 4, pelt: 'In 2 hunts' },
        { name: 'live dawn', day: 20, time: 23, hunts: 3, status: 'Next hunt in 1 day', tally: 3, pelt: 'Next hunt brings a pelt', live: true },
        { name: 'year rollover', day: 24, time: 23, hunts: 4, lastHuntDay: 24, status: 'Returned at dawn', tally: 4, pelt: 'In 2 hunts', live: true },
      ]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(String(error)));
        await page.addInitScript(seed => {
          localStorage.setItem('hearthvale-v1', JSON.stringify({
            seed: 12345, time: 8, seenIntro: true, muted: true,
            townName: 'Hunters', _nextId: 2, nextTraderDay: 100, nextEventDay: 100,
            res: { wood: 40, stone: 20, food: 30, gold: 25 }, villagers: [],
            buildings: [{ id: 1, type: 'lodge', tx: 28, ty: 21, done: true, level: 1 }],
            ...seed,
          }));
        }, scenario);
        await page.goto(BASE + '/hearthvale.html');
        const mini = await page.locator('#minimap').boundingBox();
        await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
        await page.mouse.click(width / 2, 450);
        const panel = page.locator('#p-lodge');
        assert.match(await panel.innerText(), new RegExp(scenario.status));
        // Read each row independently so counts cannot accidentally match the countdown.
        const rows = await panel.locator(':scope > *').allTextContents();
        assert(rows.some(text => text === 'Hunts' + scenario.tally), rows.join('; '));
        assert(rows.some(text => text === 'Next pelt' + scenario.pelt), rows.join('; '));
        if (scenario.live) {
          const remove = await page.locator('#p-demolish').elementHandle();
          const expected = scenario.day === 20 ? 'Returned at dawn' : 'Sleeps until winter';
          await page.waitForFunction(text => document.getElementById('p-lodge')?.textContent.includes(text), expected);
          const updated = await panel.locator(':scope > *').allTextContents();
          assert(updated.includes('Hunts4'), updated.join('; '));
          assert(updated.includes('Next peltIn 2 hunts'), updated.join('; '));
          assert(await remove.evaluate(el => el.isConnected), 'live refresh preserves panel actions');
        }
        console.log(`PASS ${width}: ${scenario.name}`);
        await context.close();
      }
    }
    assert.deepEqual(errors, [], 'zero page errors');
    console.log('PASS: 12 scenarios; zero page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

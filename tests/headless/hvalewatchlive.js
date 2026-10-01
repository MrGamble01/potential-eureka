/* An open watchtower inspector follows completed defenses and the raid dawn. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  try {
    for (const width of [1280, 768]) for (const scenario of ['wall', 'dawn']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(scenario => localStorage.setItem('hearthvale-v1', JSON.stringify({
        seed: 12345, day: 14, time: scenario === 'dawn' ? 23 : 10,
        seenIntro: true, muted: true, townName: 'Live Watch', _nextId: 10,
        raidTonight: true, nextRaidDay: 19, nextTraderDay: 100, nextEventDay: 100,
        res: { wood: 40, stone: 40, food: 100, gold: 25 },
        villagers: [{ id: 5, jobId: 1, tx: 22, ty: 18, name: 'Keeper' }],
        buildings: [
          { id: 1, type: 'watchtower', tx: 28, ty: 21, level: 1, done: true },
          ...(scenario === 'wall' ? [{ id: 2, type: 'palisade', tx: 35, ty: 21,
            done: false, buildTotal: 10, buildLeft: 3 }] : []),
        ],
      })), scenario);
      await page.clock.install();
      await page.goto(BASE + '/hearthvale.html');
      await page.clock.pauseAt(new Date(Date.now() + 100));
      const mini = await page.locator('#minimap').boundingBox();
      await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
      await page.mouse.click(width / 2, 450);
      const panel = page.locator('#p-stats');
      assert.match(await panel.innerText(), /TONIGHT.*watch 1 vs pack 1/);
      const action = await page.locator('#p-demolish').elementHandle();
      await page.clock.runFor(10000);
      const save = await page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        return JSON.parse(localStorage.getItem('hearthvale-v1'));
      });
      if (scenario === 'wall') {
        assert.equal(save.buildings.find(b => b.id === 2).done, true, 'wall really finished');
        assert.match(await panel.innerText(), /TONIGHT.*watch 2 vs pack 1/);
      } else {
        assert.equal(save.raidTonight, false, 'raid really resolved');
        assert.doesNotMatch(await panel.innerText(), /TONIGHT|vs pack|this post/);
        assert.match(await panel.innerText(), /day \d+\+, in the cold seasons/);
      }
      assert(await action.evaluate(el => el.isConnected), 'refresh preserves panel actions');
      console.log(`PASS ${width}: open watch follows ${scenario}, actions retained`);
      await page.close();
    }
    assert.deepEqual(errors, [], 'zero page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

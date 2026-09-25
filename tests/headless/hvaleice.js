/* Hearthvale icehouse stock: supported saves and real panel clicks, no hooks. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  let failures = 0;
  const cases = [
    { name: 'winter empty', day: 19, blocks: 0, hint: 'packing at dawn' },
    { name: 'winter mid', day: 19, blocks: 2, hint: 'packing at dawn' },
    { name: 'winter full', day: 19, blocks: 4, hint: 'full for summer' },
    { name: 'summer mid', day: 7, blocks: 2, hint: 'selling at dawn' },
    { name: 'summer full', day: 7, blocks: 4, hint: 'selling at dawn' },
    { name: 'summer empty', day: 7, blocks: 0, hint: 'waiting on winter' },
    { name: 'spring storage', day: 1, blocks: 2, hint: 'waiting on summer' },
    { name: 'autumn storage', day: 13, blocks: 2, hint: 'waiting on winter' },
    { name: 'older save without stock', day: 19, hint: 'packing at dawn' },
    { name: 'well has no Ice row', day: 19, blocks: 2, type: 'well' },
    { name: 'construction has no Ice row', day: 19, blocks: 2, unfinished: true },
  ];
  // Flush through the normal browser lifecycle listener so assertions inspect
  // current game state, not merely the original localStorage seed.
  const snapshot = page => page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    const s = JSON.parse(localStorage.getItem('hearthvale-v1'));
    return { blocks: s.iceBlocks, gold: s.res.gold, happy: s.happy };
  });
  try {
    for (const width of [1280, 768]) for (const scenario of cases) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(s => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: s.day, time: 10, seenIntro: true, muted: true,
          townName: 'Coldstore', _nextId: 2, happy: 55, iceBlocks: s.blocks,
          res: { wood: 40, stone: 20, food: 100, gold: 25 }, villagers: [],
          buildings: [{ id: 1, type: s.type || 'icehouse', tx: 28, ty: 21,
            level: 1, done: !s.unfinished, buildTotal: 10000, buildLeft: 10000 }],
        }));
      }, scenario);
      try {
        await page.goto(BASE + '/hearthvale.html');
        const before = await snapshot(page);
        assert.deepEqual(before, { blocks: scenario.blocks || 0, gold: 25, happy: 55 });
        const mini = await page.locator('#minimap').boundingBox();
        await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
        await page.mouse.click(width / 2, 450);
        assert.equal(await page.locator('#p-name').innerText(), scenario.type ? 'Well' : 'Icehouse');
        assert.equal(await page.locator('#panel').evaluate(el => el.classList.contains('show')), true);
        const ice = page.locator('#p-stats .stat').filter({
          has: page.locator('span', { hasText: /^Ice$/ }),
        });
        if (scenario.type || scenario.unfinished) {
          assert.equal(await ice.count(), 0);
          if (scenario.unfinished) {
            assert.equal(await page.locator('#p-sub').innerText(), 'Under construction');
            assert.equal(await page.locator('#p-demolish').innerText(), 'Cancel');
          }
        } else {
          assert.equal(await ice.count(), 1);
          assert.equal(await ice.locator('b').innerText(),
            `${scenario.blocks || 0} / 4 blocks — ${scenario.hint}`);
        }
        assert.deepEqual(await snapshot(page), before, 'inspection preserves ice, gold and happiness');
        console.log(`PASS ${width}: ${scenario.name}`);
      } catch (error) {
        failures++;
        console.error(`FAIL ${width}: ${scenario.name}\n${error.message}`);
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS zero page errors');
  } finally {
    await browser.close();
  }
  assert.equal(failures, 0, 'all icehouse panel checks pass');
})().catch(error => { console.error(error); process.exitCode = 1; });

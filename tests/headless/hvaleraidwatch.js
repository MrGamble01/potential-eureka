/* Hearthvale raid-night matchup: supported saves and real panel clicks, no hooks. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  let failures = 0;
  const cases = [
    { name: 'tonight combines both posts and the palisade', tonight: true, watch: 4, pack: 3 },
    { name: 'Frontier includes the extra wolf', tonight: true, difficulty: 'hard', watch: 4, pack: 4 },
    { name: 'unfinished palisade contributes nothing', tonight: true, unfinishedWall: true, watch: 3, pack: 3 },
    { name: 'non-tonight retains day estimate', tonight: false },
    { name: 'Cozy retains never copy', tonight: false, difficulty: 'cozy' },
    { name: 'unstaffed post retains keeper warning', tonight: true, unstaffed: true, watch: 2, pack: 3 },
    { name: 'non-guard panel has no raid rows', tonight: true, type: 'well' },
  ];
  try {
    for (const width of [1280, 768]) for (const scenario of cases) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(s => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 14, time: 10, seenIntro: true, muted: true,
          townName: 'Nightwatch', _nextId: 100, happy: 55,
          difficulty: s.difficulty || 'normal', raidTonight: s.tonight, nextRaidDay: 19,
          res: { wood: 40, stone: 20, food: 100, gold: 25 },
          buildings: [
            { id: 1, type: s.type || 'watchtower', tx: 28, ty: 21, level: 2 },
            { id: 2, type: 'watchtower', tx: 32, ty: 21, level: 1 },
            { id: 3, type: 'palisade', tx: 36, ty: 21, done: !s.unfinishedWall,
              buildTotal: 10000, buildLeft: 10000 },
          ],
          // Twelve villagers: pack 3 on Wayfarer, 4 on Frontier.
          // Two staffed posts contribute 2 + 1; the finished wall adds 1.
          villagers: Array.from({ length: 12 }, (_, i) => ({
            id: 10 + i, tx: 20 + i % 4, ty: 16 + Math.floor(i / 4),
            name: 'Keeper ' + i, jobId: i === 0 && !s.unstaffed ? 1 : i === 1 ? 2 : null,
          })),
        }));
      }, scenario);
      try {
        await page.goto(BASE + '/hearthvale.html');
        const mini = await page.locator('#minimap').boundingBox();
        await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
        await page.mouse.click(width / 2, 450);
        assert.match(await page.locator('#p-name').innerText(), scenario.type ? /Well/ : /Watchtower/);
        assert.equal(await page.locator('#panel').evaluate(el => el.classList.contains('show')), true);
        const stats = await page.locator('#p-stats').innerText();
        if (scenario.type) {
          assert.doesNotMatch(stats, /Next raid|TONIGHT|vs pack/);
        } else {
          if (scenario.tonight) {
            assert.match(stats, new RegExp(`TONIGHT.*watch ${scenario.watch} vs pack ${scenario.pack}`));
          } else {
            assert.match(stats, scenario.difficulty === 'cozy' ? /never \(Cozy\)/ : /day 19\+, in the cold seasons/);
            assert.doesNotMatch(stats, /TONIGHT|vs pack/);
          }
          assert.match(stats, scenario.unstaffed ? /Watch\nneeds a keeper — no watch stands/
            : scenario.tonight ? /Watch\nthis post holds off a pack of 2/
            : /Watch\nholds off a pack of 2/);
        }
        console.log(`PASS ${width}: ${scenario.name}`);
      } catch (error) {
        failures++;
        console.error(`FAIL ${width}: ${scenario.name}\n${error.message}`);
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await browser.close();
  }
  assert.equal(failures, 0, 'all raid panel checks pass');
})().catch(error => { console.error(error); process.exitCode = 1; });

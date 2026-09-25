/* Tavern festival: supported saves and real clicks only; no game hooks. */
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
      const run = async (name, seed, check) => {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(String(error)));
        await page.addInitScript(saved => {
          localStorage.setItem('hearthvale-v1', JSON.stringify({
            seed: 12345, time: 8, seenIntro: true, muted: true, happy: 50,
            townName: 'Fairvale', _nextId: 3, nextTraderDay: 100, nextEventDay: 100,
            nextRaidDay: 100, difficulty: 'cozy', day: 4,
            res: { wood: 40, stone: 20, food: 30, gold: 25 },
            villagers: [],
            buildings: [{ id: 1, type: 'tavern', tx: 28, ty: 21, done: true, level: 1 }],
            ...saved,
          }));
        }, seed);
        await page.goto(BASE + '/hearthvale.html');
        const mini = await page.locator('#minimap').boundingBox();
        await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
        await page.mouse.click(width / 2, 450);
        const button = page.locator('#p-festival');
        await button.waitFor();
        const read = () => page.evaluate(() => {
          const b = document.getElementById('p-festival');
          const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent);
          return {
            text: b.textContent, title: b.title, disabled: b.disabled,
            food: document.getElementById('r-food').textContent,
            gold: document.getElementById('r-gold').textContent,
            day: document.getElementById('r-day').textContent,
            toast: toasts[toasts.length - 1] || '',
            save: JSON.parse(localStorage.getItem('hearthvale-v1')),
          };
        });
        await check(page, button, read);
        console.log(`PASS ${width}: ${name}`);
        await context.close();
      };

      await run('both short', { res: { wood: 40, stone: 20, food: 2, gold: 3 } }, async (page, button, read) => {
        const broke = await read();
        assert.equal(broke.text, '🎪 Need 4🍎 and 5💰 more');
        assert.equal(broke.title, 'Need 4🍎 and 5💰 more to hold a festival.');
        assert.equal(broke.disabled, false);
        await button.click();
        const refused = await read();
        assert.match(refused.toast, /Need 4🍎 and 5💰 more to hold a festival/);
        assert.equal(refused.save.res.food, 2);
        assert.equal(refused.save.res.gold, 3);
        assert.equal(refused.save.festival || null, null);
        assert.equal(refused.save.festivalsHeld || 0, 0);
      });

      await run('food short', { res: { wood: 40, stone: 20, food: 4, gold: 40 } }, async (page, button, read) => {
        const broke = await read();
        assert.equal(broke.text, '🎪 Need 2🍎 more');
        assert.equal(broke.title, 'Need 2🍎 more to hold a festival.');
        await button.click();
        const refused = await read();
        assert.match(refused.toast, /Need 2🍎 more to hold a festival/);
        assert.equal(refused.save.res.food, 4);
        assert.equal(refused.save.res.gold, 40);
        assert.equal(refused.save.festivalsHeld || 0, 0);
      });

      await run('coin short', { res: { wood: 40, stone: 20, food: 40, gold: 3 } }, async (page, button, read) => {
        const broke = await read();
        assert.equal(broke.text, '🎪 Need 5💰 more');
        assert.equal(broke.title, 'Need 5💰 more to hold a festival.');
        await button.click();
        const refused = await read();
        assert.match(refused.toast, /Need 5💰 more to hold a festival/);
        assert.equal(refused.save.res.food, 40);
        assert.equal(refused.save.res.gold, 3);
      });

      await run('paid fair', { res: { wood: 40, stone: 20, food: 30, gold: 25 }, day: 4 }, async (page, button, read) => {
        const ready = await read();
        assert.match(ready.text, /Hold a Festival/);
        assert.match(ready.text, /6🍎/);
        assert.match(ready.text, /8💰/);
        assert.equal(ready.title, 'Spend 6🍎 8💰 — the fair lasts 2 days.');
        await button.click();
        const held = await read();
        assert.equal(held.save.res.food, 24);
        assert.equal(held.save.res.gold, 17);
        assert.equal(held.save.festivalsHeld, 1);
        assert.equal(held.save.lastFestivalDay, 4);
        assert.equal(held.save.festival.endDay, 6);
        assert.equal(held.save.happy, 70);
        assert.equal(held.text, '🎪 Festival underway · 2 days left');
        assert.equal(held.title, 'The fair has 2 days left.');
        await button.click();
        const again = await read();
        assert.match(again.toast, /already underway — 2 days left/);
        assert.equal(again.save.res.food, 24);
        assert.equal(again.save.res.gold, 17);
        assert.equal(again.save.festivalsHeld, 1);
      });

      await run('resting two days', { day: 8, lastFestivalDay: 7, res: { wood: 40, stone: 20, food: 40, gold: 40 } }, async (page, button, read) => {
        const resting = await read();
        assert.equal(resting.text, '🎪 Resting · ready in 2 days');
        assert.equal(resting.title, 'The town needs 2 more days before the next festival.');
        await button.click();
        const refused = await read();
        assert.match(refused.toast, /next festival is 2 days away/);
        assert.equal(refused.save.res.food, 40);
        assert.equal(refused.save.res.gold, 40);
        assert.equal(refused.save.festivalsHeld || 0, 0);
        assert.equal(refused.save.festival || null, null);
      });

      await run('resting one day', { day: 8, lastFestivalDay: 6, res: { wood: 40, stone: 20, food: 40, gold: 40 } }, async (page, button, read) => {
        const resting = await read();
        assert.equal(resting.text, '🎪 Resting · ready in 1 day');
        assert.equal(resting.title, 'The town needs 1 more day before the next festival.');
        await button.click();
        const refused = await read();
        assert.match(refused.toast, /next festival is 1 day away/);
        assert.equal(refused.save.festivalsHeld || 0, 0);
      });

      await run('underway', {
        day: 5, festival: { endDay: 7 }, lastFestivalDay: 5,
        res: { wood: 40, stone: 20, food: 40, gold: 40 },
      }, async (page, button, read) => {
        const on = await read();
        assert.equal(on.text, '🎪 Festival underway · 2 days left');
        assert.equal(on.title, 'The fair has 2 days left.');
        await button.click();
        const refused = await read();
        assert.match(refused.toast, /already underway — 2 days left/);
        assert.equal(refused.save.res.food, 40);
        assert.equal(refused.save.res.gold, 40);
        assert.equal(refused.save.festivalsHeld || 0, 0);
      });

      await run('live dawn', {
        day: 5, time: 23, lastFestivalDay: 3,
        res: { wood: 40, stone: 20, food: 40, gold: 40 },
      }, async (page, button, read) => {
        const waiting = await read();
        assert.equal(waiting.text, '🎪 Resting · ready in 1 day');
        const remove = await page.locator('#p-demolish').elementHandle();
        await page.waitForFunction(() => document.getElementById('p-festival')?.textContent.includes('Hold a Festival'));
        const ready = await read();
        assert.equal(ready.day, '6');
        assert.match(ready.text, /6🍎/);
        assert.match(ready.text, /8💰/);
        assert.equal(ready.title, 'Spend 6🍎 8💰 — the fair lasts 2 days.');
        assert.equal(await remove.evaluate(el => el.isConnected), true);
        await button.click();
        const held = await read();
        assert.equal(held.save.res.food, 34);
        assert.equal(held.save.res.gold, 32);
        assert.equal(held.save.lastFestivalDay, 6);
        assert.equal(held.save.festival.endDay, 8);
        assert.equal(held.text, '🎪 Festival underway · 2 days left');
      });

      await run('live fair', {
        day: 5, time: 23, lastFestivalDay: 5, festival: { endDay: 7 },
        res: { wood: 40, stone: 20, food: 40, gold: 40 },
      }, async (page, button, read) => {
        assert.equal((await read()).text, '🎪 Festival underway · 2 days left');
        const remove = await page.locator('#p-demolish').elementHandle();
        await page.waitForFunction(() => document.getElementById('p-festival')?.textContent.includes('1 day left'));
        const later = await read();
        assert.equal(later.day, '6');
        assert.equal(later.text, '🎪 Festival underway · 1 day left');
        assert.equal(later.title, 'The fair has 1 day left.');
        assert.equal(await remove.evaluate(el => el.isConnected), true);
        await button.click();
        const refused = await read();
        assert.match(refused.toast, /already underway — 1 day left/);
        assert.equal(refused.save.res.food, 40);
        assert.equal(refused.save.res.gold, 40);
        assert.equal(refused.save.festival.endDay, 7);
      });

      await run('live orchard', {
        day: 1, time: 8, _prodAbs: 30,
        res: { wood: 40, stone: 20, food: 4, gold: 40 },
        buildings: [
          { id: 1, type: 'tavern', tx: 28, ty: 21, done: true, level: 1 },
          { id: 2, type: 'orchard', tx: 4, ty: 4, done: true, level: 1 },
        ],
      }, async (page, button, read) => {
        const broke = await read();
        assert.equal(broke.text, '🎪 Need 2🍎 more');
        assert.equal(broke.food, '4');
        const remove = await page.locator('#p-demolish').elementHandle();
        await page.waitForFunction(() => document.getElementById('p-festival')?.textContent.includes('Hold a Festival'), null, { timeout: 20000 });
        const ready = await read();
        assert.equal(ready.food, '9');
        assert.match(ready.text, /6🍎/);
        assert.equal(await remove.evaluate(el => el.isConnected), true);
        await button.click();
        const held = await read();
        assert.equal(held.save.res.food, 3);
        assert.equal(held.save.res.gold, 32);
        assert.equal(held.save.festivalsHeld, 1);
        assert.equal(held.text, '🎪 Festival underway · 2 days left');
      });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: tavern festival feedback; zero page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

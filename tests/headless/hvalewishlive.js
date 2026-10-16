/* The open well follows dawn and earned gold without replacing keyboard focus. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  try {
    for (const width of [1280, 768]) for (const scenario of ['dawn', 'short', 'income']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(scenario => localStorage.setItem('hearthvale-v1', JSON.stringify({
        seed: 12345, day: 4, time: scenario === 'dawn' ? 23 : 8, _prodAbs: 99,
        seenIntro: true, muted: true, townName: 'Wishvale', _nextId: 4,
        wishDay: scenario === 'dawn' ? 4 : -1, wishes: 1,
        nextRaidDay: 100, nextTraderDay: 100, nextEventDay: 100, difficulty: 'cozy',
        res: { wood: 40, stone: 40, food: 100, gold: scenario === 'dawn' ? 3 : 1 },
        villagers: scenario === 'income' ? [{ id: 3, jobId: 2, tx: 5, ty: 5, name: 'Merchant' }] : [], buildings: [
          { id: 1, type: 'well', tx: 28, ty: 21, level: 1, done: true },
          ...(scenario === 'income' ? [{ id: 2, type: 'market', tx: 5, ty: 5, level: 1, done: true }] : []),
        ],
      })), scenario);
      await page.clock.install();
      await page.goto(BASE + '/hearthvale.html');
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      const mini = await page.locator('#minimap').boundingBox();
      await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
      await page.mouse.click(width / 2, 450);
      const wish = page.locator('#p-wish');
      const action = await wish.elementHandle();
      assert(await page.locator('#p-actions').evaluate(el => {
        const panel = document.getElementById('panel').getBoundingClientRect();
        return [...el.children].every(button => {
          const box = button.getBoundingClientRect();
          return box.left >= panel.left + 12 && box.right <= panel.right - 12;
        });
      }), 'actions fit inside the inspector');
      const save = () => page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        return JSON.parse(localStorage.getItem('hearthvale-v1'));
      });
      if (scenario === 'dawn') {
        assert.equal(await wish.isDisabled(), true);
        await page.clock.runFor(10000);
        assert.equal((await save()).day, 5);
        assert.equal(await wish.isEnabled(), true, 'dawn makes the open well usable');
      } else {
        assert.match(await wish.innerText(), /Need 2 gold/);
        await wish.focus();
        if (scenario === 'short') {
          await page.keyboard.press('Enter');
          assert.match(await page.locator('#toasts').innerText(), /Need 2 gold/);
          assert.equal((await save()).res.gold, 1);
          assert.equal((await save()).wishes, 1);
        } else {
          await page.clock.runFor(10000);
          assert.ok((await save()).res.gold >= 3, 'real market production earns gold');
          assert.match(await wish.innerText(), /Make a wish/);
          assert.equal(await wish.evaluate(el => el === document.activeElement), true);
        }
      }
      assert.equal(await action.evaluate(el => el.isConnected), true);
      if (scenario !== 'short') {
        await wish.focus();
        await page.keyboard.press('Enter');
        assert.equal((await save()).wishes, 2, 'keyboard action grants one wish');
        assert.equal(await wish.isDisabled(), true);
        await page.keyboard.press('Enter');
        assert.equal((await save()).wishes, 2, 'cannot pay twice in one day');
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#panel.show').count(), 0);
      console.log(`PASS ${width}: ${scenario}`);
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

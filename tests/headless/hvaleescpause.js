/* Escape releases a player Space-hold, after dismissing any other sheet first.
 * Hook-free: kept towns, production controls, canvas clicks and lifecycle saves. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  const shown = selector => page.locator(selector).count();
  const speed = () => page.locator('#speedctl .on').getAttribute('data-sp');
  const savedTime = () => page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(localStorage.getItem('hearthvale-v1')).time;
  });
  const space = async () => {
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Space');
  };
  try {
    await page.addInitScript(() => localStorage.setItem('hearthvale-v1', JSON.stringify({
      seed: 12345, day: 1, time: 10, seenIntro: true, muted: true,
      townName: 'Escape Pause', _nextId: 2, traderDay: 1,
      res: { wood: 40, stone: 20, food: 30, gold: 80 }, villagers: [],
      buildings: [{ id: 1, type: 'market', tx: 28, ty: 24, done: true }],
    })));
    await page.goto(BASE + '/hearthvale.html');
    for (const sp of ['1', '3']) {
      await page.click(`#speedctl [data-sp="${sp}"]`);
      await space();
      assert.equal(await shown('#paused.show'), 1, 'Space displays player pause');
      const held = await savedTime();
      await page.waitForTimeout(350);
      assert.equal(await savedTime(), held, 'Player pause holds time');
      await page.keyboard.press('Escape');
      assert.equal(await shown('#paused.show'), 0, 'Escape dismisses player pause');
      assert.equal(await speed(), sp, 'Escape restores previous speed');
      await page.waitForTimeout(350);
      assert.ok(await savedTime() > held, 'Escape restarts simulation');
    }
    console.log('PASS Space → Escape hides pause and restores moving time at 1× and 3×');

    for (const [button, sheet] of [['m-achv', '#achv.show'], ['m-chronicle', '#chronicle.show'],
      ['m-decrees', '#decrees.show'], ['chain-btn', '#chain-modal.open']]) {
      await space();
      // Invoke the real browsing control while the pause sheet covers the gear.
      await page.evaluate(id => document.getElementById(id).click(), button);
      assert.equal(await shown(sheet), 1);
      await page.keyboard.press('Escape');
      assert.equal(await shown(sheet), 0, 'First Escape dismisses browsing sheet');
      assert.equal(await speed(), '0', 'First Escape preserves underlying player hold');
      await page.keyboard.press('Escape');
      assert.equal(await shown('#paused.show'), 0);
      assert.equal(await speed(), '3', 'Second Escape resumes player hold');
    }
    console.log('PASS browsing sheets and Hall dismiss before underlying pause');

    for (const kind of ['trader', 'event']) {
      for (const playerHold of [false, true]) {
        await page.reload();
        await page.click('#speedctl [data-sp="3"]');
        const mini = await page.locator('#minimap').boundingBox();
        const y = kind === 'trader' ? 22 : 25.5;
        await page.mouse.click(mini.x + mini.width * 29.5 / 56, mini.y + mini.height * y / 42);
        // Pointer capture lets the canvas gesture finish after Space opens pause.
        await page.mouse.move(640, 450);
        await page.mouse.down();
        if (playerHold) await space();
        await page.mouse.up();
        if (kind === 'event') await page.evaluate(() => document.getElementById('p-caravan').click());
        assert.equal(await shown(`#${kind}.show`), 1, `${kind} opens through real control`);
        const held = await savedTime();
        await space();
        await page.waitForTimeout(350);
        assert.equal(await savedTime(), held, 'Space leaves modal pause owned');
        await page.keyboard.press('Escape');
        assert.equal(await shown(`#${kind}.show`), 0);
        assert.equal(await speed(), playerHold ? '0' : '3', 'Modal close restores its original speed');
        assert.equal(await shown('#paused.show'), playerHold ? 1 : 0);
        if (playerHold) {
          await page.waitForTimeout(350);
          assert.equal(await savedTime(), held, 'Closing modal does not double-resume');
          await page.keyboard.press('Escape');
          assert.equal(await speed(), '3');
        }
        await page.waitForTimeout(350);
        assert.ok(await savedTime() > held);
      }
    }
    console.log('PASS trader/event Escape preserves modal ownership, including underlying player holds');

    const fresh = await browser.newContext();
    const welcome = await fresh.newPage();
    welcome.on('pageerror', error => errors.push(String(error)));
    await welcome.goto(BASE + '/hearthvale.html');
    await welcome.keyboard.press('Escape');
    assert.equal(await welcome.locator('#welcome.show').count(), 1, 'Escape leaves welcome alone');
    await fresh.close();
    assert.deepEqual(errors, []);
    console.log('PASS welcome unchanged; zero page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

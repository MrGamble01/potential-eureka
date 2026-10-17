/* Valley Cup: a local daily basket and pasted slips. Real clicks, no game hooks. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

const BASE_SAVE = {
  seed: 12345, time: 8, seenIntro: true, muted: true, happy: 50,
  townName: 'Stillvale', _nextId: 5, nextTraderDay: 100, nextEventDay: 100,
  nextRaidDay: 100, difficulty: 'cozy', day: 4, goalIndex: 99,
  _prodAbs: 999999,
  res: { wood: 40, stone: 20, food: 30, gold: 25 },
  villagers: [{ id: 1, name: 'Ada', tx: 26, ty: 24, jobId: 1, xp: 0, color: '#c4574a', ph: 0 }],
  buildings: [
    { id: 1, type: 'farm', tx: 28, ty: 21, done: true, level: 1, crop: 'feverfew' },
    { id: 2, type: 'stillroom', tx: 33, ty: 21, done: true, level: 1 },
  ],
  stores: { herbs: 4, fibre: 0, tea: 2, salve: 0, linen: 2, pie: 2 },
};

function slip(name, day, score) {
  return 'HV1.' + Buffer.from(name, 'utf8').toString('base64url') + '.' + day + '.' + score;
}
function decodeSlip(code) {
  const m = String(code).match(/^HV1\.([A-Za-z0-9_-]+)\.(\d{8})\.(\d{1,5})$/);
  assert.ok(m, code);
  return { name: Buffer.from(m[1], 'base64url').toString('utf8'), day: m[2], score: Number(m[3]) };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  const jump = async (page, tx, ty) => {
    const mini = await page.locator('#minimap').boundingBox();
    await page.mouse.click(mini.x + mini.width * tx / 56, mini.y + mini.height * ty / 42);
    const box = page.viewportSize();
    await page.mouse.click(box.width / 2, box.height / 2);
  };
  try {
    const run = async (name, seed, check, viewport) => {
      const context = await browser.newContext(viewport || { viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(name + ' ' + error));
      await page.addInitScript(saved => {
        localStorage.setItem('hearthvale-v1', JSON.stringify(saved));
      }, seed);
      await page.goto(BASE + '/hearthvale.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#game');
      await check(page);
      console.log('PASS ' + name);
      await context.close();
    };

    await run('a short basket is refused', {
      ...BASE_SAVE,
      stores: { herbs: 0, fibre: 0, tea: 0, salve: 0, linen: 0, pie: 0 },
    }, async page => {
      await jump(page, 34, 22);
      await page.locator('#p-still').click();
      await page.locator('#cup-enter').click();
      const snap = await page.evaluate(() => {
        const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent);
        const save = JSON.parse(localStorage.getItem('hearthvale-v1'));
        return { toasts, cup: save.cup || null, stores: save.stores };
      });
      assert.ok(snap.toasts.some(t => t.startsWith('Need ')));
      assert.equal(snap.cup, null);
      assert.equal(snap.stores.tea, 0);
      assert.equal(snap.stores.linen, 0);
      assert.equal(snap.stores.pie, 0);
    });

    await run('one entry spends today and prints a slip', BASE_SAVE, async page => {
      await jump(page, 34, 22);
      await page.locator('#p-still').click();
      await page.locator('#still-recipe-tea').click();
      const brewed = await page.locator('#juice').evaluate(el => ({ hidden: el.hidden, text: el.textContent }));
      assert.equal(brewed.hidden, false);
      assert.match(brewed.text, /Willow tea is ready/);
      const before = await page.evaluate(() => {
        const need = document.getElementById('cup-need');
        const save = JSON.parse(localStorage.getItem('hearthvale-v1'));
        return {
          tea: Number(need.dataset.tea),
          linen: Number(need.dataset.linen),
          pie: Number(need.dataset.pie),
          stores: save.stores,
          day: document.getElementById('cup-day').textContent,
        };
      });
      assert.equal(before.tea + before.linen + before.pie, 2);
      await page.locator('#cup-enter').click();
      const mid = await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('hearthvale-v1'));
        const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent);
        return {
          save,
          toasts,
          code: document.getElementById('cup-code').value,
          juice: document.getElementById('juice').textContent,
          juiceHidden: document.getElementById('juice').hidden,
          step: document.querySelector('[data-step="cup"]').dataset.done,
          you: document.querySelector('#cup-board .cup-row').dataset,
        };
      });
      assert.equal(mid.save.stores.tea, before.stores.tea - before.tea);
      assert.equal(mid.save.stores.linen, before.stores.linen - before.linen);
      assert.equal(mid.save.stores.pie, before.stores.pie - before.pie);
      assert.equal(mid.save.cup.score, 80);
      assert.equal(mid.save.cup.day, before.day);
      assert.equal(mid.save.kinship || 0, 0);
      assert.equal(mid.save.deliveries || 0, 0);
      assert.ok(mid.toasts.some(t => t.includes('enters the Valley Cup at 80')));
      assert.equal(mid.juiceHidden, false);
      assert.match(mid.juice, /Valley Cup · 80/);
      assert.equal(mid.step, '1');
      const decoded = decodeSlip(mid.code);
      assert.equal(decoded.name, 'Stillvale');
      assert.equal(decoded.day, before.day);
      assert.equal(decoded.score, 80);
      assert.equal(mid.you.name, 'Stillvale');
      assert.equal(mid.you.score, '80');

      const friend = slip('Bram Holt', before.day, 140);
      await page.locator('#cup-paste').fill(friend);
      await page.locator('#cup-add').click();
      const board = await page.evaluate(() => [...document.querySelectorAll('#cup-board .cup-row')].map(row => ({
        name: row.dataset.name,
        score: row.dataset.score,
      })));
      assert.deepEqual(board, [
        { name: 'Bram Holt', score: '140' },
        { name: 'Stillvale', score: '80' },
      ]);

      await page.locator('#cup-paste').fill('nope');
      await page.locator('#cup-add').click();
      const bad = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent));
      assert.ok(bad.some(t => t.includes('Valley Cup slip')));

      await page.locator('#cup-paste').fill(slip('Wren', '19991231', 50));
      await page.locator('#cup-add').click();
      const other = await page.evaluate(() => {
        const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent);
        const names = [...document.querySelectorAll('#cup-board .cup-row')].map(row => row.dataset.name);
        const kept = JSON.parse(localStorage.getItem('hvale-cup-rivals') || '[]');
        return { toasts, names, kept };
      });
      assert.ok(other.toasts.some(t => t.includes('another day')));
      assert.deepEqual(other.names, ['Bram Holt', 'Stillvale']);
      assert.ok(other.kept.some(r => r.name === 'Wren' && r.day === '19991231' && r.score === 50));

      const spent = mid.save.stores;
      await page.locator('#cup-enter').click();
      const again = await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('hearthvale-v1'));
        const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent);
        return { stores: save.stores, cup: save.cup, toasts };
      });
      assert.ok(again.toasts.some(t => t.includes('already has your name today')));
      assert.equal(again.stores.tea, spent.tea);
      assert.equal(again.stores.linen, spent.linen);
      assert.equal(again.stores.pie, spent.pie);
      assert.equal(again.cup.score, 80);
    });

    await run('phone taps the bench and the cup', BASE_SAVE, async page => {
      const mini = await page.locator('#minimap').boundingBox();
      await page.touchscreen.tap(mini.x + mini.width * 29.5 / 56, mini.y + mini.height * 22 / 42);
      const view = page.viewportSize();
      await page.touchscreen.tap(view.width / 2, view.height / 2);
      await page.locator('#p-crop-feverfew').waitFor();
      const measure = async sel => page.locator(sel).evaluate(el => {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        return { h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right, iw: window.innerWidth, ih: window.innerHeight };
      });
      for (const sel of ['#p-crop-grain', '#p-crop-feverfew', '#p-crop-flax', '#p-still', '#touch-pause']) {
        const box = await measure(sel);
        assert.ok(box.h >= 44, sel + ' height ' + box.h);
        assert.ok(box.top >= -1 && box.bottom <= box.ih + 1, sel + ' y');
        assert.ok(box.left >= -1 && box.right <= box.iw + 1, sel + ' x');
      }
      await page.locator('#p-still').tap();
      await page.locator('#stillroom.show').waitFor();
      for (const sel of ['#still-recipe-tea', '#still-deliver-mara', '#cup-enter', '#cup-add']) {
        const box = await measure(sel);
        assert.ok(box.h >= 44, sel + ' height ' + box.h);
        assert.ok(box.top >= -1 && box.bottom <= box.ih + 1, sel + ' y');
        assert.ok(box.left >= -1 && box.right <= box.iw + 1, sel + ' x');
      }
      await page.locator('#still-recipe-tea').tap();
      const brewed = await page.locator('#juice').evaluate(el => ({ hidden: el.hidden, text: el.textContent }));
      assert.equal(brewed.hidden, false);
      assert.match(brewed.text, /Willow tea/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, 'horizontal scroll ' + overflow);
    }, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    if (errors.length) throw new Error(errors.join('\n'));
    console.log('hvalecup: ok');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

/* Stillroom: crops, crafting, neighbour quests. Real clicks, no game hooks. */
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
    { id: 1, type: 'farm', tx: 28, ty: 21, done: true, level: 1 },
    { id: 2, type: 'stillroom', tx: 33, ty: 21, done: true, level: 1 },
  ],
};

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
    for (const width of [1280, 768]) {
      const run = async (name, seed, check) => {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(width + ' ' + name + ' ' + error));
        await page.addInitScript(saved => {
          localStorage.setItem('hearthvale-v1', JSON.stringify(saved));
        }, seed);
        await page.goto(BASE + '/hearthvale.html', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#game');
        await check(page);
        console.log(`PASS ${width}: ${name}`);
        await context.close();
      };

      await run('crops leave the pantry', {
        ...BASE_SAVE,
        res: { wood: 40, stone: 20, food: 30, gold: 25 },
      }, async page => {
        await jump(page, 29.5, 22);
        await page.locator('#p-crop-grain').waitFor();
        const grain = await page.locator('#p-stats').innerText();
        assert.match(grain, /Grain/);
        assert.match(grain, /6 🍎/);
        assert.equal(await page.locator('#r-foodnet').innerText(), '+5');
        await page.locator('#p-crop-feverfew').click();
        const herbs = await page.locator('#p-stats').innerText();
        assert.match(herbs, /Feverfew/);
        assert.match(herbs, /3 🌿/);
        assert.doesNotMatch(herbs, /Produces/);
        assert.equal(await page.locator('#r-foodnet').innerText(), '-1');
        await page.locator('#p-crop-feverfew').click();
        await page.locator('#p-crop-flax').click();
        const flax = await page.locator('#p-stats').innerText();
        assert.match(flax, /Flax/);
        assert.match(flax, /3 🧵/);
        await page.locator('#p-crop-grain').click();
        const back = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
        assert.equal(back.buildings.find(b => b.type === 'farm').crop, undefined);
        assert.equal(await page.locator('#r-foodnet').innerText(), '+5');
        assert.equal(back.res.food, 30);
        assert.equal(back.res.gold, 25);
      });

      await run('bench refuses a short kettle', {
        ...BASE_SAVE,
        stores: { herbs: 0, fibre: 0, tea: 0, salve: 0, linen: 0, pie: 0 },
      }, async page => {
        await jump(page, 34, 22);
        await page.locator('#p-still').click();
        await page.locator('#still-recipe-tea').waitFor();
        const tea = await page.locator('#still-recipe-tea').innerText();
        assert.match(tea, /2 🌿/);
        assert.doesNotMatch(tea, /kin/);
        const salve = page.locator('#still-recipe-salve');
        assert.match(await salve.innerText(), /Known/);
        assert.equal(await salve.getAttribute('title'), 'Opens when you are Known (3 goodwill).');
        await salve.click();
        await page.locator('#still-recipe-tea').click();
        await page.locator('#still-deliver-mara').click();
        const snap = await page.evaluate(() => {
          const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent);
          const save = JSON.parse(localStorage.getItem('hearthvale-v1'));
          return { toasts, save, ask: document.getElementById('still-ask-mara').textContent };
        });
        assert.ok(snap.toasts.some(t => t.includes('Fever salve opens when you are Known (3 goodwill).')));
        assert.ok(snap.toasts.some(t => t.includes('Need 2 more 🌿 feverfew')));
        assert.ok(snap.toasts.some(t => t.includes('Need 1 more 🍵 willow tea')));
        assert.equal(snap.save.crafted || 0, 0);
        assert.equal(snap.save.deliveries || 0, 0);
        assert.equal(snap.save.kinship || 0, 0);
        assert.equal(snap.save.stores.herbs, 0);
        assert.equal(snap.save.stores.tea || 0, 0);
        assert.match(snap.ask, /willow tea for the lane/);
        assert.equal(await page.locator('#still-flavor').innerText(), 'Stranger · 0 goodwill. The bench will take a first kettle, a first bolt, a first pie.');
      });

      await run('three neighbours and a known valley', {
        ...BASE_SAVE,
        res: { wood: 40, stone: 20, food: 30, gold: 25 },
        stores: { herbs: 3, fibre: 3, tea: 0, salve: 0, linen: 0, pie: 0 },
      }, async page => {
        await jump(page, 34, 22);
        await page.locator('#p-still').click();
        await page.locator('#still-recipe-tea').click();
        await page.locator('#still-recipe-linen').click();
        await page.locator('#still-recipe-pie').click();
        await page.locator('#still-deliver-mara').click();
        await page.locator('#still-deliver-tomas').click();
        await page.locator('#still-deliver-nessa').click();
        const mid = await page.evaluate(() => {
          const s = JSON.parse(localStorage.getItem('hearthvale-v1'));
          return {
            s,
            flavor: document.getElementById('still-flavor').textContent,
            path: document.querySelector('[data-step="known"]').dataset.done,
            salve: document.getElementById('still-recipe-salve').textContent,
            mara: document.getElementById('still-ask-mara').textContent,
          };
        });
        assert.equal(mid.s.stores.herbs, 0);
        assert.equal(mid.s.stores.fibre, 0);
        assert.equal(mid.s.stores.tea, 0);
        assert.equal(mid.s.stores.linen, 0);
        assert.equal(mid.s.stores.pie, 0);
        assert.equal(mid.s.res.food, 27);
        assert.equal(mid.s.res.wood, 45);
        assert.equal(mid.s.res.gold, 73);
        assert.equal(mid.s.crafted, 3);
        assert.equal(mid.s.deliveries, 3);
        assert.equal(mid.s.kinship, 3);
        assert.equal(mid.s.happy, 56);
        assert.equal(mid.s.posts.mara, 1);
        assert.equal(mid.s.posts.tomas, 1);
        assert.equal(mid.s.posts.nessa, 1);
        assert.match(mid.flavor, /^Known · 3 goodwill/);
        assert.equal(mid.path, '1');
        assert.match(mid.salve, /3 🌿 1 🍎/);
        assert.match(mid.mara, /Two salves/);
        await page.locator('#still-deliver-mara').click();
        const held = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
        assert.equal(held.kinship, 3);
        assert.equal(held.deliveries, 3);
        assert.equal(held.stores.salve || 0, 0);
        assert.match(await page.locator('#toasts .toast').last().innerText(), /Need 2 more 🧴 salve/);
      });

      await run('a bigger ask waits', {
        ...BASE_SAVE,
        kinship: 1,
        posts: { mara: 1, tomas: 0, nessa: 0 },
        asksFilled: { 'mara:kettle': 1 },
        stores: { herbs: 0, fibre: 0, tea: 0, salve: 2, linen: 0, pie: 0 },
      }, async page => {
        await jump(page, 34, 22);
        await page.locator('#p-still').click();
        assert.match(await page.locator('#still-ask-mara').innerText(), /Waiting until you are Known/);
        await page.locator('#still-deliver-mara').click();
        const save = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
        assert.equal(save.stores.salve, 2);
        assert.equal(save.kinship, 1);
        assert.equal(save.deliveries || 0, 0);
        assert.equal(save.res.gold, 25);
        assert.match(await page.locator('#toasts .toast').last().innerText(), /waiting until you are Known/);
      });
    }

    const once = async (name, seed, check) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push('1280 ' + name + ' ' + error));
      await page.addInitScript(saved => {
        localStorage.setItem('hearthvale-v1', JSON.stringify(saved));
      }, seed);
      await page.goto(BASE + '/hearthvale.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#game');
      await check(page, context);
      console.log(`PASS 1280: ${name}`);
      await context.close();
    };

    await once('physic garden sweetens feverfew', {
      ...BASE_SAVE,
      kinship: 3,
      buildings: [
        ...BASE_SAVE.buildings,
        { id: 3, type: 'physic', tx: 36, ty: 21, done: true, level: 1 },
      ],
    }, async page => {
      await jump(page, 29.5, 22);
      await page.locator('#p-crop-feverfew').click();
      const stats = await page.locator('#p-stats').innerText();
      assert.match(stats, /4 🌿/);
    });

    await once('kin trims the dearest ingredient', {
      ...BASE_SAVE,
      kinship: 10,
      stores: { herbs: 1, fibre: 0, tea: 0, salve: 0, linen: 0, pie: 0 },
    }, async page => {
      await jump(page, 34, 22);
      await page.locator('#p-still').click();
      const label = await page.locator('#still-recipe-tea').innerText();
      assert.match(label, /1 🌿/);
      assert.match(label, /kin/);
      await page.locator('#still-recipe-tea').click();
      const save = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
      assert.equal(save.stores.herbs, 0);
      assert.equal(save.stores.tea, 1);
      assert.equal(save.crafted, 1);
      assert.match(await page.locator('#still-flavor').innerText(), /^Kin · 10 goodwill/);
    });

    await once('a salve breaks the fever', {
      ...BASE_SAVE,
      happy: 40,
      feverUntil: 8,
      feversWeathered: 0,
      stores: { herbs: 0, fibre: 0, tea: 0, salve: 1, linen: 0, pie: 0 },
    }, async page => {
      await jump(page, 34, 22);
      await page.locator('#p-still').click();
      await page.locator('#still-anoint').click();
      const save = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
      assert.equal(save.stores.salve, 0);
      assert.equal(save.feverUntil, -1);
      assert.equal(save.feversWeathered, 1);
      assert.equal(save.happy, 44);
      assert.equal(await page.locator('#still-anoint').count(), 0);
      const toasts = await page.locator('#toasts .toast').allInnerTexts();
      assert.ok(toasts.some(t => t.includes('The fever breaks')));
    });

    await once('mara keeps a salve for the next fever', {
      ...BASE_SAVE,
      kinship: 3,
      posts: { mara: 1, tomas: 0, nessa: 0 },
      asksFilled: { 'mara:kettle': 1 },
      res: { wood: 40, stone: 20, food: 30, gold: 20 },
      stores: { herbs: 0, fibre: 0, tea: 0, salve: 2, linen: 0, pie: 0 },
    }, async page => {
      await jump(page, 34, 22);
      await page.locator('#p-still').click();
      assert.match(await page.locator('#still-ask-mara').innerText(), /Two salves/);
      await page.locator('#still-deliver-mara').click();
      const first = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
      assert.equal(first.stores.salve, 0);
      assert.equal(first.ward, 1);
      assert.equal(first.kinship, 4);
      assert.equal(first.res.gold, 48);
      assert.match(await page.locator('#still-stores').innerText(), /shorten the next fever/);
      await page.locator('#still-deliver-mara').click();
      const again = await page.evaluate(() => {
        const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent);
        return { save: JSON.parse(localStorage.getItem('hearthvale-v1')), toasts };
      });
      assert.equal(again.save.ward, 1);
      assert.equal(again.save.kinship, 4);
      assert.equal(again.save.stores.salve, 0);
      assert.ok(again.toasts.some(t => t.includes('Need 2 more 🧴 salve')));
    });

    await once('escape closes the board', BASE_SAVE, async page => {
      await jump(page, 34, 22);
      await page.locator('#p-still').click();
      await page.locator('#stillroom.show').waitFor();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('stillroom').classList.contains('show'));
      assert.equal(await page.locator('#panel.show').count(), 0);
    });

    await once('a worked feverfew plot banks herbs', {
      ...BASE_SAVE,
      _prodAbs: undefined,
      res: { wood: 40, stone: 20, food: 40, gold: 25 },
      buildings: [
        { id: 1, type: 'farm', tx: 28, ty: 21, done: true, level: 1, crop: 'feverfew' },
        { id: 2, type: 'stillroom', tx: 33, ty: 21, done: true, level: 1 },
      ],
    }, async page => {
      await page.locator('#speedctl button[data-sp="3"]').click();
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem('hearthvale-v1') || '{}');
        return s.stores && s.stores.herbs >= 3;
      }, null, { timeout: 20000 });
      await page.locator('#speedctl button[data-sp="0"]').click();
      const save = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
      assert.equal(save.stores.herbs % 3, 0);
      assert.equal(save.res.food, 40 - save.stores.herbs / 3);
      assert.equal(save.buildings.find(b => b.type === 'farm').crop, 'feverfew');
      assert.ok(save.res.food < 40);
    });

    await once('the board survives a reload', {
      ...BASE_SAVE,
      kinship: 3,
      deliveries: 3,
      crafted: 3,
      ward: 1,
      posts: { mara: 1, tomas: 1, nessa: 1 },
      asksFilled: { 'mara:kettle': 1, 'tomas:shuttle': 1, 'nessa:table': 1 },
      stores: { herbs: 2, fibre: 0, tea: 0, salve: 1, linen: 0, pie: 0 },
      buildings: [
        { id: 1, type: 'farm', tx: 28, ty: 21, done: true, level: 1, crop: 'flax' },
        { id: 2, type: 'stillroom', tx: 33, ty: 21, done: true, level: 1 },
      ],
    }, async (page, context) => {
      const raw = await page.evaluate(() => localStorage.getItem('hearthvale-v1'));
      const kept = JSON.parse(raw);
      assert.equal(kept.kinship, 3);
      assert.equal(kept.stores.salve, 1);
      assert.equal(kept.buildings.find(b => b.type === 'farm').crop, 'flax');
      const again = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page2 = await again.newPage();
      page2.on('pageerror', error => errors.push('reload ' + error));
      await page2.addInitScript(saved => localStorage.setItem('hearthvale-v1', saved), raw);
      await page2.goto(BASE + '/hearthvale.html', { waitUntil: 'domcontentloaded' });
      const mini = await page2.locator('#minimap').boundingBox();
      await page2.mouse.click(mini.x + mini.width * 34 / 56, mini.y + mini.height * 22 / 42);
      await page2.mouse.click(640, 450);
      await page2.locator('#p-still').click();
      assert.match(await page2.locator('#still-flavor').innerText(), /^Known · 3 goodwill/);
      assert.match(await page2.locator('#still-stores').innerText(), /2 feverfew/);
      assert.match(await page2.locator('#still-stores').innerText(), /1 salve/);
      assert.match(await page2.locator('#still-stores').innerText(), /shorten the next fever/);
      await again.close();
    });

    if (errors.length) throw new Error(errors.join('\n'));
    console.log('hvalestill: ok');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

/* Lantern Hollow: a sealed northern grove, a seasonal warden, companion talk. */
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
  kinship: 0,
  stores: { herbs: 0, fibre: 0, tea: 0, salve: 0, linen: 0, pie: 0 },
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  const openHollow = async page => {
    await page.locator('#menu-btn').click();
    await page.locator('#m-hollow').click();
    await page.locator('#hollow.show').waitFor();
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

    await run('the briar stays shut for a stranger', BASE_SAVE, async page => {
      const pad = await page.evaluate(() => window.HearthvaleAI.pad());
      assert.ok(pad && pad.w === 5 && pad.h === 4);
      await openHollow(page);
      assert.equal(await page.locator('#hollow-seal').getAttribute('data-open'), '0');
      assert.equal(await page.locator('#hollow-warden').getAttribute('data-id'), 'hart');
      assert.equal(await page.locator('#hollow-warden').getAttribute('data-season'), 'Spring');
      await page.locator('#hollow-open').click();
      const snap = await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('hearthvale-v1'));
        const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent);
        return { open: (save.hollow && save.hollow.open) || 0, toasts };
      });
      assert.equal(snap.open, 0);
      assert.ok(snap.toasts.some(t => t.includes('knows you (3 goodwill)')));
    });

    await run('known valleys part the briar and can miss the offering', {
      ...BASE_SAVE,
      kinship: 3,
      res: { wood: 40, stone: 20, food: 4, gold: 10 },
    }, async page => {
      await openHollow(page);
      await page.locator('#hollow-open').click();
      assert.equal(await page.locator('#hollow-seal').getAttribute('data-open'), '1');
      assert.equal(await page.locator('#hollow-resolve').getAttribute('data-resolve'), '3');
      const cost = await page.locator('#hollow-offer').evaluate(el => ({
        tea: el.dataset.tea, herbs: el.dataset.herbs, pie: el.dataset.pie,
      }));
      assert.equal(cost.tea, '1');
      assert.equal(cost.herbs, '1');
      assert.equal(cost.pie, '0');
      await page.locator('#hollow-offer').click();
      const refused = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent));
      assert.ok(refused.some(t => t.includes('Need')));
      await page.locator('#hollow-talk-wren').click();
      await page.waitForFunction(() => /will not walk into the hollow hungry/.test(document.getElementById('hollow-line').textContent));
      assert.equal(await page.locator('#hollow-resolve').getAttribute('data-resolve'), '3');
      const ctx = await page.evaluate(() => window.HearthvaleAI.context());
      assert.equal(ctx.day, 4);
      assert.equal(ctx.food, 4);
      assert.equal(ctx.season, 'Spring');
      assert.equal(ctx.hollow, true);
      assert.equal(ctx.warden, 'hart');
      const ids = await page.evaluate(() => window.HearthvaleAI.companions().map(c => c.id));
      assert.deepEqual(ids, ['wren', 'ada', 'sable']);
    });

    await run('a companion and an offering see the hart off', {
      ...BASE_SAVE,
      kinship: 3,
      res: { wood: 40, stone: 20, food: 20, gold: 25 },
      stores: { herbs: 2, fibre: 0, tea: 2, salve: 0, linen: 0, pie: 0 },
    }, async page => {
      await openHollow(page);
      await page.locator('#hollow-open').click();
      await page.locator('#hollow-talk-wren').click();
      await page.waitForFunction(() => /I will stand with you/.test(document.getElementById('hollow-line').textContent));
      assert.equal(await page.locator('#hollow-resolve').getAttribute('data-resolve'), '2');
      const discounted = await page.locator('#hollow-offer').evaluate(el => ({ tea: el.dataset.tea, herbs: el.dataset.herbs }));
      assert.equal(discounted.tea, '0');
      assert.equal(discounted.herbs, '1');
      await page.locator('#hollow-offer').click();
      const snap = await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('hearthvale-v1'));
        return { save, resolve: document.getElementById('hollow-resolve').dataset.resolve };
      });
      assert.equal(snap.save.hollow.faced['1-Spring'], 1);
      assert.equal(snap.save.stores.herbs, 1);
      assert.equal(snap.save.stores.tea, 2);
      assert.equal(snap.save.happy, 56);
      assert.equal(snap.resolve, '0');
    });

    await run('three companions fell the warden without an offering', {
      ...BASE_SAVE,
      kinship: 3,
      res: { wood: 20, stone: 20, food: 20, gold: 30 },
      stores: { herbs: 2, fibre: 0, tea: 2, salve: 0, linen: 0, pie: 0 },
    }, async page => {
      await openHollow(page);
      await page.locator('#hollow-open').click();
      await page.locator('#hollow-talk-wren').click();
      await page.waitForFunction(() => /stand with you/.test(document.getElementById('hollow-line').textContent));
      await page.locator('#hollow-talk-ada').click();
      await page.waitForFunction(() => /watch is with you/.test(document.getElementById('hollow-line').textContent));
      await page.locator('#hollow-talk-sable').click();
      await page.waitForFunction(() => {
        const save = JSON.parse(localStorage.getItem('hearthvale-v1'));
        return save.hollow && save.hollow.faced && save.hollow.faced['1-Spring'] === 1;
      });
      const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
      assert.equal(snap.stores.tea, 2);
      assert.equal(snap.stores.herbs, 2);
      assert.equal(snap.happy, 56);
      assert.equal(snap.res.wood, 20);
      assert.equal(snap.res.gold, 30);
    });

    await run('the booth can speak for a companion', {
      ...BASE_SAVE,
      kinship: 3,
      res: { wood: 20, stone: 20, food: 20, gold: 30 },
    }, async page => {
      await openHollow(page);
      await page.locator('#hollow-open').click();
      await page.evaluate(() => {
        window.ArcadeAI = {
          createStubProvider: () => ({
            talk: (req) => Promise.resolve({
              provider: 'stub', game: 'hearthvale', npcId: req.npcId,
              name: 'Elder Wren', role: 'Hearth', icon: '🔥', mood: 'soft',
              line: 'BOOTH:' + req.npcId + ':' + req.context.warden,
            }),
          }),
        };
      });
      await page.locator('#hollow-talk-wren').click();
      await page.waitForFunction(() => document.getElementById('hollow-line').textContent === 'BOOTH:wren:hart');
      assert.equal(await page.locator('#hollow-resolve').getAttribute('data-resolve'), '2');
      const said = await page.evaluate(() => window.HearthvaleAI.talk('ada'));
      assert.equal(said.line, 'BOOTH:ada:hart');
      assert.equal(said.provider, 'stub');
    });

    await run('turning away costs cheer and closes the season', {
      ...BASE_SAVE,
      kinship: 3,
      happy: 50,
    }, async page => {
      await openHollow(page);
      await page.locator('#hollow-open').click();
      await page.locator('#hollow-away').click();
      const fled = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
      assert.equal(fled.hollow.fled, '1-Spring');
      assert.equal(fled.happy, 44);
      await page.locator('#hollow-offer').waitFor({ state: 'hidden' });
      assert.match(await page.locator('#hollow-line').innerText(), /raked the lane/);
    });

    await run('phone can part the briar', {
      ...BASE_SAVE,
      kinship: 3,
    }, async page => {
      await page.locator('#menu-btn').tap();
      await page.locator('#m-hollow').tap();
      await page.locator('#hollow.show').waitFor();
      const measure = async sel => page.locator(sel).evaluate(el => {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        return { h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right, iw: innerWidth, ih: innerHeight };
      });
      await page.locator('#hollow-open').tap();
      for (const sel of ['#hollow-offer', '#hollow-talk-wren', '#hollow-away', '#hollow-close']) {
        const box = await measure(sel);
        assert.ok(box.h >= 44, sel + ' height ' + box.h);
        assert.ok(box.top >= -1 && box.bottom <= box.ih + 1, sel + ' y ' + JSON.stringify(box));
        assert.ok(box.left >= -1 && box.right <= box.iw + 1, sel + ' x');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, 'horizontal scroll ' + overflow);
    }, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    if (errors.length) throw new Error(errors.join('\n'));
    console.log('hvalehollow: ok');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

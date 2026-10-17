/* Hearthvale townsfolk talk in the valley, with a local line bank. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

const BASE_SAVE = {
  seed: 12345, time: 8, seenIntro: true, muted: true, happy: 50,
  townName: 'Talkvale', _nextId: 5, nextTraderDay: 100, nextEventDay: 100,
  nextRaidDay: 100, difficulty: 'cozy', day: 4, goalIndex: 0,
  _prodAbs: 999999,
  res: { wood: 40, stone: 20, food: 30, gold: 25 },
  villagers: [{ id: 1, name: 'Pip', tx: 30, ty: 30, jobId: null, xp: 0, color: '#c4574a', ph: 0 }],
  buildings: [],
  kinship: 0,
  stores: { herbs: 0, fibre: 0, tea: 0, salve: 0, linen: 0, pie: 0 },
};

const FOLK = ['wren', 'ada', 'sable', 'mira', 'bram', 'hazel', 'odo'];

function overlaps(a, b) {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  try {
    const run = async (name, seed, check, viewport) => {
      const context = await browser.newContext(viewport || { viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      const bad = [];
      let armed = false;
      page.on('pageerror', error => errors.push(name + ' ' + error));
      page.on('request', req => {
        if (!armed) return;
        const url = req.url();
        if (/\/api\/ai\b/.test(url)) bad.push(url);
        else if (/^https?:/i.test(url) && url.indexOf(BASE) !== 0 && !/fonts\.(googleapis|gstatic)\.com/.test(url)) bad.push(url);
      });
      await page.addInitScript(saved => {
        localStorage.setItem('hearthvale-v1', JSON.stringify(saved));
      }, seed);
      await page.goto(BASE + '/hearthvale.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#game');
      await page.waitForFunction(() => window.HearthvaleAI && window.HearthvaleAI.townsfolk);
      await check(page, () => { armed = true; }, bad);
      assert.deepEqual(bad, [], name + ' called out: ' + bad.join(' '));
      console.log('PASS ' + name);
      await context.close();
    };

    await run('the green keeps seven talkers and the hollow companions', BASE_SAVE, async (page, arm) => {
      arm();
      const snap = await page.evaluate(async () => {
        window.ArcadeAI = {};
        const folk = window.HearthvaleAI.townsfolk().map(p => p.id);
        const companions = window.HearthvaleAI.companions().map(p => p.id);
        const ctx = window.HearthvaleAI.context();
        const said = await window.HearthvaleAI.talk('wren');
        return { folk, companions, ctx, said };
      });
      assert.deepEqual(snap.folk, FOLK);
      assert.deepEqual(snap.companions, ['wren', 'ada', 'sable']);
      assert.equal(snap.ctx.season, 'Spring');
      assert.equal(snap.ctx.tier, 'stranger');
      assert.equal(snap.ctx.hollowState, 'shut');
      assert.equal(snap.ctx.quest, 'Build two cottages');
      assert.equal(snap.ctx.hollow, false);
      assert.equal(snap.said.provider, 'local');
      assert.match(snap.said.line, /Spring is in the hearth smoke/);
      assert.match(snap.said.line, /stranger at the hearth/);
      assert.match(snap.said.line, /Build two cottages/);
      assert.match(snap.said.line, /briar still keeps the Lantern Hollow/);
    });

    await run('winter kin on a farm quest with a blessed hollow', {
      ...BASE_SAVE,
      day: 19,
      kinship: 10,
      goalIndex: 1,
      hollow: { open: 1, faced: { '1-Winter': 1 }, fled: '', counsel: {}, counselKey: '', announced: '', talks: 0 },
    }, async (page, arm) => {
      arm();
      const said = await page.evaluate(() => {
        window.ArcadeAI = {};
        return window.HearthvaleAI.talk('wren');
      });
      assert.equal(said.provider, 'local');
      assert.match(said.line, /Winter sits in the hearth chimney/);
      assert.match(said.line, /Kin of the hearth/);
      assert.match(said.line, /Build a farm to grow food/);
      assert.match(said.line, /blessing rests on the hearth lane/);
      const ctx = await page.evaluate(() => window.HearthvaleAI.context());
      assert.equal(ctx.season, 'Winter');
      assert.equal(ctx.tier, 'kin');
      assert.equal(ctx.hollowState, 'blessed');
      assert.equal(ctx.hollow, true);
      assert.equal(ctx.warden, 'frost');
    });

    await run('the hollow can be waiting', {
      ...BASE_SAVE,
      kinship: 3,
      hollow: { open: 1, faced: {}, fled: '', counsel: {}, counselKey: '', announced: '', talks: 0 },
    }, async (page, arm) => {
      arm();
      const said = await page.evaluate(() => {
        window.ArcadeAI = {};
        return window.HearthvaleAI.talk('ada');
      });
      assert.match(said.line, /Lantern Hollow is waiting/);
      assert.match(said.line, /The watch knows your step/);
      assert.equal((await page.evaluate(() => window.HearthvaleAI.context())).tier, 'known');
    });

    await run('turning from the hollow is in the line', {
      ...BASE_SAVE,
      kinship: 6,
      hollow: { open: 1, faced: {}, fled: '1-Spring', counsel: {}, counselKey: '', announced: '', talks: 0 },
    }, async (page, arm) => {
      arm();
      const said = await page.evaluate(() => {
        window.ArcadeAI = {};
        return window.HearthvaleAI.talk('sable');
      });
      assert.match(said.line, /raked the lane/);
      assert.match(said.line, /Trusted at the stall/);
      assert.match(said.line, /Spring roads dry/);
    });

    await run('each neighbour has their own line', {
      ...BASE_SAVE,
      day: 7,
      goalIndex: 99,
    }, async (page, arm) => {
      arm();
      const lines = await page.evaluate(async () => {
        window.ArcadeAI = {};
        const ids = window.HearthvaleAI.townsfolk().map(p => p.id);
        const out = {};
        for (const id of ids) out[id] = (await window.HearthvaleAI.talk(id)).line;
        return out;
      });
      assert.match(lines.mira, /Summer dough|Summer ovens/);
      assert.match(lines.bram, /Summer timber/);
      assert.match(lines.hazel, /Summer herbs/);
      assert.match(lines.odo, /Summer river/);
      const unique = new Set(Object.values(lines));
      assert.equal(unique.size, 7);
      assert.match(lines.wren, /The town is thriving/);
    });

    await run('a dead booth falls back and a wrong speaker is refused', BASE_SAVE, async (page, arm) => {
      arm();
      const snap = await page.evaluate(async () => {
        window.ArcadeAI = { createStubProvider: () => ({ talk: () => Promise.reject(new Error('down')) }) };
        const fallen = await window.HearthvaleAI.talk('mira');
        window.ArcadeAI = {
          createStubProvider: () => ({
            talk: () => Promise.resolve({
              provider: 'stub', npcId: 'wren', name: 'Elder Wren', role: 'Hearth', icon: '🔥', mood: 'soft', line: 'STUB-WREN',
            }),
          }),
        };
        const wrong = await window.HearthvaleAI.talk('mira');
        const right = await window.HearthvaleAI.talk('wren');
        return { fallen, wrong, right };
      });
      assert.equal(snap.fallen.provider, 'local');
      assert.match(snap.fallen.line, /Spring dough/);
      assert.equal(snap.wrong.provider, 'local');
      assert.match(snap.wrong.line, /Spring dough/);
      assert.equal(snap.right.line, 'STUB-WREN');
      assert.equal(snap.right.provider, 'stub');
    });

    await run('boothTalk speaks and three neighbours open the sheet', BASE_SAVE, async (page, arm) => {
      await page.evaluate(() => window.HearthvaleAI.focus('wren'));
      await page.waitForFunction(() => {
        const el = document.getElementById('vale-folk-wren');
        return el && !el.hidden;
      });
      arm();
      await page.evaluate(() => {
        window.ArcadeAI = {
          boothTalk: (req) => Promise.resolve({
            provider: 'booth', game: 'hearthvale', npcId: req.npcId,
            name: req.npcId, role: 'Booth', icon: '🔥', mood: 'soft',
            line: 'BOOTH:' + req.npcId + ':' + req.context.season + ':' + req.context.hollowState,
          }),
        };
      });
      const controls = ['.ea-back', '#menu-btn', '#buildbar', '#buildtabs', '#goals', '#minimap'];
      for (const id of ['wren', 'ada', 'sable']) {
        await page.evaluate(npc => window.HearthvaleAI.focus(npc), id);
        const btn = page.locator('#vale-folk-' + id);
        await btn.waitFor();
        const box = await btn.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { w: r.width, h: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
        });
        assert.ok(box.w >= 44 && box.h >= 44, id + ' tap ' + box.w + 'x' + box.h);
        assert.ok(box.top >= -1 && box.left >= -1 && box.right <= 1281 && box.bottom <= 901);
        await btn.click();
        await page.waitForFunction(npc => {
          const sheet = document.getElementById('vale-talk');
          return sheet && !sheet.hidden && document.getElementById('vale-talk-line').textContent === 'BOOTH:' + npc + ':Spring:shut';
        }, id);
      }
      const layout = await page.evaluate(sels => {
        const sheet = document.getElementById('vale-talk').getBoundingClientRect();
        const blocks = sels.map(sel => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return null;
          return { sel, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
        }).filter(Boolean);
        const line = getComputedStyle(document.getElementById('vale-talk-line'));
        const name = getComputedStyle(document.getElementById('vale-talk-name'));
        const close = document.getElementById('vale-talk-close').getBoundingClientRect();
        return {
          sheet: { top: sheet.top, left: sheet.left, right: sheet.right, bottom: sheet.bottom },
          blocks,
          font: line.fontSize,
          family: name.fontFamily,
          closeH: close.height,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      }, controls);
      assert.ok(parseFloat(layout.font) >= 15);
      assert.match(layout.family, /Outfit/i);
      assert.ok(layout.closeH >= 44);
      assert.ok(layout.overflow <= 1);
      for (const block of layout.blocks) {
        assert.ok(!overlaps(layout.sheet, block), 'sheet covers ' + block.sel);
      }
      const games = await page.evaluate(() => {
        const el = document.querySelector('.ea-back');
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(hit && (hit === el || el.contains(hit)));
      });
      assert.equal(games, true);
      await page.locator('#vale-talk-close').click();
      await page.waitForFunction(() => document.getElementById('vale-talk').hidden);
      await page.evaluate(() => window.HearthvaleAI.focus('mira'));
      await page.locator('#vale-folk-mira').click();
      await page.waitForFunction(() => !document.getElementById('vale-talk').hidden);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('vale-talk').hidden);
    });

    await run('phone can tap a neighbour without covering the controls', BASE_SAVE, async (page, arm) => {
      arm();
      await page.evaluate(() => {
        window.ArcadeAI = {};
        window.HearthvaleAI.focus('hazel');
      });
      const btn = page.locator('#vale-folk-hazel');
      await page.waitForFunction(() => {
        const el = document.getElementById('vale-folk-hazel');
        return el && !el.hidden;
      });
      const box = await btn.evaluate(el => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right, iw: innerWidth, ih: innerHeight };
      });
      assert.ok(box.w >= 44 && box.h >= 44, 'hazel ' + JSON.stringify(box));
      assert.ok(box.top >= -1 && box.bottom <= box.ih + 1 && box.left >= -1 && box.right <= box.iw + 1);
      await btn.tap();
      await page.waitForFunction(() => /Spring feverfew/.test(document.getElementById('vale-talk-line').textContent || ''));
      const layout = await page.evaluate(() => {
        const sheet = document.getElementById('vale-talk').getBoundingClientRect();
        const line = getComputedStyle(document.getElementById('vale-talk-line'));
        const name = getComputedStyle(document.getElementById('vale-talk-name'));
        const close = document.getElementById('vale-talk-close').getBoundingClientRect();
        const again = document.getElementById('vale-talk-again').getBoundingClientRect();
        const sels = ['.ea-back', '#menu-btn', '#touch-pause', '#buildbar', '#buildtabs', '#goals', '#minimap', '#zoom-ctl'];
        const blocks = sels.map(sel => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cs = getComputedStyle(el);
          if (cs.display === 'none') return null;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return null;
          return { sel, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
        }).filter(Boolean);
        return {
          sheet: { top: sheet.top, left: sheet.left, right: sheet.right, bottom: sheet.bottom },
          blocks,
          font: parseFloat(line.fontSize),
          family: name.fontFamily,
          closeH: close.height,
          againH: again.height,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          iw: innerWidth,
          ih: innerHeight,
        };
      });
      assert.ok(layout.font >= 16);
      assert.match(layout.family, /Outfit/i);
      assert.ok(layout.closeH >= 44 && layout.againH >= 44);
      assert.ok(layout.sheet.top >= -1 && layout.sheet.bottom <= layout.ih + 1);
      assert.ok(layout.sheet.left >= -1 && layout.sheet.right <= layout.iw + 1);
      assert.ok(layout.overflow <= 1);
      for (const block of layout.blocks) assert.ok(!overlaps(layout.sheet, block), 'sheet covers ' + block.sel);
      const menuOwns = await page.evaluate(() => {
        const el = document.getElementById('menu-btn');
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(hit && (hit === el || el.contains(hit)));
      });
      assert.equal(menuOwns, true);
    }, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    if (errors.length) throw new Error(errors.join('\n'));
    console.log('hvalefolk: ok');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

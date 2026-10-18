/* HUD fit — booth, announcer, and the day rail.
 *
 * Phone and desktop, for Hearthvale, Voxel Isle, and Grow Op:
 *   the booth button does not cover the minimap,
 *   the announcer does not cover the build or action bar,
 *   the day chip does not cover the time controls.
 * The announcer sits above that bar, ignores taps except its own
 * close button, and leaves after about four seconds.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const overlaps = (a, b) => {
  if (!a || !b || a.hidden || b.hidden || a.w < 2 || b.w < 2) return false;
  return !(a.right <= b.x + 0.5 || a.x >= b.right - 0.5 || a.bottom <= b.y + 0.5 || a.y >= b.bottom - 0.5);
};

const measure = () => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const hidden = !!el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2;
    return {
      hidden, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
      pe: cs.pointerEvents,
    };
  };
  const bars = ['#buildbar', '#hotbar', '#lab-tray', '#buildBar'].map(box).filter(b => b && !b.hidden && b.y > innerHeight * 0.4);
  const ticker = document.getElementById('arcade-ai-ticker');
  const close = document.getElementById('arcade-ai-ticker-close');
  const name = document.getElementById('resumeName');
  const chip = document.getElementById('resumeChip');
  const hud = document.getElementById('hud') || document.getElementById('topbar');
  let nameFit = null;
  if (name && chip && !chip.hidden) {
    const nr = name.getBoundingClientRect();
    const cr = chip.getBoundingClientRect();
    const cs = getComputedStyle(name);
    nameFit = {
      ellipsis: cs.textOverflow === 'ellipsis' && cs.overflowX === 'hidden',
      inside: nr.right <= cr.right + 1 && cr.right <= innerWidth + 1 && cr.left >= -1,
    };
  }
  const stray = [];
  document.querySelectorAll('#hud .res, #topbar .chip, #cash-hud, #heat-hud, #goal-hud, #resumeChip').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || el.hidden) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const past = r.right > innerWidth + 1 || r.left < -1;
    if (!past) return;
    let p = el.parentElement;
    let scrolled = false;
    while (p && p !== document.body) {
      const ox = getComputedStyle(p).overflowX;
      const pr = p.getBoundingClientRect();
      if ((ox === 'auto' || ox === 'scroll') && pr.left >= -1 && pr.right <= innerWidth + 1) {
        scrolled = true;
        break;
      }
      p = p.parentElement;
    }
    if (!scrolled) stray.push(el.id || el.className);
  });
  const card = document.querySelector('#buildbar .btn, #hotbar .slot, #lab-tray button');
  let cardHit = null;
  if (card) {
    const r = card.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 18));
    cardHit = hit ? (hit.id || hit.className || hit.tagName) : null;
  }
  const mini = document.getElementById('minimap');
  let miniHit = null;
  if (mini) {
    const r = mini.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    miniHit = hit ? (hit.id || hit.tagName) : null;
  }
  return {
    booth: box('#arcade-ai-launch'),
    mini: box('#minimap'),
    ticker: box('#arcade-ai-ticker'),
    close: close ? getComputedStyle(close).pointerEvents : null,
    clock: box('#clock'),
    speed: box('#speedctl'),
    bars,
    nameFit,
    stray,
    doc: document.documentElement.scrollWidth,
    iw: innerWidth,
    cardHit,
    miniHit,
    tickerOn: !!(ticker && !ticker.hidden),
  };
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  const open = async (url, viewport, init) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(url + ' ' + viewport.width + ' ' + String(e).slice(0, 180)));
    await page.addInitScript(init);
    await page.goto(BASE + url, { waitUntil: 'load' });
    return { ctx, page };
  };

  const games = [
    {
      name: 'Hearthvale',
      url: '/hearthvale.html',
      init: () => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 6, time: 10, seenIntro: true,
          townName: 'Riverside of the Long Green', happy: 62, goalIndex: 1, _nextId: 8,
          res: { wood: 86, stone: 40, food: 52, gold: 18 },
          buildings: [],
          villagers: [{ id: 1, tx: 20, ty: 20, name: 'Asha' }, { id: 2, tx: 21, ty: 20, name: 'Bren' }],
        }));
      },
    },
    {
      name: 'Voxel Isle',
      url: '/voxel-garden.html',
      init: () => {
        localStorage.setItem('voxel-garden-v1', JSON.stringify({
          v: 1, seed: 7, savedAt: Date.now(),
          state: { helpSeen: true, muted: true, musicOff: true, coins: 120, level: 2, xp: 10, questIdx: 0, buildings: {}, goods: {} },
          edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
        }));
      },
    },
    {
      name: 'Grow Op',
      url: '/drug-lab.html',
      init: () => {
        localStorage.setItem('growop-intro-seen', '1');
        localStorage.setItem('drug-lab-v1', JSON.stringify({ cash: 1200, difficulty: 'careful', goalIndex: 0 }));
      },
    },
  ];

  for (const game of games) {
    for (const [w, h] of [[390, 844], [1280, 800]]) {
      const { ctx, page } = await open(game.url, { width: w, height: h }, game.init);
      const label = `${game.name} ${w}×${h}`;
      try {
        await page.waitForFunction(() => {
          const t = document.getElementById('arcade-ai-ticker');
          return t && !t.hidden && t.getBoundingClientRect().height > 8;
        }, null, { timeout: 4000 });
      } catch (e) {
        ok(false, `${label}: announcer appears`);
        await ctx.close();
        continue;
      }
      const data = await page.evaluate(measure);
      ok(!overlaps(data.booth, data.mini), `${label}: booth misses the minimap`);
      if (data.mini && !data.mini.hidden) {
        ok(data.miniHit !== 'arcade-ai-launch', `${label}: minimap centre is not the booth (${data.miniHit})`);
      }
      const toastHits = (data.bars || []).some(bar => overlaps(data.ticker, bar));
      ok(data.tickerOn && !toastHits, `${label}: announcer clears the build bar`);
      ok(data.ticker && data.ticker.pe === 'none', `${label}: announcer ignores taps`);
      ok(data.close === 'auto', `${label}: close button takes the tap`);
      if (data.cardHit) ok(data.cardHit !== 'arcade-ai-ticker' && data.cardHit !== 'arcade-ai-ticker-close', `${label}: build card owns its tap (${data.cardHit})`);
      const bothRails = data.clock && data.speed && !data.clock.hidden && !data.speed.hidden;
      ok(!overlaps(data.clock, data.speed), `${label}: day chip misses the time controls`);
      if (game.name === 'Hearthvale' && w === 1280) {
        const gap = bothRails ? data.speed.x - data.clock.right : -1;
        ok(bothRails && gap >= 6, `${label}: day chip and time controls sit side by side (gap ${Math.round(gap)}px)`);
      }
      if (data.nameFit) ok(data.nameFit.ellipsis && data.nameFit.inside, `${label}: town title ellipsizes inside the viewport`);
      ok(!data.stray.length && data.doc <= data.iw + 1, `${label}: top bar stays inside the viewport${data.stray.length ? ' (' + data.stray.join(', ') + ')' : ''}`);

      try {
        await page.waitForFunction(() => {
          const t = document.getElementById('arcade-ai-ticker');
          return t && t.hidden && t.dataset.shownAt;
        }, null, { timeout: 12000 });
      } catch (e) { /* reported below */ }
      const life = await page.evaluate(() => {
        const t = document.getElementById('arcade-ai-ticker');
        if (!t || !t.hidden || !t.dataset.shownAt) return -1;
        return Date.now() - Number(t.dataset.shownAt);
      });
      ok(life >= 3000 && life <= 6000, `${label}: announcer leaves after about 4s (${life}ms)`);
      await ctx.close();
    }
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ' ' + errs[0] : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

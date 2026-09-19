/*
 * FLAGSHIP — Voxel Isle return chrome.
 *
 * The isle already kept the garden. What it did not keep was the
 * arcade's exit language, or a tablet layout that left the quest
 * card sitting on the tool cluster, or any sign you had come back.
 *
 *  A. The shared Games pill is the exit — not a custom ← ARCADE link.
 *  B. Help's one play CTA is Let's grow; Games sits beside it.
 *  C. A kept isle paints the resume chip with the day and level.
 *  D. A fresh isle leaves that chip hidden.
 *  E. 768×700 drops the garden goal above the hotbar so it no longer
 *     intersects the tool cluster.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production page.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errs = [];

  const open = async (viewport, init) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    if (init) await page.addInitScript(init);
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForTimeout(2800);
    return { ctx, page };
  };

  // A + B
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    const chrome = await page.evaluate(() => {
      const backs = [...document.querySelectorAll('a.ea-back')];
      const arcade = [...document.querySelectorAll('a')].filter(a => /ARCADE/i.test(a.textContent || ''));
      return {
        games: backs.length,
        hrefs: backs.map(a => a.getAttribute('href')),
        words: backs.map(a => (a.textContent || '').replace(/\s+/g, ' ').trim()),
        arcade: arcade.length,
      };
    });
    ok(chrome.games >= 1 && chrome.hrefs.every(h => h === '/') && chrome.arcade === 0,
      'shared Games pill is the exit — no custom ← ARCADE link');

    await page.click('#helpBtn');
    await page.waitForTimeout(200);
    const help = await page.evaluate(() => {
      const ov = document.getElementById('helpOv');
      const close = document.getElementById('helpClose');
      const hub = ov ? ov.querySelector('a.ea-back') : null;
      return {
        open: ov && ov.classList.contains('open'),
        grow: close && close.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
      };
    });
    const stacked = await page.evaluate(() => {
      const grow = document.getElementById('helpClose');
      const first = document.querySelector('#helpOv li');
      if (!grow || !first) return false;
      return grow.getBoundingClientRect().bottom <= first.getBoundingClientRect().top + 2;
    });
    ok(help.open && help.grow === "Let's grow" && help.hub === '/' && stacked,
      "help's one play CTA is Let's grow above the how-to; Games sits beside it");
    await ctx.close();
  }

  // C
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 7, savedAt: Date.now(),
        state: {
          day: 4, level: 3, coins: 80, totalEarned: 240, xp: 20, time: 30,
          helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {},
        },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    const chip = await page.evaluate(() => {
      const el = document.getElementById('resumeChip');
      return {
        hidden: !el || el.hidden || el.style.display === 'none',
        text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
      };
    });
    ok(!chip.hidden && /Day 4/.test(chip.text) && /LV 3/.test(chip.text),
      'a kept isle paints the resume chip with the day and level');
    await ctx.close();
  }

  // D
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.removeItem('voxel-garden-v1');
    });
    const fresh = await page.evaluate(() => {
      const el = document.getElementById('resumeChip');
      return !el || el.hidden || getComputedStyle(el).display === 'none';
    });
    ok(fresh, 'a fresh isle leaves the resume chip hidden');
    await ctx.close();
  }

  // E
  {
    const { ctx, page } = await open({ width: 768, height: 700 }, () => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    const geo = await page.evaluate(() => {
      const q = document.getElementById('quests');
      const back = document.getElementById('back');
      const games = document.querySelector('#back a.ea-back');
      if (!q || !back || !games) return { ok: false };
      const qb = q.getBoundingClientRect();
      const bb = back.getBoundingClientRect();
      const overlap = !(qb.right < bb.left || qb.left > bb.right || qb.bottom < bb.top || qb.top > bb.bottom);
      return {
        ok: true,
        overlap,
        questsLow: qb.top > innerHeight * 0.45,
        gamesOn: games.getBoundingClientRect().bottom > 0 && games.getBoundingClientRect().top < innerHeight,
      };
    });
    ok(geo.ok && !geo.overlap && geo.questsLow && geo.gamesOn,
      '768×700 garden goal sits above the hotbar, not on the tool cluster');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/*
 * FLAGSHIP — Voxel Isle return chrome leftovers.
 *
 * #996 put Games on help and moved the garden goal. The leftover
 * sheets still trapped you, a corrupt garden rose in silence, and
 * the chip tray sat on the hotbar.
 *
 *  A. The shared Games pill is the exit — not a custom ← ARCADE link.
 *  B. Help's one play CTA is Let's grow; Games sits beside it.
 *  C. A kept isle paints the resume chip with the day and level.
 *  D. A fresh isle leaves that chip hidden.
 *  E. 768×700 drops the garden goal above the hotbar so it no longer
 *     intersects the tool cluster.
 *  F. Achievements and Almanac carry Games beside Back to the garden.
 *  G. The Shore carries Games.
 *  H. A corrupt garden paints the unread chip and still boots.
 *  I. A kept isle offers New isle on help.
 *  J. 768×700 keeps the chip tray above the hotbar.
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

  // F
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.click('#achBtn');
    await page.waitForTimeout(200);
    const ach = await page.evaluate(() => {
      const ov = document.getElementById('achOv');
      const close = document.getElementById('achClose');
      const hub = ov && ov.querySelector('a.ea-back');
      const first = ov && ov.querySelector('.ach');
      return {
        open: ov && ov.classList.contains('open'),
        back: close && close.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
        stacked: !!(close && first && close.getBoundingClientRect().bottom <= first.getBoundingClientRect().top + 2),
      };
    });
    ok(ach.open && ach.back === 'Back to the garden' && ach.hub === '/' && ach.stacked,
      'Achievements is Back to the garden plus Games above the list');
    await page.click('#achClose');
    await page.waitForTimeout(80);
    await page.click('#almanacBtn');
    await page.waitForTimeout(200);
    const alm = await page.evaluate(() => {
      const ov = document.getElementById('almanacOv');
      const close = document.getElementById('almClose');
      const hub = ov && ov.querySelector('a.ea-back');
      return {
        open: ov && ov.classList.contains('open'),
        back: close && close.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
      };
    });
    ok(alm.open && alm.back === 'Back to the garden' && alm.hub === '/',
      'Almanac is Back to the garden plus Games');
    await ctx.close();
  }

  // G
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.click('#chain-btn');
    await page.waitForTimeout(200);
    const shore = await page.evaluate(() => {
      const m = document.getElementById('chain-modal');
      const hub = m && m.querySelector('a.ea-back');
      return {
        open: m && m.classList.contains('open'),
        hub: hub && hub.getAttribute('href'),
      };
    });
    ok(shore.open && shore.hub === '/', 'The Shore carries Games');
    await ctx.close();
  }

  // H
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('voxel-garden-v1', '{"v":99,"broken":true}');
    });
    const bad = await page.evaluate(() => {
      const el = document.getElementById('resumeChip');
      return {
        hidden: !el || el.hidden || getComputedStyle(el).display === 'none',
        text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
        kept: localStorage.getItem('voxel-garden-v1'),
      };
    });
    ok(!bad.hidden && /could not be read/.test(bad.text) && !bad.kept,
      'a corrupt garden paints the unread chip and drops the blob');
    await ctx.close();
  }

  // I — plant the garden after first paint so a reload cannot re-seed it
  {
    const { ctx, page } = await open({ width: 1280, height: 800 });
    await page.evaluate(() => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 7, savedAt: Date.now(),
        state: {
          day: 4, level: 3, coins: 80, totalEarned: 240, xp: 20, time: 30,
          helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {},
        },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(2800);
    const helpOpen = await page.evaluate(() => {
      const ov = document.getElementById('helpOv');
      return !!(ov && ov.classList.contains('open'));
    });
    if (!helpOpen) {
      await page.click('#helpBtn');
      await page.waitForTimeout(200);
    }
    const neu = await page.evaluate(() => {
      const btn = document.getElementById('helpNewIsle');
      return {
        on: !!(btn && !btn.hidden && getComputedStyle(btn).display !== 'none'),
        label: btn && btn.textContent.trim(),
      };
    });
    ok(neu.on && neu.label === 'New isle', 'a kept isle offers New isle on help');
    page.once('dialog', d => d.accept());
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }).catch(() => {}),
      page.click('#helpNewIsle'),
    ]);
    await page.waitForTimeout(2800);
    const after = await page.evaluate(() => {
      let data = null;
      try { data = JSON.parse(localStorage.getItem('voxel-garden-v1') || 'null'); } catch {}
      const el = document.getElementById('resumeChip');
      const dayHud = (document.getElementById('day') || {}).textContent || '';
      return {
        day: data && data.state ? data.state.day : 0,
        hud: dayHud,
        chipHidden: !el || el.hidden || getComputedStyle(el).display === 'none',
      };
    });
    ok(after.chipHidden && (after.day === 1 || after.day === 0) && /1/.test(after.hud),
      'New isle drops the kept garden');
    await ctx.close();
  }

  // J
  {
    const { ctx, page } = await open({ width: 768, height: 700 }, () => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, buildings: {}, goods: {} },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    const tray = await page.evaluate(() => {
      const t = document.getElementById('vox-tray');
      const h = document.getElementById('hotbar');
      if (!t || !h) return { ok: false };
      const tb = t.getBoundingClientRect();
      const hb = h.getBoundingClientRect();
      const overlap = !(tb.right < hb.left || tb.left > hb.right || tb.bottom < hb.top || tb.top > hb.bottom);
      return { ok: true, overlap, trayAbove: tb.bottom <= hb.top + 2 };
    });
    ok(tray.ok && !tray.overlap && tray.trayAbove,
      '768×700 chip tray sits above the hotbar');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

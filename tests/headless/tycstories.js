/*
 * Toast, bench, all-hands, anthem, and the docent live in #goal-hud.
 * That bar is pointer-events: none, so the office canvas ate the click.
 * Guest book, capsule, and mural already take the hit. These five
 * have to as well, and those three have to keep taking it.
 *
 *  A. The purses stay 60+30, 80+40, 90+45, 100+50, and 130+65.
 *     Guest, capsule, and mural stay 70+35, 110+55, and 120+60.
 *  B. A real pointer click (no force) hits each chip, not the canvas.
 *  C. Each click pays its purse once and a second click does not.
 *  D. The goal bar stays under the living-sky chip's z-index.
 *  Z. Zero page errors.
 *
 * Hook-free. Seeds the unlock tallies and clicks the production chips.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'tycoon/play.html'), 'utf8');
ok(/TOAST_BASE = 60, TOAST_PER = 30/.test(src)
  && /BENCH_BASE = 80, BENCH_PER = 40/.test(src)
  && /STORY_BASE = 90, STORY_PER = 45/.test(src)
  && /SONG_BASE = 100, SONG_PER = 50/.test(src)
  && /DOCENT_BASE = 130, DOCENT_PER = 65/.test(src),
  'toast, bench, story, anthem, and docent purses are unchanged');
ok(/GUEST_BASE = 70, GUEST_PER = 35/.test(src)
  && /CAPSULE_BASE = 110, CAPSULE_PER = 55/.test(src)
  && /MURAL_BASE = 120, MURAL_PER = 60/.test(src),
  'guest, capsule, and mural purses are unchanged');
ok(/#toast-chip, #bench-chip, #story-chip, #song-chip, #docent-chip \{\s*pointer-events: auto;/.test(src)
  && /#guest-chip, #capsule-chip, #mural-chip \{\s*pointer-events: auto;/.test(src),
  'the five story chips and the three lobby chips accept pointers');
const hud = src.slice(src.indexOf('#goal-hud {'), src.indexOf('#goal-hud {') + 900);
ok(/z-index:\s*8;/.test(hud) && !/z-index:\s*(2[4-9]|[3-9]\d|\d{3,})/.test(hud),
  'the goal bar stacks above the canvas and under the living-sky chip');

function seedStory() {
  localStorage.setItem('tycoon:tipsEnabled', '0');
  localStorage.setItem('startup-tycoon-v7', JSON.stringify({
    cash: 0, allTimeCash: 1, v: 7, savedAt: Date.now(), offlineRatePerSec: 0, ownedRooms: ['starter'],
  }));
  localStorage.setItem('tyc-portrait', JSON.stringify({ looks: 3 }));
  localStorage.setItem('tyc-anniversary', JSON.stringify({ toasts: 3 }));
  localStorage.setItem('tyc-guestbook', JSON.stringify({ leafs: 3 }));
  localStorage.setItem('tyc-bench', JSON.stringify({ sits: 3 }));
  localStorage.setItem('tyc-storyhour', JSON.stringify({ tellings: 3 }));
  localStorage.setItem('tyc-song', JSON.stringify({ sings: 3 }));
  localStorage.setItem('tyc-capsule', JSON.stringify({ visits: 3 }));
  localStorage.setItem('tyc-mural', JSON.stringify({ sittings: 3 }));
  localStorage.removeItem('tyc-docent');
}

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errs = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await page.addInitScript(seedStory);
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
    const start = page.locator('#welcome-start-btn');
    if (await start.isVisible().catch(() => false)) await start.click();
    const storyIds = ['toast-chip', 'bench-chip', 'story-chip', 'song-chip', 'docent-chip', 'guest-chip', 'capsule-chip', 'mural-chip'];
    await page.waitForFunction((ids) => ids.every((id) => {
      const el = document.getElementById(id);
      return el && el.offsetWidth > 8;
    }), storyIds, { timeout: 15000 });

    await page.evaluate(() => {
      window.readShownCash = function () {
        const t = document.getElementById('cash-val').textContent.replace(/[$,\s]/g, '');
        if (/k$/i.test(t)) return Math.round(parseFloat(t) * 1000);
        if (/m$/i.test(t)) return Math.round(parseFloat(t) * 1e6);
        return Math.round(parseFloat(t));
      };
    });

    async function hit(id) {
      return page.evaluate((chipId) => {
        const el = document.getElementById(chipId);
        const r = el.getBoundingClientRect();
        const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
        const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height / 2));
        const top = document.elementFromPoint(x, y);
        return {
          id: top && top.id,
          tag: top && top.tagName,
          x: Math.round(x),
          y: Math.round(y),
          w: Math.round(r.width),
        };
      }, id);
    }

    for (const id of storyIds) {
      const who = await hit(id);
      ok(who.id === id, id + ' is the top element at its center (' + (who.id || who.tag) + ' @' + who.x + ',' + who.y + ')');
    }

    // Each purse reads a tally a different chip increments, so pay
    // the reader before the writer. Cash stays on the integer side
    // of $1000 until the last chip.
    const chips = [
      { id: 'docent-chip', key: 'tyc-docent', field: 'tours', pay: 130 + 65 * 3, mark: '+$325' },
      { id: 'toast-chip', key: 'tyc-anniversary', field: 'toasts', pay: 60 + 30 * 3, mark: '+$150' },
      { id: 'song-chip', key: 'tyc-song', field: 'sings', pay: 100 + 50 * 3, mark: '+$250' },
      { id: 'story-chip', key: 'tyc-storyhour', field: 'tellings', pay: 90 + 45 * 3, mark: '+$225' },
      { id: 'bench-chip', key: 'tyc-bench', field: 'sits', pay: 80 + 40 * 3, mark: '+$200' },
    ];
    for (const chip of chips) {
      const before = await page.evaluate((key) => ({
        cash: readShownCash(),
        box: JSON.parse(localStorage.getItem(key) || '{}'),
      }), chip.key);
      await page.locator('#' + chip.id).click({ timeout: 5000 });
      await page.waitForFunction((args) => {
        const feed = document.getElementById('feed-list').innerText;
        if (feed.indexOf(args.mark) < 0) return false;
        const shown = readShownCash();
        const slack = shown >= 1000 ? 60 : 0;
        return shown + slack >= args.before + args.pay - 2;
      }, { mark: chip.mark, before: before.cash, pay: chip.pay }, { timeout: 4000 });
      const after = await page.evaluate((key) => ({
        cash: readShownCash(),
        box: JSON.parse(localStorage.getItem(key) || '{}'),
        feed: document.getElementById('feed-list').innerText,
      }), chip.key);
      const tally = after.box[chip.field];
      const was = before.box[chip.field] || 0;
      const delta = after.cash - before.cash;
      const expected = before.cash + chip.pay;
      const cashOk = after.cash >= 1000 || before.cash >= 1000
        ? Math.abs(expected - after.cash) <= 100 && delta > chip.pay / 2
        : delta >= chip.pay - 2 && delta < chip.pay + 40;
      ok(tally === was + 1 && after.feed.indexOf(chip.mark) >= 0 && cashOk,
        chip.id + ' pays ' + chip.mark + ' once (' + delta + ', tally ' + tally + ')');
      await page.locator('#' + chip.id).click({ timeout: 5000 });
      await page.waitForTimeout(350);
      const twice = await page.evaluate((key) => ({
        cash: readShownCash(),
        box: JSON.parse(localStorage.getItem(key) || '{}'),
      }), chip.key);
      ok(twice.box[chip.field] === tally && twice.cash - after.cash < (after.cash >= 1000 ? 80 : 40),
        'a second click on ' + chip.id + ' does not pay again (' + (twice.cash - after.cash) + ')');
    }

    const office = await page.evaluate(() => {
      const top = document.elementFromPoint(640, 500);
      return top && top.tagName === 'CANVAS' && top.dataset && top.dataset.engine
        ? top.dataset.engine
        : (top && top.id) || (top && top.tagName);
    });
    ok(String(office).indexOf('three.js') >= 0, 'the office canvas still receives clicks away from the chips (' + office + ')');

    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    phone.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await phone.addInitScript(seedStory);
    await phone.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
    const phoneStart = phone.locator('#welcome-start-btn');
    if (await phoneStart.isVisible().catch(() => false)) await phoneStart.click();
    await phone.waitForFunction((ids) => ids.every((id) => {
      const el = document.getElementById(id);
      if (!el || el.offsetWidth < 8) return false;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + Math.min(r.width / 2, 12), r.top + r.height / 2);
      return top && (top.id === id || (top.closest && top.closest('#' + id)));
    }), storyIds, { timeout: 15000 });
    for (const id of ['docent-chip', 'mural-chip', 'capsule-chip', 'song-chip', 'story-chip', 'bench-chip', 'guest-chip', 'toast-chip']) {
      await phone.locator('#' + id).click({ timeout: 5000 });
    }
    const phonePaid = await phone.evaluate(() => ({
      toasts: JSON.parse(localStorage.getItem('tyc-anniversary') || '{}').toasts,
      sits: JSON.parse(localStorage.getItem('tyc-bench') || '{}').sits,
      tellings: JSON.parse(localStorage.getItem('tyc-storyhour') || '{}').tellings,
      sings: JSON.parse(localStorage.getItem('tyc-song') || '{}').sings,
      tours: JSON.parse(localStorage.getItem('tyc-docent') || '{}').tours,
      leafs: JSON.parse(localStorage.getItem('tyc-guestbook') || '{}').leafs,
      visits: JSON.parse(localStorage.getItem('tyc-capsule') || '{}').visits,
      sittings: JSON.parse(localStorage.getItem('tyc-mural') || '{}').sittings,
      feed: document.getElementById('feed-list') ? document.getElementById('feed-list').textContent : '',
    }));
    ok(phonePaid.toasts === 4 && phonePaid.sits === 4 && phonePaid.tellings === 4
      && phonePaid.sings === 4 && phonePaid.tours === 1
      && phonePaid.leafs === 4 && phonePaid.visits === 4 && phonePaid.sittings === 4
      && phonePaid.feed.indexOf('+$150') >= 0 && phonePaid.feed.indexOf('+$200') >= 0
      && phonePaid.feed.indexOf('+$225') >= 0 && phonePaid.feed.indexOf('+$250') >= 0
      && phonePaid.feed.indexOf('+$325') >= 0 && phonePaid.feed.indexOf('+$175') >= 0
      && phonePaid.feed.indexOf('+$275') >= 0 && phonePaid.feed.indexOf('+$300') >= 0,
      'a phone tap hits the five story chips and the three lobby chips (' + JSON.stringify(phonePaid).slice(0, 220) + ')');
    await phone.close();

    ok(errs.length === 0, 'zero page errors' + (errs[0] ? ' — ' + errs[0] : ''));
  } finally {
    await browser.close();
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  if (fail) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

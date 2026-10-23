/*
 * The guest book, time capsule, and mural chips live in #goal-hud.
 * That bar is pointer-events: none, and the office canvas is the
 * thing under it, so a real click never reached the chip.
 *
 *  A. The purses stay 70+35, 110+55, and 120+60.
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
ok(/GUEST_BASE = 70, GUEST_PER = 35/.test(src)
  && /CAPSULE_BASE = 110, CAPSULE_PER = 55/.test(src)
  && /MURAL_BASE = 120, MURAL_PER = 60/.test(src),
  'guest, capsule, and mural purses are unchanged');
ok(/#guest-chip, #capsule-chip, #mural-chip \{\s*pointer-events: auto;/.test(src),
  'the three lobby chips accept pointers');
const hud = src.slice(src.indexOf('#goal-hud {'), src.indexOf('#goal-hud {') + 700);
ok(/z-index:\s*8;/.test(hud) && !/z-index:\s*(2[4-9]|[3-9]\d|\d{3,})/.test(hud),
  'the goal bar stacks above the canvas and under the living-sky chip');

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
    await page.addInitScript(() => {
      localStorage.setItem('tycoon:tipsEnabled', '0');
      localStorage.setItem('startup-tycoon-v7', JSON.stringify({
        cash: 0, allTimeCash: 1, v: 7, savedAt: Date.now(), offlineRatePerSec: 0, ownedRooms: ['starter'],
      }));
      localStorage.setItem('tyc-anniversary', JSON.stringify({ toasts: 3 }));
      localStorage.setItem('tyc-song', JSON.stringify({ sings: 3 }));
      localStorage.setItem('tyc-capsule', JSON.stringify({ visits: 3 }));
      localStorage.removeItem('tyc-guestbook');
      localStorage.removeItem('tyc-mural');
    });
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
    const start = page.locator('#welcome-start-btn');
    if (await start.isVisible().catch(() => false)) await start.click();
    await page.waitForFunction(() => {
      const g = document.getElementById('guest-chip');
      const c = document.getElementById('capsule-chip');
      const m = document.getElementById('mural-chip');
      return g && c && m && g.offsetWidth > 8 && c.offsetWidth > 8 && m.offsetWidth > 8;
    }, { timeout: 15000 });

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
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        return {
          id: top && top.id,
          tag: top && top.tagName,
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }, id);
    }

    const chips = [
      { id: 'mural-chip', key: 'tyc-mural', field: 'sittings', pay: 120 + 60 * 3, mark: '+$300' },
      { id: 'capsule-chip', key: 'tyc-capsule', field: 'visits', pay: 110 + 55 * 3, mark: '+$275', before: 3 },
      { id: 'guest-chip', key: 'tyc-guestbook', field: 'leafs', pay: 70 + 35 * 3, mark: '+$175' },
    ];
    for (const chip of chips) {
      const who = await hit(chip.id);
      ok(who.id === chip.id, chip.id + ' is the top element at its center (' + (who.id || who.tag) + ')');
      const before = await page.evaluate((key) => ({
        cash: readShownCash(),
        box: JSON.parse(localStorage.getItem(key) || '{}'),
      }), chip.key);
      await page.locator('#' + chip.id).click({ timeout: 5000 });
      await page.waitForFunction((args) => {
        const feed = document.getElementById('feed-list').innerText;
        return feed.indexOf(args.mark) >= 0 && readShownCash() >= args.before + args.pay - 2;
      }, { mark: chip.mark, before: before.cash, pay: chip.pay }, { timeout: 4000 });
      const after = await page.evaluate((key) => ({
        cash: readShownCash(),
        box: JSON.parse(localStorage.getItem(key) || '{}'),
        feed: document.getElementById('feed-list').innerText,
      }), chip.key);
      const tally = after.box[chip.field];
      const was = before.box[chip.field] || 0;
      ok(tally === was + 1 && after.feed.indexOf(chip.mark) >= 0
        && after.cash - before.cash >= chip.pay - 2 && after.cash - before.cash < chip.pay + 40,
        chip.id + ' pays ' + chip.mark + ' once (' + (after.cash - before.cash) + ', tally ' + tally + ')');
      await page.locator('#' + chip.id).click({ timeout: 5000 });
      await page.waitForTimeout(350);
      const twice = await page.evaluate((key) => ({
        cash: readShownCash(),
        box: JSON.parse(localStorage.getItem(key) || '{}'),
      }), chip.key);
      ok(twice.box[chip.field] === tally && twice.cash - after.cash < 40,
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
    await phone.addInitScript(() => {
      localStorage.setItem('tycoon:tipsEnabled', '0');
      localStorage.setItem('startup-tycoon-v7', JSON.stringify({
        cash: 0, allTimeCash: 1, v: 7, savedAt: Date.now(), offlineRatePerSec: 0, ownedRooms: ['starter'],
      }));
      localStorage.setItem('tyc-anniversary', JSON.stringify({ toasts: 3 }));
      localStorage.setItem('tyc-song', JSON.stringify({ sings: 3 }));
      localStorage.setItem('tyc-capsule', JSON.stringify({ visits: 3 }));
      localStorage.removeItem('tyc-guestbook');
      localStorage.removeItem('tyc-mural');
    });
    await phone.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
    const phoneStart = phone.locator('#welcome-start-btn');
    if (await phoneStart.isVisible().catch(() => false)) await phoneStart.click();
    await phone.waitForFunction(() => {
      const ids = ['guest-chip', 'capsule-chip', 'mural-chip'];
      return ids.every((id) => {
        const el = document.getElementById(id);
        if (!el || el.offsetWidth < 8) return false;
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top && top.id === id;
      });
    }, { timeout: 15000 });
    await phone.locator('#mural-chip').click({ timeout: 5000 });
    await phone.locator('#capsule-chip').click({ timeout: 5000 });
    await phone.locator('#guest-chip').click({ timeout: 5000 });
    const phonePaid = await phone.evaluate(() => ({
      mural: JSON.parse(localStorage.getItem('tyc-mural') || '{}').sittings,
      visits: JSON.parse(localStorage.getItem('tyc-capsule') || '{}').visits,
      leafs: JSON.parse(localStorage.getItem('tyc-guestbook') || '{}').leafs,
      feed: document.getElementById('feed-list') ? document.getElementById('feed-list').textContent : '',
    }));
    ok(phonePaid.mural === 1 && phonePaid.visits === 4 && phonePaid.leafs === 1
      && phonePaid.feed.indexOf('+$300') >= 0 && phonePaid.feed.indexOf('+$275') >= 0 && phonePaid.feed.indexOf('+$175') >= 0,
      'a phone tap hits all three chips (' + JSON.stringify({ mural: phonePaid.mural, visits: phonePaid.visits, leafs: phonePaid.leafs }) + ')');
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

/*
 * The Founder's Ring lives in #goal-hud. That bar is pointer-events
 * none, so the office canvas ate the click. The rally is already
 * wired. The record, Employee #1, reunion, photo, panel, and the
 * eight story chips already take the hit. This chip has to as well.
 *
 * The rally is +2 morale, plus one per record bell (cap 5), plus one
 * per letter read (cap 3). Three visits leave Employee #1's badge in
 * the drawer, and that rally also pays +$100. Once a session.
 *
 *  A. The rally weights and the badge cash stay put.
 *  B. A real pointer click (no force) hits the chip, not the canvas.
 *  C. The click rallies once. A second click does not.
 *  D. Three visits pay the badge. The record bell does not ring.
 *  E. The goal bar stays under the living-sky chip's z-index.
 *  Z. Zero page errors.
 *
 * Hook-free. Seeds the unlock tallies and clicks the production chip.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'tycoon/play.html'), 'utf8');
ok(/RING_BASE = 2/.test(src)
  && /KEEPSAKE_CASH = 100/.test(src)
  && /return RING_BASE \+ Math\.min\(loadRecord\(\)\.beats \|\| 0, 5\) \+ Math\.min\(loadLetter\(\)\.read \|\| 0, 3\)/.test(src)
  && /function ringHasBadge\(\) \{ return loadVisitor\(\)\.visits >= 3; \}/.test(src)
  && /RECORD_MORALE = 5/.test(src)
  && /PLAQUE_CASH = 250/.test(src),
  'the ring rally stays +2 plus bells and letters, and the badge stays $100');
ok(/VISITOR_BASE = 150, VISITOR_PER = 50/.test(src)
  && /REUNION_BASE = 100, REUNION_PER = 50/.test(src)
  && /TOAST_BASE = 60, TOAST_PER = 30/.test(src)
  && /BENCH_BASE = 80, BENCH_PER = 40/.test(src)
  && /STORY_BASE = 90, STORY_PER = 45/.test(src)
  && /SONG_BASE = 100, SONG_PER = 50/.test(src)
  && /DOCENT_BASE = 130, DOCENT_PER = 65/.test(src)
  && /GUEST_BASE = 70, GUEST_PER = 35/.test(src)
  && /CAPSULE_BASE = 110, CAPSULE_PER = 55/.test(src)
  && /MURAL_BASE = 120, MURAL_PER = 60/.test(src)
  && /MARK_BASE = 140, MARK_PER = 70/.test(src)
  && /PHOTO_BASE = 50, PHOTO_PER = 25/.test(src),
  'visitor, reunion, photo, panel, and the story purses are unchanged');
ok(/#ring-chip \{\s*pointer-events: auto;/.test(src)
  && /#record-chip \{\s*pointer-events: auto;/.test(src)
  && /#visitor-chip \{\s*pointer-events: auto;/.test(src)
  && /#reunion-chip \{\s*pointer-events: auto;/.test(src)
  && /#photo-chip, #mark-chip \{\s*pointer-events: auto;/.test(src)
  && /#toast-chip, #bench-chip, #story-chip, #song-chip, #docent-chip \{\s*pointer-events: auto;/.test(src)
  && /#guest-chip, #capsule-chip, #mural-chip \{\s*pointer-events: auto;/.test(src),
  'ring, record, visitor, reunion, photo, panel, and the story chips accept pointers');
const hud = src.slice(src.indexOf('#goal-hud {'), src.indexOf('#goal-hud {') + 900);
ok(/z-index:\s*8;/.test(hud) && !/z-index:\s*(2[4-9]|[3-9]\d|\d{3,})/.test(hud),
  'the goal bar stacks above the canvas and under the living-sky chip');
ok(!/window\.__/.test(src), 'no test hook on the office');

function seedMemory(opts) {
  const visits = opts && opts.visits ? opts.visits : 2;
  localStorage.setItem('tycoon:tipsEnabled', '0');
  localStorage.setItem('startup-tycoon-v7', JSON.stringify({
    cash: 0, allTimeCash: 1, v: 7, savedAt: Date.now(), offlineRatePerSec: 0, ownedRooms: ['starter'],
  }));
  localStorage.setItem('tyc-record', JSON.stringify({ cash: 500000, beats: 3 }));
  localStorage.setItem('tyc-plaque', JSON.stringify({ cheers: 3 }));
  localStorage.setItem('tyc-visitor', JSON.stringify({ visits: visits }));
  localStorage.setItem('tyc-reunion', JSON.stringify({ held: 2 }));
  localStorage.setItem('tyc-portrait', JSON.stringify({ looks: 3 }));
  localStorage.setItem('tyc-anniversary', JSON.stringify({ toasts: 3 }));
  localStorage.setItem('tyc-guestbook', JSON.stringify({ leafs: 3 }));
  localStorage.setItem('tyc-bench', JSON.stringify({ sits: 3 }));
  localStorage.setItem('tyc-storyhour', JSON.stringify({ tellings: 3 }));
  localStorage.setItem('tyc-song', JSON.stringify({ sings: 3 }));
  localStorage.setItem('tyc-capsule', JSON.stringify({ visits: 3 }));
  localStorage.setItem('tyc-mural', JSON.stringify({ sittings: 3 }));
  localStorage.setItem('tyc-docent', JSON.stringify({ tours: 3 }));
  localStorage.removeItem('tyc-mark');
  localStorage.removeItem('tyc-ring');
  localStorage.removeItem('tyc-keepsake');
  localStorage.removeItem('tyc-letter');
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
    await page.addInitScript(seedMemory);
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
    const start = page.locator('#welcome-start-btn');
    if (await start.isVisible().catch(() => false)) await start.click();
    const storyIds = ['toast-chip', 'bench-chip', 'story-chip', 'song-chip', 'docent-chip', 'guest-chip', 'capsule-chip', 'mural-chip', 'mark-chip'];
    const ids = ['ring-chip', 'record-chip', 'visitor-chip'].concat(storyIds);
    await page.waitForFunction((list) => list.every((id) => {
      const el = document.getElementById(id);
      return el && el.offsetWidth > 8;
    }), ids, { timeout: 15000 });
    const reunionHidden = await page.evaluate(() => {
      const el = document.getElementById('reunion-chip');
      return !el || el.offsetWidth < 8;
    });
    ok(reunionHidden, 'two visits leave the reunion chip hidden');

    await page.evaluate(() => {
      window.readShownCash = function () {
        const t = document.getElementById('cash-val').textContent.replace(/[$,\s]/g, '');
        if (/k$/i.test(t)) return Math.round(parseFloat(t) * 1000);
        if (/m$/i.test(t)) return Math.round(parseFloat(t) * 1e6);
        return Math.round(parseFloat(t));
      };
    });

    for (const id of ids) {
      const who = await page.evaluate((chipId) => {
        const el = document.getElementById(chipId);
        const r = el.getBoundingClientRect();
        const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
        const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height / 2));
        const top = document.elementFromPoint(x, y);
        return { id: top && top.id, tag: top && top.tagName, x: Math.round(x), y: Math.round(y) };
      }, id);
      ok(who.id === id, id + ' is the top element at its center (' + (who.id || who.tag) + ' @' + who.x + ',' + who.y + ')');
    }

    const titled = await page.evaluate(() => {
      const el = document.getElementById('ring-chip');
      return { text: el.textContent, title: el.title };
    });
    ok(titled.text.indexOf('ring') >= 0 && titled.title.indexOf('+5') >= 0,
      'three bells make the rally +5 morale (' + titled.text + ')');

    const before = await page.evaluate(() => ({
      cash: readShownCash(),
      uses: (JSON.parse(localStorage.getItem('tyc-ring') || '{}').uses) || 0,
      beats: JSON.parse(localStorage.getItem('tyc-record') || '{}').beats,
      visits: JSON.parse(localStorage.getItem('tyc-visitor') || '{}').visits,
    }));
    await page.locator('#ring-chip').click({ timeout: 5000 });
    await page.waitForFunction(() => {
      const feed = document.getElementById('feed-list').innerText;
      return feed.indexOf('+5 morale') >= 0 && feed.indexOf('taps the ring') >= 0;
    }, { timeout: 4000 });
    const after = await page.evaluate(() => ({
      cash: readShownCash(),
      uses: JSON.parse(localStorage.getItem('tyc-ring') || '{}').uses,
      pays: (JSON.parse(localStorage.getItem('tyc-keepsake') || '{}').pays) || 0,
      beats: JSON.parse(localStorage.getItem('tyc-record') || '{}').beats,
      visits: JSON.parse(localStorage.getItem('tyc-visitor') || '{}').visits,
      feed: document.getElementById('feed-list').innerText,
    }));
    ok(after.uses === 1 && before.uses === 0 && after.pays === 0 && after.beats === 3 && after.visits === 2
      && after.feed.indexOf('+$100') < 0 && after.feed.indexOf('NEW HOUSE RECORD') < 0
      && after.cash - before.cash < 40,
      'the ring rallies +5 once and does not pay the badge yet (' + (after.cash - before.cash) + ', uses ' + after.uses + ')');
    await page.locator('#ring-chip').click({ timeout: 5000 });
    await page.waitForTimeout(350);
    const twice = await page.evaluate(() => ({
      uses: JSON.parse(localStorage.getItem('tyc-ring') || '{}').uses,
      cash: readShownCash(),
    }));
    ok(twice.uses === 1 && twice.cash - after.cash < 40,
      'a second click on the ring does not rally again (' + (twice.cash - after.cash) + ')');

    const visitBefore = await page.evaluate(() => readShownCash());
    await page.locator('#visitor-chip').click({ timeout: 5000 });
    await page.waitForFunction((cash) => {
      const feed = document.getElementById('feed-list').innerText;
      if (feed.indexOf('+$300') < 0) return false;
      const shown = readShownCash();
      const slack = shown >= 1000 ? 60 : 0;
      return shown + slack >= cash + 300 - 2;
    }, visitBefore, { timeout: 4000 });
    const visited = await page.evaluate(() => JSON.parse(localStorage.getItem('tyc-visitor') || '{}').visits);
    ok(visited === 3, 'Employee #1 still pays after the rally (visits ' + visited + ')');

    await page.waitForFunction(() => {
      const el = document.getElementById('reunion-chip');
      return el && el.offsetWidth > 8;
    }, { timeout: 12000 });
    const reunionWho = await page.evaluate(() => {
      const el = document.getElementById('reunion-chip');
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top && top.id;
    });
    ok(reunionWho === 'reunion-chip', 'three visits still stand a reunion chip the pointer can hit (' + reunionWho + ')');
    const reunionBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('tyc-reunion') || '{}').held);
    await page.locator('#reunion-chip').click({ timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('feed-list').innerText.indexOf('+$400') >= 0, { timeout: 4000 });
    const reunionAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('tyc-reunion') || '{}').held);
    ok(reunionAfter === reunionBefore + 1, 'the stood reunion still pays +$400 (held ' + reunionAfter + ')');

    const guestBefore = await page.evaluate(() => (JSON.parse(localStorage.getItem('tyc-guestbook') || '{}').leafs) || 0);
    await page.locator('#guest-chip').click({ timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('feed-list').innerText.indexOf('+$175') >= 0, { timeout: 4000 });
    const guestAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('tyc-guestbook') || '{}').leafs);
    ok(guestAfter === guestBefore + 1, 'the guest book chip still pays after the rally (' + guestAfter + ')');

    const office = await page.evaluate(() => {
      const top = document.elementFromPoint(640, 560);
      return top && top.tagName === 'CANVAS' && top.dataset && top.dataset.engine
        ? top.dataset.engine
        : (top && top.id) || (top && top.tagName);
    });
    ok(String(office).indexOf('three.js') >= 0, 'the office canvas still receives clicks away from the chips (' + office + ')');

    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    phone.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await phone.addInitScript(seedMemory, { visits: 3 });
    await phone.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
    const phoneStart = phone.locator('#welcome-start-btn');
    if (await phoneStart.isVisible().catch(() => false)) await phoneStart.click();
    await phone.evaluate(() => {
      window.readShownCash = function () {
        const t = document.getElementById('cash-val').textContent.replace(/[$,\s]/g, '');
        if (/k$/i.test(t)) return Math.round(parseFloat(t) * 1000);
        if (/m$/i.test(t)) return Math.round(parseFloat(t) * 1e6);
        return Math.round(parseFloat(t));
      };
    });
    await phone.waitForFunction((list) => list.every((id) => {
      const el = document.getElementById(id);
      if (!el || el.offsetWidth < 8) return false;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + Math.min(r.width / 2, 12), r.top + r.height / 2);
      return top && (top.id === id || (top.closest && top.closest('#' + id)));
    }), ['ring-chip', 'record-chip', 'reunion-chip', 'mural-chip'], { timeout: 15000 });
    const badgeBefore = await phone.evaluate(() => readShownCash());
    await phone.locator('#ring-chip').click({ timeout: 5000 });
    await phone.waitForFunction((cash) => {
      const feed = document.getElementById('feed-list') ? document.getElementById('feed-list').textContent : '';
      if (feed.indexOf('+$100') < 0 || feed.indexOf('+5 morale') < 0) return false;
      const shown = readShownCash();
      return shown + 2 >= cash + 100;
    }, badgeBefore, { timeout: 4000 });
    const badged = await phone.evaluate(() => ({
      uses: JSON.parse(localStorage.getItem('tyc-ring') || '{}').uses,
      pays: JSON.parse(localStorage.getItem('tyc-keepsake') || '{}').pays,
      cash: readShownCash(),
    }));
    ok(badged.uses === 1 && badged.pays === 1 && badged.cash + 2 >= badgeBefore + 100 && badged.cash < badgeBefore + 140,
      'three visits add the $100 badge to the rally (' + (badged.cash - badgeBefore) + ')');
    await phone.locator('#ring-chip').click({ timeout: 5000 });
    await phone.waitForTimeout(350);
    const phoneTwice = await phone.evaluate(() => ({
      uses: JSON.parse(localStorage.getItem('tyc-ring') || '{}').uses,
      pays: JSON.parse(localStorage.getItem('tyc-keepsake') || '{}').pays,
    }));
    ok(phoneTwice.uses === 1 && phoneTwice.pays === 1, 'a second phone tap does not rally or pay the badge again');
    await phone.locator('#reunion-chip').click({ timeout: 5000 });
    await phone.locator('#mural-chip').click({ timeout: 5000 });
    const phonePaid = await phone.evaluate(() => ({
      beats: JSON.parse(localStorage.getItem('tyc-record') || '{}').beats,
      cheers: JSON.parse(localStorage.getItem('tyc-plaque') || '{}').cheers,
      visits: JSON.parse(localStorage.getItem('tyc-visitor') || '{}').visits,
      held: JSON.parse(localStorage.getItem('tyc-reunion') || '{}').held,
      sittings: JSON.parse(localStorage.getItem('tyc-mural') || '{}').sittings,
      feed: document.getElementById('feed-list') ? document.getElementById('feed-list').textContent : '',
    }));
    ok(phonePaid.beats === 3 && phonePaid.cheers === 3 && phonePaid.visits === 3
      && phonePaid.held === 3 && phonePaid.sittings === 4
      && phonePaid.feed.indexOf('+$100') >= 0 && phonePaid.feed.indexOf('+$400') >= 0
      && phonePaid.feed.indexOf('NEW HOUSE RECORD') < 0,
      'a phone tap hits the ring, the record, the reunion, and the mural (' + JSON.stringify(phonePaid).slice(0, 220) + ')');
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

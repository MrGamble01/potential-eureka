/*
 * The Archive Wing lives in #goal-hud. That bar is pointer-events
 * none, so the office canvas ate the click. Building and visiting
 * are already wired. The history chip already takes the hit.
 *
 * The wing costs $25,000 once. A visit pays $150 plus $75 per
 * painted panel, capped at 5. Three panels pay $375, once a session.
 *
 *  A. The cost and the visit purse stay put.
 *  B. A real pointer click (no force) hits the chip, not the canvas.
 *  C. The click builds, the next click visits once, a third does not.
 *  D. The history chip still takes a hit.
 *  E. The goal bar stays under the living-sky chip's z-index.
 *  Z. Zero page errors.
 *
 * Hook-free. Seeds three panels and an exact build purse.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const SAVE_KEY = 'startup-tycoon-v7';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'tycoon/play.html'), 'utf8');
ok(/ARCHIVE_COST = 25000, ARCHIVE_BASE = 150, ARCHIVE_PER = 75/.test(src)
  && /function archiveOffered\(\) \{ return loadMark\(\)\.panels >= 3; \}/.test(src)
  && /ARCHIVE_BASE \+ ARCHIVE_PER \* Math\.min\(loadMark\(\)\.panels \|\| 0, 5\)/.test(src),
  'the wing still costs $25,000 and a visit still pays $150 plus $75 a panel');
ok(/#archive-chip \{\s*pointer-events: auto;/.test(src)
  && /#history-chip \{\s*pointer-events: auto;/.test(src)
  && /#ring-chip \{\s*pointer-events: auto;/.test(src)
  && /#record-chip \{\s*pointer-events: auto;/.test(src)
  && /#visitor-chip \{\s*pointer-events: auto;/.test(src)
  && /#reunion-chip \{\s*pointer-events: auto;/.test(src)
  && /#photo-chip, #mark-chip \{\s*pointer-events: auto;/.test(src)
  && /#toast-chip, #bench-chip, #story-chip, #song-chip, #docent-chip \{\s*pointer-events: auto;/.test(src)
  && /#guest-chip, #capsule-chip, #mural-chip \{\s*pointer-events: auto;/.test(src),
  'archive, history, ring, record, and the story chips accept pointers');
const hud = src.slice(src.indexOf('#goal-hud {'), src.indexOf('#goal-hud {') + 900);
ok(/z-index:\s*8;/.test(hud) && !/z-index:\s*(2[4-9]|[3-9]\d|\d{3,})/.test(hud),
  'the goal bar stacks above the canvas and under the living-sky chip');
ok(!/window\.__/.test(src), 'no test hook on the office');

function seedMemory() {
  const SAVE_KEY = 'startup-tycoon-v7';
  localStorage.setItem('tycoon:tipsEnabled', '0');
  localStorage.setItem('tycoon:welcomeSeen-v1', '1');
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    v: 7, cash: 24900, allTimeCash: 24900, lifetimeCash: 24900,
    fundingRoundIdx: 0, jeff: null, ideaWorkers: 0,
    offlineRatePerSec: 0, savedAt: Date.now(), ownedRooms: ['starter'],
  }));
  localStorage.setItem('tyc-mark', JSON.stringify({ panels: 3 }));
  localStorage.setItem('tyc-archive', JSON.stringify({ built: false, visits: 0 }));
  localStorage.setItem('tyc-record', JSON.stringify({ cash: 500000, beats: 3 }));
  localStorage.removeItem('tyc-history');
}

function hit(page, id, edge) {
  return page.evaluate(({ chipId, edge }) => {
    const el = document.getElementById(chipId);
    if (!el || el.offsetWidth < 8) return { id: '', w: 0 };
    const r = el.getBoundingClientRect();
    const x = edge
      ? r.left + Math.min(r.width / 2, 12)
      : Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
    const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height / 2));
    const top = document.elementFromPoint(x, y);
    return { id: top && top.id, tag: top && top.tagName, x: Math.round(x), y: Math.round(y) };
  }, { chipId: id, edge: !!edge });
}

(async () => {
  const launch = {
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  const browser = await chromium.launch(launch);
  const errs = [];
  try {
    async function office(width, height, edge) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
      page.setDefaultTimeout(20000);
      await page.addInitScript(seedMemory);
      await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
      const start = page.locator('#welcome-start-btn');
      if (await start.isVisible().catch(() => false)) await start.click();
      await page.waitForFunction(() => {
        const el = document.getElementById('archive-chip');
        const hist = document.getElementById('history-chip');
        return el && el.offsetWidth > 8 && el.textContent.indexOf('wing $25k') >= 0
          && hist && hist.offsetWidth > 8;
      }, null, { timeout: 20000 });
      const archiveWho = await hit(page, 'archive-chip', edge);
      const historyWho = await hit(page, 'history-chip', edge);
      ok(archiveWho.id === 'archive-chip',
        width + ' archive-chip is the top element (' + (archiveWho.id || archiveWho.tag) + ')');
      ok(historyWho.id === 'history-chip',
        width + ' history-chip is the top element (' + (historyWho.id || historyWho.tag) + ')');
      const snap = () => page.evaluate((key) => {
        window.dispatchEvent(new Event('pagehide'));
        return {
          cash: JSON.parse(localStorage.getItem(key)).cash,
          archive: JSON.parse(localStorage.getItem('tyc-archive')),
        };
      }, SAVE_KEY);
      ok((await snap()).cash === 25000, width + ' welcome-back leaves an exact build purse');
      await page.locator('#archive-chip').click({ timeout: 5000 });
      const built = await snap();
      ok(built.cash === 0 && built.archive.built === true && built.archive.visits === 0,
        width + ' the click builds the wing for $25,000 (' + built.cash + ')');
      await page.locator('#archive-chip').click({ timeout: 5000 });
      const visited = await snap();
      ok(visited.cash === 375 && visited.archive.visits === 1,
        width + ' the next click visits once for $375 (' + visited.cash + ', visits ' + visited.archive.visits + ')');
      await page.locator('#archive-chip').click({ timeout: 5000 });
      const again = await snap();
      ok(again.cash === 375 && again.archive.visits === 1,
        width + ' a second visit does not pay again');
      const officeHit = await page.evaluate(() => {
        const top = document.elementFromPoint(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight * 0.7));
        return top && top.tagName === 'CANVAS' && top.dataset && top.dataset.engine
          ? top.dataset.engine
          : (top && top.id) || (top && top.tagName);
      });
      ok(String(officeHit).indexOf('three.js') >= 0, width + ' the office canvas still receives clicks (' + officeHit + ')');
      await page.close();
    }

    await office(1280, 800, false);
    await office(390, 844, true);
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

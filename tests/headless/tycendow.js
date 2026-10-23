/*
 * The Founders' Scholarship lives in #goal-hud. That bar is
 * pointer-events none, so the office canvas ate the click. Buying
 * the endowment is already wired. The history chip already takes
 * the hit. Moonshot, hedge, and factor stay inert.
 *
 * The scholarship costs $25,000 once. The floor stays 50, then 55
 * after five catches, then 60 after ten.
 *
 *  A. The cost and the floors stay put.
 *  B. A real pointer click (no force) hits the chip, not the canvas.
 *  C. The click endows once. A second click does not spend again.
 *  D. A broke wallet refuses without spending.
 *  E. The history chip still takes a hit. Neighbor chips do not.
 *  F. The goal bar stays under the living-sky chip's z-index.
 *  Z. Zero page errors.
 *
 * Hook-free. Seeds one season past the IPO and an exact purse.
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
ok(/const ENDOW_COST = 25000, ENDOW_FLOOR = 50;/.test(src)
  && /const ENDOW_FLOOR2 = 55, ENDOW_TIER2_AT = 5;/.test(src)
  && /const ENDOW_FLOOR3 = 60, ENDOW_TIER3_AT = 10;/.test(src)
  && /ARCHIVE_COST = 25000, ARCHIVE_BASE = 150, ARCHIVE_PER = 75/.test(src),
  'the scholarship still costs $25,000 and the floors stay 50, 55, and 60');
const archiveAt = src.indexOf('#archive-chip {');
const endowAt = src.indexOf('#endow-chip {');
ok(endowAt > archiveAt && archiveAt > 0
  && /#endow-chip \{\s*pointer-events: auto;/.test(src)
  && /#archive-chip \{\s*pointer-events: auto;/.test(src)
  && /#history-chip \{\s*pointer-events: auto;/.test(src)
  && /#ring-chip \{\s*pointer-events: auto;/.test(src)
  && /#record-chip \{\s*pointer-events: auto;/.test(src)
  && /#visitor-chip \{\s*pointer-events: auto;/.test(src)
  && /#reunion-chip \{\s*pointer-events: auto;/.test(src)
  && /#photo-chip, #mark-chip \{\s*pointer-events: auto;/.test(src)
  && /#toast-chip, #bench-chip, #story-chip, #song-chip, #docent-chip \{\s*pointer-events: auto;/.test(src)
  && /#guest-chip, #capsule-chip, #mural-chip \{\s*pointer-events: auto;/.test(src),
  'the scholarship rule follows the archive rule, and the earlier chips still accept pointers');
const hud = src.slice(src.indexOf('#goal-hud {'), src.indexOf('#goal-hud {') + 900);
ok(/z-index:\s*8;/.test(hud) && !/z-index:\s*(2[4-9]|[3-9]\d|\d{3,})/.test(hud),
  'the goal bar stacks above the canvas and under the living-sky chip');
ok(!/window\.__/.test(src), 'no test hook on the office');

function seedMemory(cash) {
  const SAVE_KEY = 'startup-tycoon-v7';
  localStorage.setItem('tycoon:tipsEnabled', '0');
  localStorage.setItem('tycoon:welcomeSeen-v1', '1');
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    v: 7, cash: cash, allTimeCash: cash, lifetimeCash: cash,
    fundingRoundIdx: 0, jeff: null, ideaWorkers: 0,
    offlineRatePerSec: 0, savedAt: Date.now(), ownedRooms: ['starter'],
    prestigeLevel: 1, prestigeMultiplier: 2,
    endow: { done: false, catches: 0 },
  }));
  localStorage.setItem('tyc-record', JSON.stringify({ cash: 500000, beats: 3 }));
  localStorage.removeItem('tyc-history');
  localStorage.removeItem('tyc-letter');
  localStorage.removeItem('tyc-festival');
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
    async function office(width, height, edge, cash) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
      page.setDefaultTimeout(20000);
      await page.addInitScript(seedMemory, cash);
      await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
      const start = page.locator('#welcome-start-btn');
      if (await start.isVisible().catch(() => false)) await start.click();
      await page.waitForFunction(() => {
        const el = document.getElementById('endow-chip');
        const hist = document.getElementById('history-chip');
        return el && el.offsetWidth > 8 && el.textContent.indexOf('$25.0k') >= 0
          && hist && hist.offsetWidth > 8;
      }, null, { timeout: 20000 });
      const endowWho = await hit(page, 'endow-chip', edge);
      const historyWho = await hit(page, 'history-chip', edge);
      ok(endowWho.id === 'endow-chip',
        width + ' endow-chip is the top element (' + (endowWho.id || endowWho.tag) + ')');
      ok(historyWho.id === 'history-chip',
        width + ' history-chip is the top element (' + (historyWho.id || historyWho.tag) + ')');
      const inert = await page.evaluate(() => ({
        endow: getComputedStyle(document.getElementById('endow-chip')).pointerEvents,
        moon: getComputedStyle(document.getElementById('moonshot-chip')).pointerEvents,
        hedge: getComputedStyle(document.getElementById('hedge-chip')).pointerEvents,
        factor: getComputedStyle(document.getElementById('factor-chip')).pointerEvents,
      }));
      ok(inert.endow === 'auto' && inert.moon === 'none' && inert.hedge === 'none' && inert.factor === 'none',
        width + ' neighbors stay inert (endow ' + inert.endow + ', moon ' + inert.moon + ')');
      const snap = () => page.evaluate((key) => {
        window.dispatchEvent(new Event('pagehide'));
        const saved = JSON.parse(localStorage.getItem(key));
        return { cash: saved.cash, endow: saved.endow };
      }, SAVE_KEY);
      const purse = cash + 100;
      const before = await snap();
      ok(before.cash === purse && before.endow && before.endow.done === false,
        width + ' welcome-back leaves $' + purse + ' and an unfunded scholarship (' + before.cash + ')');
      if (cash < 24900) {
        await page.locator('#endow-chip').click({ timeout: 5000 });
        const toast = await page.locator('.toast').filter({ hasText: 'the wallet says no' }).count();
        const broke = await snap();
        ok(toast === 1 && broke.cash === purse && broke.endow.done === false,
          width + ' a broke wallet refuses the endowment (' + broke.cash + ', toast ' + toast + ')');
      } else {
        await page.locator('#endow-chip').click({ timeout: 5000 });
        const bought = await snap();
        const chip = await page.locator('#endow-chip').textContent();
        const feed = await page.locator('#feed-list').innerText();
        ok(bought.cash === 0 && bought.endow.done === true && bought.endow.catches === 0
          && chip.indexOf('endowed') >= 0 && feed.indexOf('Founders') >= 0,
          width + ' the click endows the scholarship for $25,000 (' + bought.cash + ', ' + chip + ')');
        await page.locator('#endow-chip').click({ timeout: 5000 });
        const again = await snap();
        ok(again.cash === 0 && again.endow.done === true && again.endow.catches === 0,
          width + ' a second click does not spend again');
      }
      const officeHit = await page.evaluate(() => {
        const top = document.elementFromPoint(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight * 0.7));
        return top && top.tagName === 'CANVAS' && top.dataset && top.dataset.engine
          ? top.dataset.engine
          : (top && top.id) || (top && top.tagName);
      });
      ok(String(officeHit).indexOf('three.js') >= 0, width + ' the office canvas still receives clicks (' + officeHit + ')');
      await page.close();
    }

    await office(1280, 800, false, 24900);
    await office(390, 844, true, 24900);
    await office(1280, 800, false, 1000);
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

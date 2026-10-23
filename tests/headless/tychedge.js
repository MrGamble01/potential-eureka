/*
 * The hedge lives in #goal-hud. That bar is pointer-events none,
 * so the office canvas ate the click. Writing the policy is
 * already wired. The history chip already takes the hit. Factor
 * stays inert.
 *
 * With no revenue the premium is the $400 floor. A rival win pays
 * 3×. A second click while a policy is open does not write another.
 *
 *  A. The premium floor and the multiple stay put.
 *  B. A real pointer click (no force) hits the chip, not the canvas.
 *  C. The click writes one policy and the chip reads covered.
 *  D. A broke wallet refuses without spending.
 *  E. History still opens after the policy. The office still clicks.
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
ok(/const HEDGE_MULT = 3, HEDGE_MIN = 400;/.test(src)
  && /const MOONSHOT_SECS = 20, MOONSHOT_MULT = 2\.2, MOONSHOT_MIN = 500;/.test(src),
  'the hedge still costs at least $400 and pays 3×, and the moonshot stake stays');
const moonAt = src.indexOf('#moonshot-chip {');
const hedgeAt = src.indexOf('#hedge-chip {');
ok(hedgeAt > moonAt && moonAt > 0
  && /#hedge-chip \{\s*pointer-events: auto;/.test(src)
  && /#moonshot-chip \{\s*pointer-events: auto;/.test(src)
  && /#endow-chip \{\s*pointer-events: auto;/.test(src)
  && /#history-chip \{\s*pointer-events: auto;/.test(src),
  'the hedge rule follows the moonshot rule, and the earlier chips still accept pointers');
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
        const el = document.getElementById('hedge-chip');
        const hist = document.getElementById('history-chip');
        return el && el.offsetWidth > 8 && el.textContent.indexOf('$400') >= 0
          && hist && hist.offsetWidth > 8;
      }, null, { timeout: 20000 });
      const hedgeWho = await hit(page, 'hedge-chip', edge);
      const historyWho = await hit(page, 'history-chip', edge);
      ok(hedgeWho.id === 'hedge-chip',
        width + ' hedge-chip is the top element (' + (hedgeWho.id || hedgeWho.tag) + ')');
      ok(historyWho.id === 'history-chip',
        width + ' history-chip is the top element (' + (historyWho.id || historyWho.tag) + ')');
      const inert = await page.evaluate(() => ({
        hedge: getComputedStyle(document.getElementById('hedge-chip')).pointerEvents,
        factor: getComputedStyle(document.getElementById('factor-chip')).pointerEvents,
        moon: getComputedStyle(document.getElementById('moonshot-chip')).pointerEvents,
      }));
      ok(inert.hedge === 'auto' && inert.factor === 'none' && inert.moon === 'auto',
        width + ' factor stays inert (hedge ' + inert.hedge + ', factor ' + inert.factor + ')');
      const snap = () => page.evaluate((key) => {
        window.dispatchEvent(new Event('pagehide'));
        const saved = JSON.parse(localStorage.getItem(key));
        return { cash: saved.cash, active: saved.hedge ? saved.hedge.active : 0 };
      }, SAVE_KEY);
      const purse = cash + 100;
      const before = await snap();
      ok(before.cash === purse && before.active === 0,
        width + ' welcome-back leaves $' + purse + ' and no policy (' + before.cash + ')');
      if (cash < 300) {
        await page.locator('#hedge-chip').click({ timeout: 5000 });
        const toast = await page.locator('.toast').filter({ hasText: 'the wallet says no' }).count();
        const chip = await page.locator('#hedge-chip').textContent();
        const broke = await snap();
        ok(toast === 1 && broke.cash === purse && broke.active === 0 && chip.indexOf('$400') >= 0,
          width + ' a broke wallet refuses the hedge (' + broke.cash + ', toast ' + toast + ')');
      } else {
        await page.locator('#hedge-chip').click({ timeout: 5000 });
        const bought = await snap();
        const chip = await page.locator('#hedge-chip').textContent();
        const feed = await page.locator('#feed-list').innerText();
        ok(bought.cash === 0 && bought.active === 400 && chip.indexOf('covered') >= 0 && feed.indexOf('Hedge') >= 0,
          width + ' the click writes $400 of coverage (' + bought.cash + ', ' + chip + ')');
        await page.locator('#hedge-chip').click({ timeout: 5000 });
        const again = await snap();
        ok(again.cash === 0 && again.active === 400,
          width + ' a second click does not write another policy');
        await page.locator('#history-chip').click({ timeout: 5000 });
        const afterHist = await snap();
        const histFeed = await page.locator('#feed-list').innerText();
        ok(afterHist.cash === 0 && afterHist.active === 400 && histFeed.indexOf('COMPANY HISTORY') >= 0,
          width + ' history still opens after the policy');
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

    await office(1280, 800, false, 300);
    await office(390, 844, true, 300);
    await office(1280, 800, false, 50);
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

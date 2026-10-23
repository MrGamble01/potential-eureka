const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const SAVE_KEY = 'startup-tycoon-v7';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'tycoon/play.html'), 'utf8');
ok(/const FACTOR_SECS = 60, FACTOR_RATE = 0\.9, FACTOR_MIN = 300;/.test(src),
  'the desk still buys 60 seconds at 90% with a $300 floor');
ok(/#factor-chip \{\s*pointer-events: auto;/.test(src), 'the factor chip accepts pointers');
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
    return { id: top && top.id, tag: top && top.tagName };
  }, { chipId: id, edge: !!edge });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    async function office(width, height, edge) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
      page.setDefaultTimeout(20000);
      await page.addInitScript(seedMemory, 1000);
      await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
      const start = page.locator('#welcome-start-btn');
      if (await start.isVisible().catch(() => false)) await start.click();
      await page.waitForFunction(() => {
        const el = document.getElementById('factor-chip');
        return el && el.offsetWidth > 8 && el.textContent.indexOf('$') >= 0;
      }, null, { timeout: 20000 });
      const who = await hit(page, 'factor-chip', edge);
      ok(who.id === 'factor-chip', width + ' factor-chip is the top element (' + (who.id || who.tag) + ')');
      const snap = () => page.evaluate((key) => {
        window.dispatchEvent(new Event('pagehide'));
        const saved = JSON.parse(localStorage.getItem(key));
        const open = saved.factor && saved.factor.open;
        return { cash: saved.cash, advance: open ? open.advance : 0, left: open ? open.timeLeft : 0 };
      }, SAVE_KEY);
      const before = await snap();
      await page.locator('#factor-chip').click({ timeout: 5000 });
      const signed = await snap();
      const chip = await page.locator('#factor-chip').innerText();
      ok(signed.advance >= 300 && signed.cash === before.cash + signed.advance && /s/.test(chip),
        width + ' a click wires the advance ($' + signed.advance + ', cash ' + signed.cash + ')');
      await page.locator('#factor-chip').click({ timeout: 5000 });
      const again = await snap();
      ok(again.cash === signed.cash && again.advance === signed.advance,
        width + ' a second click does not sign another window');
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

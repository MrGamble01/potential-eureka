/*
 * SITE — patch notes (re-runnable).
 *  A. The hero carries a 📰 PATCH NOTES button.
 *  B. Clicking opens the modal with ≥10 release entries, newest first.
 *  C. Entries carry titles, dates and bullet items.
 *  D. Esc and backdrop both close it; reopening re-renders cleanly.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // A. button
  const btn = await page.$('#patch-notes-btn');
  ok(!!btn, 'the hero carries the 📰 button');

  // B + C. open and inspect
  await btn.click();
  await page.waitForTimeout(300);
  const modal = await page.evaluate(() => {
    const m = document.getElementById('patch-modal');
    const entries = Array.from(document.querySelectorAll('#patch-list > div'));
    return { open: m.style.display === 'flex', n: entries.length,
      firstTitle: entries[0] && entries[0].textContent,
      bullets: document.querySelectorAll('#patch-list li').length };
  });
  ok(modal.open, 'the modal opens');
  ok(modal.n >= 10, `${modal.n} release entries listed`);
  ok(modal.firstTitle.includes('Round Four'), 'newest release leads');
  ok(modal.bullets >= 20, `${modal.bullets} bullet items across the log`);

  // D. Esc closes; reopen; backdrop closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const closed1 = await page.evaluate(() => document.getElementById('patch-modal').style.display !== 'flex');
  ok(closed1, 'Esc closes it');
  await page.click('#patch-notes-btn');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('patch-modal').click());
  await page.waitForTimeout(200);
  const closed2 = await page.evaluate(() => ({
    closed: document.getElementById('patch-modal').style.display !== 'flex',
    n: document.querySelectorAll('#patch-list > div').length }));
  ok(closed2.closed && closed2.n >= 10, 'backdrop closes it; re-render stayed clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

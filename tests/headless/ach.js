/*
 * IDEA-SITE-4 — achievements.
 *  1. Fresh profile: 0/21, all locked in the HOF trophy case.
 *  2. Seed a snake score, switch views → toast fires, First Light +
 *     Garden Menace unlock, persisted with timestamps.
 *  3. Trophy case renders unlocked vs locked correctly.
 *  4. Unlocks never re-lock (clear the score, re-check → still there).
 *  5. Rivalry achievement unlocks off the rivals store.
 *  6. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const errs = [];
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e => errs.push(String(e).slice(0, 250)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // 1. Fresh case
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(600);
  const fresh = await page.evaluate(() => ({
    count: document.querySelector('.ach-count').textContent.trim(),
    got: document.querySelectorAll('.ach-card.ach-got').length,
    total: document.querySelectorAll('.ach-card').length,
  }));
  ok(/^0 \//.test(fresh.count) && fresh.got === 0 && fresh.total === 21,
     `fresh profile: ${fresh.count}, all ${fresh.total} locked`);

  // 2. Seed a score, navigate → unlock + toast
  await page.evaluate(() => { localStorage.setItem('snake-high', '150'); location.hash = '#arcade'; });
  await page.waitForTimeout(400);
  const toast = await page.evaluate(() => {
    const t = document.querySelector('.ach-toast');
    return t ? t.textContent : null;
  });
  ok(toast && /Achievement unlocked/.test(toast), `toast fired (${toast && toast.replace(/\s+/g, ' ').slice(0, 60)})`);
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem('arcade-achievements') || '{}'));
  ok(store['first-light'] > 0 && store['snake-100'] > 0, 'First Light + Garden Menace persisted with timestamps');

  // 3. Trophy case reflects it
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(600);
  const caseNow = await page.evaluate(() => ({
    count: document.querySelector('.ach-count').textContent.trim(),
    got: [...document.querySelectorAll('.ach-card.ach-got .ach-name')].map(e => e.textContent),
  }));
  ok(/^2 \//.test(caseNow.count) && caseNow.got.includes('First Light') && caseNow.got.includes('Garden Menace'),
     `trophy case shows ${caseNow.count}: ${caseNow.got.join(', ')}`);

  // 4. Never re-lock
  await page.evaluate(() => {
    localStorage.removeItem('snake-high');
    Achievements.check();
  });
  const still = await page.evaluate(() => Object.keys(Achievements.unlocked()).length);
  ok(still === 2, 'unlocks survive the score being cleared');

  // 5. Rivalry via the rivals store
  await page.evaluate(() => {
    localStorage.setItem('arcade-rivals', JSON.stringify({ BOB: { t: 1, s: { 'snake-high': 5 } } }));
    Achievements.check();
  });
  const withRival = await page.evaluate(() => !!Achievements.unlocked()['rivalry']);
  ok(withRival, 'Rivalry unlocks off the rivals store');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

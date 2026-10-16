/*
 * SITE-5 — the grid never said how long anything takes.
 *
 * Twenty-one cards, and nothing on any of them distinguished a
 * five-minute score chase from a builder you are still playing next
 * week. The primer (SITE-4) says it once in prose; the person who needs
 * it is choosing between cards, which is where it now is.
 *
 * It rides the tag row the cards already have, so the hub's existing
 * filter understands it for free — typing "hours" narrows to the long
 * ones with no new code.
 *
 *  A. Every GAME card carries exactly one session tag, and it leads.
 *  B. The six flagships say Hours; the fifteen arcade games say Few
 *     minutes; the studio, which is not a game, claims neither.
 *  C. The filter picks them up: "hours" → 6, "few minutes" → 15.
 *  D. Those two add to the catalogue the hero and the primer both claim.
 *  E. It survives a phone without overflowing the page.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production hub.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const FLAGSHIPS = ['AGE OF WAR', 'STARTUP TYCOON', 'GROW OP', 'HOMELESS VILLAGE', 'HEARTHVALE', 'VOXEL ISLE'];

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => localStorage.setItem('eureka-primer-seen', '1'));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const cards = await page.evaluate(() => [...document.querySelectorAll('.arcade-grid .arcade-card')].map(c => {
    const row = c.querySelector('.arcade-card-tags');
    const spans = row ? [...row.querySelectorAll('span')] : [];
    const session = spans.filter(s => s.classList.contains('tag-session'));
    return {
      title: (c.querySelector('.arcade-card-title') || {}).textContent.trim(),
      sessionCount: session.length,
      sessionText: session.length ? session[0].textContent.trim() : null,
      leads: session.length ? spans[0] === session[0] : null,
    };
  }));

  const games = cards.filter(c => c.title !== 'EUREKA STUDIO');
  ok(games.length >= 21, `the grid holds the catalogue the hero claims (${games.length} games)`);
  ok(games.every(c => c.sessionCount === 1),
    'every game card carries exactly one session tag');
  ok(games.every(c => c.leads === true),
    'the session tag leads the row — it answers the first question, not the fourth');

  const hours = games.filter(c => /Hours/.test(c.sessionText || ''));
  const mins = games.filter(c => /Few minutes/.test(c.sessionText || ''));
  ok(hours.length === 6 && FLAGSHIPS.every(f => hours.some(h => h.title === f)),
    `the six flagships are the six marked Hours (${hours.map(h => h.title).join(', ')})`);
  ok(mins.length === games.length - 6,
    `every other game is marked Few minutes (${mins.length})`);

  const studio = cards.find(c => c.title === 'EUREKA STUDIO');
  ok(studio && studio.sessionCount === 0,
    'the studio makes no play-length claim — it is not a game');

  // C. the filter the hub already had understands the new tag for free.
  await page.fill('#card-search', 'hours');
  await page.waitForTimeout(400);
  const hoursHits = await page.evaluate(() => document.getElementById('card-search-count').textContent);
  ok(hoursHits === '6 games', `searching "hours" narrows to the long games (${hoursHits})`);

  await page.fill('#card-search', 'few minutes');
  await page.waitForTimeout(400);
  const minHits = await page.evaluate(() => document.getElementById('card-search-count').textContent);
  ok(minHits === `${mins.length} games`, `searching "few minutes" narrows to the quick ones (${minHits})`);

  await page.fill('#card-search', '');
  await page.waitForTimeout(300);

  // E. a phone still lays out.
  const phone = await browser.newContext({ viewport: { width: 400, height: 900 } });
  const pp = await phone.newPage();
  const errs2 = [];
  pp.on('pageerror', e => errs2.push(String(e).slice(0, 300)));
  await pp.addInitScript(() => localStorage.setItem('eureka-primer-seen', '1'));
  await pp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await pp.waitForTimeout(2200);
  const narrow = await pp.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    tagged: [...document.querySelectorAll('.arcade-grid .tag-session')].length,
  }));
  ok(!narrow.overflow && narrow.tagged >= 21,
    `the tags survive a 400px phone without overflowing the page (${narrow.tagged} tagged)`);

  await browser.close();
  ok(errs.length === 0 && errs2.length === 0,
    `no page errors${errs.length ? ' — ' + errs[0] : errs2.length ? ' — ' + errs2[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

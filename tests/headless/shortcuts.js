/*
 * P7 — shortcuts cheat-sheet (re-runnable).
 *  A. ? opens the modal (focus lands inside via the trap), ? again closes.
 *  B. Esc closes it; backdrop click closes it; Close button closes it.
 *  C. Typing ? inside the game-search input does NOT open the modal.
 *  D. In-game: ? still opens it over a game view without breaking the game.
 *  E. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const shown = () => page.evaluate(() =>
    document.getElementById('shortcuts-modal').style.display === 'flex');

  // A. toggle with ?
  await page.keyboard.press('?');
  await page.waitForTimeout(200);
  ok(await shown(), '? opens the cheat-sheet');
  const focusInside = await page.evaluate(() =>
    document.getElementById('shortcuts-modal').contains(document.activeElement));
  ok(focusInside, 'focus lands inside the dialog (trap active)');
  await page.keyboard.press('?');
  await page.waitForTimeout(200);
  ok(!(await shown()), 'second ? closes it');

  // B. Esc, backdrop, button
  await page.keyboard.press('?');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  ok(!(await shown()), 'Esc closes it');
  await page.keyboard.press('?');
  await page.waitForTimeout(150);
  await page.click('#shortcuts-modal', { position: { x: 8, y: 8 } });
  await page.waitForTimeout(150);
  ok(!(await shown()), 'backdrop click closes it');
  await page.keyboard.press('?');
  await page.waitForTimeout(150);
  await page.click('#shortcuts-modal .primary');
  await page.waitForTimeout(150);
  ok(!(await shown()), 'Close button closes it');

  // C. typing ? in the search box stays a character
  await page.click('#card-search');
  await page.keyboard.type('?');
  await page.waitForTimeout(200);
  ok(!(await shown()), 'typing ? in the search input does not open the modal');
  const val = await page.evaluate(() => document.getElementById('card-search').value);
  ok(val === '?', 'the ? lands in the input');
  await page.keyboard.press('Escape');   // clear search

  // D. over a game view
  await page.evaluate(() => { location.hash = '#snake'; });
  await page.waitForTimeout(700);
  await page.keyboard.press('?');
  await page.waitForTimeout(200);
  ok(await shown(), '? works over a game view');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  ok(!(await shown()), 'Esc closes it over a game view');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

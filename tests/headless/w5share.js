/*
 * P5 — Word Five emoji share grid (re-runnable).
 *  A. Share button hidden mid-game.
 *  B. After the game ends (6 guesses), button appears; click copies a
 *     Wordle-style grid: "Word Five X/6" (or n/6 on a fluke win) plus one
 *     5-emoji row per guess.
 *  C. New Word hides the button again.
 *  D. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 950 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#word5', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const btnVisible = () => page.evaluate(() =>
    document.getElementById('w5-share-btn').style.display !== 'none');

  ok(!(await btnVisible()), 'share button hidden at game start');

  // Six throwaway guesses (submit() only length-checks, so any 5 letters go).
  const guesses = ['crane', 'moist', 'lupin', 'gawky', 'verbs', 'thump'];
  let ended = false;
  for (const g of guesses) {
    await page.keyboard.type(g, { delay: 40 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    if (await btnVisible()) { ended = true; break; }  // fluke win ends early
  }
  ok(ended || await btnVisible(), 'share button appears when the game ends');

  await page.click('#w5-share-btn');
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const lines = clip.split('\n');
  ok(/^Word Five (X|[1-6])\/6$/.test(lines[0]), `header line reads "${lines[0]}"`);
  ok(lines[1] === '', 'blank line after the header');
  const rows = lines.slice(2);
  ok(rows.length >= 1 && rows.length <= 6, `${rows.length} guess row(s)`);
  ok(rows.every(r => [...r].every(ch => '🟩🟨⬛'.includes(ch)) && [...r].length === 5),
    'every row is exactly five result emoji');
  const msgTxt = await page.evaluate(() => document.getElementById('word5-msg').textContent);
  ok(/copied/i.test(msgTxt), 'copy confirmation message shown');

  await page.click('.game-info button.primary');   // New Word
  await page.waitForTimeout(300);
  ok(!(await btnVisible()), 'New Word hides the share button');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

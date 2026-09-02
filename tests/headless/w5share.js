/*
 * P5 — Word Five emoji share grid (re-runnable).
 *  A. Share button hidden mid-game.
 *  B. After the game ends (6 guesses), button appears; click copies a
 *     Wordle-style grid: "Word Five X/6" (or n/6 on a fluke win) plus one
 *     5-emoji row per guess.
 *  C. New Word hides the button again.
 *
 *  W5-2 — the keyboard survives leaving the view.
 *  E. Leave Word Five for another view and come back: the physical
 *     keyboard still types. destroy() used to removeEventListener the
 *     keydown handler, and the shell inits a view exactly once, so
 *     nothing ever put it back — one trip away and Word Five was deaf
 *     to the keyboard for the rest of the session. The on-screen keys
 *     kept working, so the game looked alive; that is asserted here too,
 *     otherwise "typing works" could pass on a board nothing can reach.
 *  F. The guard the fix relies on still holds: keys pressed while
 *     another view is on screen do NOT land in the Word Five grid. A
 *     fix that simply stopped gating the listener would pass E and fail
 *     this.
 *
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

  // ---- W5-2: the keyboard survives leaving the view -------------------
  // Read the first guess row straight off the grid — no hooks, the same
  // letters the player is looking at.
  const rowText = () => page.evaluate(() =>
    ([...document.querySelectorAll('#word5-grid .w5-row')][0] || {}).textContent
      ?.replace(/\s/g, '') ?? '');
  const kbClick = label => page.evaluate(l => {
    const b = [...document.querySelectorAll('#word5-kb .w5-key')]
      .find(k => k.textContent === l);
    if (b) b.click();
  }, label);

  ok((await rowText()) === '', 'a fresh word starts on an empty row');

  // Leave for another view, then come back — the trip that used to kill it.
  await page.evaluate(() => { location.hash = 'snake'; });
  await page.waitForTimeout(700);

  // F — while away, the grid must not hear the keyboard at all.
  await page.keyboard.type('adieu', { delay: 30 });
  await page.waitForTimeout(200);
  ok((await rowText()) === '',
    'W5-2: keys pressed on another view stay out of the Word Five grid');

  await page.evaluate(() => { location.hash = 'word5'; });
  await page.waitForTimeout(700);

  // E — the named assertion. Revert the destroy() body to
  // `document.removeEventListener('keydown', boundKey)` and this goes red.
  await page.keyboard.type('slate', { delay: 40 });
  await page.waitForTimeout(300);
  ok((await rowText()) === 'SLATE',
    `W5-2: the physical keyboard still types after leaving and returning (row reads "${await rowText()}")`);

  // The pairing that keeps E honest: the on-screen keyboard was never
  // broken, so it must still work on exactly this board.
  for (let i = 0; i < 5; i++) await kbClick('⌫');
  await page.waitForTimeout(200);
  ok((await rowText()) === '', 'the on-screen backspace still clears the row');
  await kbClick('S');
  await page.waitForTimeout(200);
  ok((await rowText()) === 'S', 'the on-screen keys still type');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

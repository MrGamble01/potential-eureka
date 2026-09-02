/*
 * UI-6 — a dialog over the board owns the keyboard (re-runnable).
 *
 * `Utils.whenViewActive` asked one question — is this view on screen? — and
 * the hub's dialogs are drawn *inside* the view they cover, so the answer was
 * still yes with a dialog open on top. Every hub game reacted to keys it was
 * never meant to hear: the shortcuts cheat-sheet you opened mid-run spent
 * 2048 moves, filled Word Five's guess row, and steered Snake into a wall
 * while you were reading it. All of them are `aria-modal="true"`, which is a
 * promise the page behind them is inert.
 *
 *  A. Word Five: letters typed at the open cheat-sheet do not reach the grid,
 *     and do again the moment it closes.
 *  B. 2048: arrows behind the sheet spend no move; the board is untouched.
 *  C. Crate Escape: the warehouse takes no step behind the sheet.
 *  D. A key *released* while the sheet is open still lands — the release is
 *     exempt on purpose, or the guard would strand a key held when the dialog
 *     opened, which is the PONG-1 bug wearing a different hat.
 *  E. The dialog's own keys still work: ? toggles, Esc closes.
 *  F. Zero page errors.
 *
 * Hook-free throughout: Word Five is read from its grid text, 2048 and Pong
 * off their canvases, Crate Escape from the Moves counter in its own HUD.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const sheetOpen = page => page.evaluate(() =>
  document.getElementById('shortcuts-modal').style.display === 'flex');
const openSheet = async page => { await page.keyboard.press('?'); await page.waitForTimeout(150); };
const closeSheet = async page => { await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
const type = async (page, word) => {
  for (const ch of word) { await page.keyboard.press(ch); await page.waitForTimeout(50); }
};

const row0 = page => page.evaluate(() => {
  const r = document.querySelector('#word5-grid .w5-row');
  return r ? r.textContent.replace(/\s+/g, '') : null;
});
// Score plus a tail of the rendered board: either moving is a spent move.
const board2048 = page => page.evaluate(() =>
  document.getElementById('g2048-score').textContent + '|'
  + document.getElementById('g2048-canvas').toDataURL().slice(-96));
const crateMoves = page => page.evaluate(() =>
  +document.getElementById('crate-moves-hud').textContent);
// Mean y of Pong's left paddle, read off the canvas by colour (P1 is blue).
const pongP1 = page => page.evaluate(() => {
  const c = document.getElementById('pong-canvas');
  const scale = c.width / 760;
  const d = c.getContext('2d').getImageData(Math.round(32 * scale), 0, 1, c.height).data;
  let sum = 0, n = 0;
  for (let y = 0; y < c.height; y++) {
    const r = d[y * 4], g = d[y * 4 + 1], b = d[y * 4 + 2];
    if ((b > r + 40 && b > 120) || (g > r + 60 && g > 140)) { sum += y; n++; }
  }
  return n ? +((sum / n) / scale).toFixed(1) : null;
});

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  // ---- A. Word Five ----------------------------------------------------
  await page.goto(BASE + '/index.html#word5', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  ok((await row0(page)) === '', 'Word Five opens on an empty row');

  await openSheet(page);
  ok(await sheetOpen(page), '? opens the cheat-sheet over the game');
  await type(page, 'crane');
  const behind = await row0(page);
  ok(behind === '', `letters typed at the cheat-sheet stay out of the grid (row reads "${behind}")`);

  await closeSheet(page);
  ok(!(await sheetOpen(page)), 'Esc closes the cheat-sheet');
  await type(page, 'crane');
  const after = await row0(page);
  ok(after === 'CRANE', `the keyboard comes back when the sheet closes (row reads "${after}")`);

  // ---- B. 2048 ---------------------------------------------------------
  await page.goto(BASE + '/index.html#2048', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.keyboard.press(' ');
  await page.waitForTimeout(600);
  const b0 = await board2048(page);

  await openSheet(page);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(110); }
  await page.waitForTimeout(250);
  ok((await board2048(page)) === b0, 'arrows behind the sheet spend no 2048 move');

  await closeSheet(page);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(350);
  ok((await board2048(page)) !== b0, 'and the very next arrow, sheet closed, does move the board');

  // ---- C. Crate Escape --------------------------------------------------
  await page.goto(BASE + '/index.html#crateescape', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  ok((await crateMoves(page)) === 0, 'Crate Escape opens on move 0');

  await openSheet(page);
  for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
    await page.keyboard.press(k); await page.waitForTimeout(90);
  }
  const stepped = await crateMoves(page);
  ok(stepped === 0, `the warehouse takes no step behind the sheet (moves: ${stepped})`);

  await closeSheet(page);
  for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
    if ((await crateMoves(page)) > 0) break;
    await page.keyboard.press(k); await page.waitForTimeout(120);
  }
  ok((await crateMoves(page)) > 0, 'and the worker walks again once it closes');

  // ---- D. a release while the sheet is open still lands ------------------
  await page.goto(BASE + '/index.html#pong', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('#pong-canvas', { position: { x: 380, y: 240 } });
  await page.waitForTimeout(200);
  const rest = await pongP1(page);
  await page.keyboard.down('w');
  await page.waitForTimeout(220);
  const lifted = await pongP1(page);
  ok(rest !== null && lifted < rest - 20, `held W lifts Pong's paddle (${rest} → ${lifted})`);

  await openSheet(page);               // the sheet opens over a held key
  ok(await sheetOpen(page), 'the sheet opens mid-press');
  await page.keyboard.up('w');         // …and the release lands while it is up
  const held = await pongP1(page);
  await page.waitForTimeout(300);
  const drift = +((await pongP1(page)) - held).toFixed(1);
  ok(Math.abs(drift) < 4,
    `a key released while the sheet is open still stops the paddle (drift ${drift}px)`);

  // ---- E. the dialog's own keys -----------------------------------------
  await page.keyboard.press('?');
  await page.waitForTimeout(150);
  ok(!(await sheetOpen(page)), '? toggles the sheet shut again');
  await openSheet(page);
  await closeSheet(page);
  ok(!(await sheetOpen(page)), 'Esc still closes it over a game view');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

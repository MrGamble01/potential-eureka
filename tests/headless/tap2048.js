/*
 * G2048-1 — 2048: the game-over card says "tap to play again"; a tap on it
 * must actually play again.
 *
 *  A. Harness proof-of-life: a run is started and played (random arrows,
 *     the way a bored thumb plays) until the board locks and the GAME OVER
 *     card is up — so nothing below can pass vacuously against a suite that
 *     never reached a game over.
 *  B. G2048-1: one tap on the card itself — the element a phone's tap
 *     actually lands on, since it covers the board — hides the card, zeroes
 *     the score and deals a fresh two-tile board.
 *  C. The restarted run is live: an arrow key moves tiles and re-arms Undo.
 *  D. Zero page errors.
 *
 * No hooks (QA-23): the module keeps its state private, so the board is
 * read from the pixels and the run is driven through the keyboard and the
 * pointer, like every other hub-game suite.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const text = (page, id) => page.evaluate(i => {
  const el = document.getElementById(i);
  return el ? el.textContent.trim() : null;
}, id);
const overlayShown = page => page.evaluate(() => {
  const ov = document.getElementById('g2048-overlay');
  return !!ov && getComputedStyle(ov).display !== 'none';
});
const undoDisabled = page => page.evaluate(() => document.getElementById('g2048-undo-btn').disabled);

// Board geometry, mirrored from js/game2048.js: PAD 14, CELL 108, GAP 12.
// An empty cell is rgba(255,255,255,.05) over #0d1117 — a near-black — and
// every tile colour is far brighter than that, so "is there a tile here"
// is a brightness test at the cell centre.
const boardSig = page => page.evaluate(() => {
  const c = document.getElementById('g2048-canvas');
  const x = c.getContext('2d');
  const N = 4, PAD = 14, CELL = 108, GAP = 12, SIZE = PAD * 2 + N * CELL + (N - 1) * GAP;
  const dpr = c.width / SIZE;
  const out = [];
  for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) {
    const px = Math.round((PAD + col * (CELL + GAP) + CELL / 2) * dpr);
    const py = Math.round((PAD + r * (CELL + GAP) + CELL / 2) * dpr);
    const d = x.getImageData(px, py, 1, 1).data;
    out.push([d[0], d[1], d[2]]);
  }
  return out;
});
const tileCount = async page => (await boardSig(page)).filter(([r, g, b]) => r + g + b > 150).length;

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  // hasTouch so page.tap() is a real touch tap — the input this bug ate.
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#2048', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ── A. start, then play until the board locks ──────────────────────
  await page.keyboard.press(' ');
  await page.waitForTimeout(400);
  ok(await tileCount(page) === 2, 'a fresh run deals exactly two tiles');
  ok(!(await overlayShown(page)), 'the GAME OVER card is down while the run is live');

  // Random arrows, one per slide (the slide is 90ms and the game keeps only
  // the last input queued mid-slide, so faster presses would just be lost).
  const KEYS = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
  let presses = 0, over = false;
  while (presses < 1200 && !over) {
    await page.keyboard.press(KEYS[Math.floor(Math.random() * 4)]);
    await page.waitForTimeout(100);
    presses++;
    if (presses % 8 === 0) over = await overlayShown(page);
  }
  if (!over) { await page.waitForTimeout(400); over = await overlayShown(page); }
  ok(over, `random play locked the board and raised the GAME OVER card (${presses} presses)`);
  const scoreAtOver = await text(page, 'g2048-score');
  ok(+scoreAtOver > 0, `the lost run scored (${scoreAtOver})`);
  const cardText = await text(page, 'g2048-overlay');
  ok(/tap to play again/i.test(cardText || ''), 'the card promises "tap to play again"');

  // ── B. G2048-1: tap the card ────────────────────────────────────────
  await page.tap('#g2048-overlay');
  await page.waitForTimeout(400);
  ok(!(await overlayShown(page)), 'one tap on the card takes it down');
  ok(await text(page, 'g2048-score') === '0', 'the tap starts a new run — score reads 0');
  ok(await tileCount(page) === 2, 'the tap dealt a fresh two-tile board');
  ok(await undoDisabled(page), 'Undo is disarmed on the fresh run');

  // ── C. the restarted run is live ───────────────────────────────────
  const sig0 = JSON.stringify(await boardSig(page));
  let moved = false;
  for (const key of KEYS) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    if (JSON.stringify(await boardSig(page)) !== sig0) { moved = true; break; }
  }
  ok(moved, 'an arrow key moves tiles on the restarted run');
  ok(!(await undoDisabled(page)), 'Undo re-arms after that first move');
  ok(!(await overlayShown(page)), 'the card stays down while the new run plays');

  // ── D. ────────────────────────────────────────────────────────────
  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/*
 * P8-TET-2 — Tetris: Space hard-drops, and the well + score must
 * repaint on that keypress, not on the next gravity tick.
 *
 *  A. Harness proof-of-life: a run starts and the well has a live piece
 *     (bright pixels on the canvas) with the score at 0.
 *  B. P8-TET-2: one Space — within 150ms the board pixels change AND the
 *     score panel leaves 0 (drop points). Gravity is 1000ms at level 1,
 *     so a harness that only waits for the next tick would pass this
 *     against the unfixed file too; 150ms is the point. Against the
 *     unfixed file `handleKey` returned before draw()/updateInfo(), so
 *     both rows fail by name.
 *  C. Space still does not scroll the page (preventDefault is already
 *     on the shared list above the switch).
 *  D. Holding Space does not free-fall a stream: a repeat:true keydown
 *     after the drop is ignored, so the score stays put.
 *  E. ArrowLeft still repaints (the shared tail still runs for others).
 *  F. A handful of further hard drops leave a sane board — still
 *     playing or a clean GAME OVER, never a thrown page error.
 *  G. Zero page errors.
 *
 * No hooks (QA-23): the well is read from the pixels and the score
 * from the panel, and the run is driven through the keyboard.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const scoreOf = page => page.evaluate(() => {
  const el = document.getElementById('tetris-score');
  return el ? el.textContent.trim() : null;
});
const overlayShown = page => page.evaluate(() => {
  const ov = document.getElementById('tetris-overlay');
  return !!ov && getComputedStyle(ov).display !== 'none';
});
const overlayText = page => page.evaluate(() => {
  const ov = document.getElementById('tetris-overlay');
  return ov ? ov.textContent : '';
});
// Hash of the well pixels. The freeze bug left this hash identical for
// a full second after Space because nothing called draw().
const wellHash = page => page.evaluate(() => {
  const c = document.getElementById('tetris-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 16) h = (Math.imul(h, 33) + d[i] + d[i + 1] + d[i + 2]) >>> 0;
  return h;
});
const brightPx = page => page.evaluate(() => {
  const c = document.getElementById('tetris-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 80) n++;
  return n;
});

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#tetris', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ── A. start a run ─────────────────────────────────────────
  await page.keyboard.press(' ');
  await page.waitForTimeout(250);
  const livePx = await brightPx(page);
  ok(livePx > 20, `a fresh run paints a live piece (${livePx} bright px)`);
  ok(await scoreOf(page) === '0', 'score starts at 0');
  ok(!(await overlayShown(page)), 'GAME OVER card is down while the run is live');

  // ── E first, while the piece is still at the top ───────────
  const hashBeforeSlide = await wellHash(page);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(80);
  ok(await wellHash(page) !== hashBeforeSlide, 'ArrowLeft still repaints the well');

  // ── B. P8-TET-2: Space must repaint within 150ms ───────────
  const hashBeforeDrop = await wellHash(page);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.keyboard.press(' ');
  await page.waitForTimeout(150);
  const hashAfterDrop = await wellHash(page);
  const scoreAfterDrop = await scoreOf(page);
  ok(hashAfterDrop !== hashBeforeDrop, 'P8-TET-2: well repaints within 150ms of Space (not on the next gravity tick)');
  ok(+scoreAfterDrop > 0, `P8-TET-2: drop points land on the score panel immediately (${scoreAfterDrop})`);

  // ── C. Space does not scroll ───────────────────────────────
  const y1 = await page.evaluate(() => window.scrollY);
  ok(y1 === y0, `Space does not scroll the page (${y0} → ${y1})`);

  // ── D. repeat guard still holds ────────────────────────────
  const scoreBeforeRepeat = await scoreOf(page);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: ' ', bubbles: true, cancelable: true, repeat: true,
      }));
    });
  }
  await page.waitForTimeout(80);
  ok(await scoreOf(page) === scoreBeforeRepeat, 'held Space does not free-fall a stream (repeat guard intact)');

  // ── F. further hard drops stay sane ────────────────────────
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(' ');
    await page.waitForTimeout(180);
  }
  const afterMore = await scoreOf(page);
  const over = await overlayShown(page);
  const overTxt = await overlayText(page);
  ok(+afterMore >= +scoreAfterDrop, `further hard drops keep a sane score (${afterMore})`);
  ok(!over || /GAME OVER/i.test(overTxt || ''), over
    ? 'a topped-out well shows a clean GAME OVER card'
    : 'the well is still playing after the extra drops');

  // ── G. ─────────────────────────────────────────────────────
  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

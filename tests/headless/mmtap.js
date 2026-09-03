/*
 * P8-MM-1 — Memory Matrix pads must answer the tap you actually made,
 * on a phone-width screen as well as a desktop one (re-runnable, no hooks).
 *
 * The 510px board is clamped by `max-width:100%`, so on a narrow viewport the
 * browser paints it smaller than its coordinate space. padAt() compared raw
 * client offsets against the unscaled layout, so a tap in the middle of a pad
 * was read as a pad to its left — or as no pad at all when it landed in a gap.
 *
 *  A. Desktop (unclamped): tapping the centre of each of the 9 pads lights
 *     that pad — the baseline the phone case has to match.
 *  B. Phone (clamped): the canvas really is painted narrower than 510px.
 *  C. Phone: tapping the centre of each of the 9 pads lights that same pad.
 *  D. Phone: the bottom-right pad — the one furthest from the origin, and so
 *     the worst hit by the missing scale — answers a real tap during play.
 *  E. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

const WIDTH = 510, PAD = 18, CELL = 150, GAP = 12;

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// Which pad is lit right now, read off the canvas: unlit pads are drawn at
// 0.22 alpha over #0d1117, the lit one at full brightness.
const litPad = page => page.evaluate(({ WIDTH, PAD, CELL, GAP }) => {
  const c = document.getElementById('mm-canvas');
  const x = c.getContext('2d');
  const s = c.width / WIDTH;                       // device px per design px
  let best = -1, bestSum = 0;
  for (let i = 0; i < 9; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const cx = (PAD + col * (CELL + GAP) + CELL / 2) * s;
    const cy = (PAD + row * (CELL + GAP) + CELL / 2) * s;
    const d = x.getImageData(Math.round(cx), Math.round(cy), 1, 1).data;
    const sum = d[0] + d[1] + d[2];
    if (sum > bestSum) { bestSum = sum; best = i; }
  }
  return bestSum > 260 ? best : -1;               // nothing bright => nothing lit
}, { WIDTH, PAD, CELL, GAP });

// Tap the visual centre of pad `i`, in real screen coordinates.
async function tapPad(page, i) {
  const box = await page.locator('#mm-canvas').boundingBox();
  const col = i % 3, row = Math.floor(i / 3);
  const fx = (PAD + col * (CELL + GAP) + CELL / 2) / WIDTH;
  const fy = (PAD + row * (CELL + GAP) + CELL / 2) / WIDTH;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(60);
}

// Park the game in 'input' on a fresh 1-step pattern so pad presses are
// accepted and each press lights the pad it was aimed at. Leaving the view
// runs destroy(), which puts the game back in 'idle' — the only phase where
// SPACE starts a run.
async function armInput(page) {
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '#memorymatrix'; });
  await page.waitForTimeout(400);
  await page.keyboard.press(' ');                 // start (idle -> showing)
  await page.waitForTimeout(1600);                // let the 1-step playback finish
  // The caption under the grid reads a green "YOUR TURN" only in phase 'input'.
  return page.evaluate(W => {
    const c = document.getElementById('mm-canvas');
    const x = c.getContext('2d');
    const s = c.width / W;                         // device px per design px
    const top = Math.round(495 * s), h = Math.max(1, Math.round(12 * s));
    const d = x.getImageData(0, top, c.width, h).data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 120 && d[i] < 110) return true;
    return false;
  }, WIDTH);
}

async function padsAnswerTaps(page, label) {
  const wrong = [];
  for (let i = 0; i < 9; i++) {
    ok(await armInput(page), `${label}: pad ${i} — the board is taking input`);
    await tapPad(page, i);
    const lit = await litPad(page);
    if (lit !== i) wrong.push(`${i}->${lit}`);
    await page.waitForTimeout(240);
  }
  ok(wrong.length === 0, `${label}: every pad centre lights its own pad${wrong.length ? ' — got ' + wrong.join(', ') : ''}`);
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  // ---- A. desktop baseline ----
  const wide = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const deskPage = await wide.newPage();
  deskPage.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await deskPage.goto(BASE + '/index.html#memorymatrix', { waitUntil: 'load' });
  await deskPage.waitForTimeout(1200);
  const deskW = (await deskPage.locator('#mm-canvas').boundingBox()).width;
  ok(Math.round(deskW) === WIDTH, `desktop paints the board at its native ${WIDTH}px (got ${Math.round(deskW)})`);
  await padsAnswerTaps(deskPage, 'desktop');

  // ---- B/C/D. phone ----
  const narrow = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await narrow.newPage();
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#memorymatrix', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const box = await page.locator('#mm-canvas').boundingBox();
  ok(box.width < WIDTH - 40, `phone clamps the board to ${Math.round(box.width)}px (< ${WIDTH})`);
  await padsAnswerTaps(page, 'phone');

  // D. the far corner pad, mid-run: it must register, not fall in a gap.
  await armInput(page);
  await tapPad(page, 8);
  ok(await litPad(page) === 8, 'phone: the bottom-right pad answers a tap during play');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

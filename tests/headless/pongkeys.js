/*
 * PONG-1 — held keys must not stick when you leave Pong (re-runnable).
 *
 * Pong's keydown is gated on the active view, which is right: the hub is one
 * page and W/S/arrows belong to whichever game is on screen. Its keyup used
 * to be gated the same way, and nothing cleared the map when the window lost
 * focus — so a key released after you navigated away, or released into
 * another window entirely, was never seen. The rAF loop kept ticking and the
 * paddle slid on by itself.
 *
 *  A. A held key drives the paddle while Pong is on screen (both halves of
 *     the 1P binding: W/S and the arrows).
 *  B. A normal keyup, view active, still stops the paddle.
 *  C. Losing window focus mid-press freezes the paddle (the PONG-1 bug:
 *     revert the fix and this drifts ~90px).
 *  D. The keyboard still works after focus comes back.
 *  E. A keyup delivered while Pong is NOT the active view clears the key
 *     (the second half of PONG-1: revert and this drifts ~70px).
 *  F. Leaving the view by the Games button stops the paddle, and Pong plays
 *     clean when you come back.
 *  G. 2P split bindings survive: arrows drive P2 only, W/S drive P1 only.
 *  H. Zero page errors.
 *
 * Paddles are read off the canvas by colour — P1 blue (#58A6FF), P2 pink
 * (#F778BA), either green (#3FB950) while a PADDLE+ power-up is running.
 * The white ball and the drifting power-ups never reach these two columns.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// Mean y (in logical canvas px) of the paddle drawn in column `x`.
const paddleAt = (page, x) => page.evaluate(col => {
  const c = document.getElementById('pong-canvas');
  const g = c.getContext('2d');
  const scale = c.width / 760;
  const d = g.getImageData(Math.round(col * scale), 0, 1, c.height).data;
  let sum = 0, n = 0;
  for (let y = 0; y < c.height; y++) {
    const r = d[y * 4], gg = d[y * 4 + 1], b = d[y * 4 + 2];
    const blue = b > r + 40 && b > 120;             // P1
    const pink = r > 180 && b > 120 && r > gg + 50; // P2
    const green = gg > r + 60 && gg > 140;          // either, grown
    if (blue || pink || green) { sum += y; n++; }
  }
  return n ? +((sum / n) / scale).toFixed(1) : null;
}, x);

const p1 = page => paddleAt(page, 32);   // left paddle spans x 26–38
const p2 = page => paddleAt(page, 728);  // right paddle spans x 722–734

// toggleMode() resets the table and re-centres both paddles, so two clicks
// are a clean serve in the mode you started in.
async function resetTable(page, mode) {
  for (let i = 0; i < 3; i++) {
    await page.click('#pong-mode-btn');
    if ((await page.textContent('#pong-mode-btn')).trim() === mode) break;
  }
  // Click the middle of the table to serve: pointermove is ignored while the
  // match is stopped, so this starts the rally without nudging a paddle.
  await page.click('#pong-canvas', { position: { x: 380, y: 240 } });
  await page.waitForTimeout(150);
}

// Hold `key` for 120ms, then run `interrupt` and report how far the paddle
// travels in the 250ms after it — 0 if the key map was cleared, ~90px if the
// key is still stuck down.
async function driftAfter(page, key, interrupt, read = p1) {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await interrupt();
  const before = await read(page);
  await page.waitForTimeout(250);
  const after = await read(page);
  return { before, after, drift: +(after - before).toFixed(1) };
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#pong', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ---- A. a held key drives the paddle -------------------------------
  await resetTable(page, 'Mode: VS AI');
  const centre = await p1(page);
  ok(centre !== null && Math.abs(centre - 240) < 12, `P1 serves from mid-table (y=${centre})`);

  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  const upY = await p1(page);
  await page.keyboard.up('w');
  ok(upY < centre - 25, `held W lifts P1 (${centre} → ${upY})`);

  await page.keyboard.down('s');
  await page.waitForTimeout(200);
  const downY = await p1(page);
  await page.keyboard.up('s');
  ok(downY > upY + 25, `held S drops P1 (${upY} → ${downY})`);

  await resetTable(page, 'Mode: VS AI');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(200);
  const arrowY = await p1(page);
  await page.keyboard.up('ArrowUp');
  ok(arrowY < 215, `solo play also takes the arrows (P1 y=${arrowY})`);

  // ---- B. a plain keyup, view active, stops the paddle ----------------
  const held = await p1(page);
  await page.waitForTimeout(250);
  ok(Math.abs((await p1(page)) - held) < 4, 'keyup with Pong on screen stops P1');

  // ---- C. losing focus mid-press freezes the paddle (PONG-1) ----------
  await resetTable(page, 'Mode: VS AI');
  const blur = await driftAfter(page, 'w',
    () => page.evaluate(() => window.dispatchEvent(new Event('blur'))));
  await page.keyboard.up('w');
  ok(blur.before > 60, `P1 clear of the top rail before the blur (y=${blur.before})`);
  ok(Math.abs(blur.drift) < 4,
    `blur clears the held key — P1 frozen at ${blur.before} (drift ${blur.drift}px)`);

  // ---- D. the keyboard survives the trip ------------------------------
  const backY = await p1(page);
  await page.keyboard.down('s');
  await page.waitForTimeout(200);
  const afterBlurY = await p1(page);
  await page.keyboard.up('s');
  ok(afterBlurY > backY + 25, `keys still drive P1 after focus returns (${backY} → ${afterBlurY})`);

  // ---- E. keyup delivered while Pong is not the active view (PONG-1) --
  await resetTable(page, 'Mode: VS AI');
  const away = await driftAfter(page, 's', async () => {
    // The release lands while another view holds .active — exactly what
    // happens when a keypress outlives the navigation that left Pong.
    await page.evaluate(() => {
      document.getElementById('view-pong').classList.remove('active');
      document.getElementById('view-arcade').classList.add('active');
    });
    await page.keyboard.up('s');
    await page.evaluate(() => {
      document.getElementById('view-arcade').classList.remove('active');
      document.getElementById('view-pong').classList.add('active');
    });
  });
  ok(away.before < 420, `P1 clear of the bottom rail before the release (y=${away.before})`);
  ok(Math.abs(away.drift) < 4,
    `keyup outside the active view clears the key — P1 frozen at ${away.before} (drift ${away.drift}px)`);

  // ---- F. leaving by the Games button --------------------------------
  await resetTable(page, 'Mode: VS AI');
  await page.keyboard.down('w');
  await page.waitForTimeout(120);
  await page.click('#view-pong .game-back-btn');
  await page.waitForTimeout(150);
  await page.keyboard.up('w');           // released on the arcade grid
  await page.click('[data-view="pong"]');
  await page.waitForTimeout(200);
  await page.click('#pong-canvas', { position: { x: 380, y: 240 } });
  await page.waitForTimeout(150);
  const rejoin = await p1(page);
  await page.waitForTimeout(250);
  const rejoinLater = await p1(page);
  ok(Math.abs(rejoin - 240) < 12, `coming back re-centres P1 (y=${rejoin})`);
  ok(Math.abs(rejoinLater - rejoin) < 4,
    `no paddle drifts on its own after leaving and returning (drift ${(rejoinLater - rejoin).toFixed(1)}px)`);

  // ---- G. 2P split bindings ------------------------------------------
  await resetTable(page, 'Mode: 2 PLAYERS');
  const twoP1 = await p1(page), twoP2 = await p2(page);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(200);
  const arrowP1 = await p1(page), arrowP2 = await p2(page);
  await page.keyboard.up('ArrowUp');
  ok(arrowP2 < twoP2 - 25, `2P: arrows lift P2 (${twoP2} → ${arrowP2})`);
  ok(Math.abs(arrowP1 - twoP1) < 4, '2P: arrows leave P1 alone');

  await page.keyboard.down('s');
  await page.waitForTimeout(200);
  const wP1 = await p1(page), wP2 = await p2(page);
  await page.keyboard.up('s');
  ok(wP1 > twoP1 + 25, `2P: S drops P1 (${twoP1} → ${wP1})`);
  ok(Math.abs(wP2 - arrowP2) < 4, '2P: S leaves P2 alone');

  const blur2 = await driftAfter(page, 'ArrowDown',
    () => page.evaluate(() => window.dispatchEvent(new Event('blur'))), p2);
  await page.keyboard.up('ArrowDown');
  ok(Math.abs(blur2.drift) < 4,
    `2P: blur freezes P2 too at ${blur2.before} (drift ${blur2.drift}px)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

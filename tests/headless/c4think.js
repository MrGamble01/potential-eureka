/*
 * C4-1 — Drop Four: the AI's think delay must not outlive its board.
 *
 * afterMove() arms `setTimeout(aiMove, 260)` so the AI doesn't reply
 * instantly. Nothing cancelled it. New Game / vs AI / 2 Player / a
 * difficulty button all rebuild the board through newGame(), and the
 * armed timer then fired against the NEW position:
 *   - on an untouched board the AI opened the game for you;
 *   - if you had already dropped, startDrop() overwrote the disc still
 *     falling and your move was swallowed whole.
 *
 *  A. Baseline: a normal drop still gets a normal AI reply.
 *  B. New Game mid-think leaves an empty board and your turn.
 *  C. A drop right after New Game mid-think lands and is answered.
 *  D. Switching to 2 Player mid-think doesn't put an AI disc in hotseat.
 *  E. A difficulty switch mid-think leaves an empty board.
 *  F. Zero page errors.
 *
 * Hook-free: the board is read off the canvas by disc colour (red
 * #e63946 = player, yellow #f7c948 = AI), which is also the only thing
 * the player can see.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// Discs settled on the board, by colour. The falling disc is drawn behind
// the board mask, so this only ever counts discs that have actually landed.
const discs = page => page.evaluate(() => {
  const c = document.getElementById('c4-canvas');
  const x = c.getContext('2d');
  const COLS = 7, ROWS = 6, cw = c.width / COLS, ch = c.height / ROWS;
  let red = 0, yellow = 0;
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const d = x.getImageData(Math.floor(col * cw + cw / 2), Math.floor(r * ch + ch / 2), 1, 1).data;
    const hex = [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    if (hex === 'e63946') red++;
    else if (hex === 'f7c948') yellow++;
  }
  return { red, yellow };
});

const turnText = page => page.textContent('#c4-turn');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  await page.goto(BASE + '/index.html#connect4', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const box = await page.evaluate(() => {
    const r = document.getElementById('c4-canvas').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  const dropIn = col => page.mouse.click(box.x + (col + 0.5) * (box.w / 7), box.y + box.h / 2);
  const newGame = () => page.click('#view-connect4 button.primary');

  // Drop a disc and return once it has landed and the AI's delay is armed.
  // Returns the board as seen at that instant — the window we act inside.
  async function dropAndCatchThink(col) {
    await dropIn(col);
    await page.waitForFunction(
      () => document.getElementById('c4-turn').textContent.includes('AI thinking'),
      null, { timeout: 8000 });
    return discs(page);
  }
  // Reset to a fresh vs-AI game between sections without going through
  // newGame() — that is the thing under test.
  async function freshPage() {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
  }

  // ── A. baseline: the AI does reply, so "no yellow disc" means something ──
  let seen = await dropAndCatchThink(3);
  ok(seen.red === 1 && seen.yellow === 0, `the drop landed and the AI hasn't replied yet (${seen.red}R/${seen.yellow}Y)`);
  await page.waitForTimeout(2000);
  seen = await discs(page);
  ok(seen.red === 1 && seen.yellow === 1, `baseline: the AI answers a normal drop (${seen.red}R/${seen.yellow}Y)`);
  ok((await turnText(page)).includes('Your move'), 'baseline: the turn comes back to you');

  // ── B. New Game during the think delay ──
  await freshPage();
  seen = await dropAndCatchThink(3);
  ok(seen.yellow === 0, 'B: caught the window — the AI had not played when New Game was pressed');
  await newGame();
  // The canvas repaints on the next rAF frame, not on the click, so give it one.
  await page.waitForTimeout(150);
  ok(JSON.stringify(await discs(page)) === '{"red":0,"yellow":0}', 'B: New Game clears the board');
  await page.waitForTimeout(2000);
  seen = await discs(page);
  ok(seen.yellow === 0, `C4-1: the stale think delay no longer opens the new game for you (${seen.yellow} AI discs)`);
  ok(seen.red === 0 && seen.yellow === 0, 'B: the new board is still untouched two seconds later');
  ok((await turnText(page)).includes('Your move'), 'B: it is still your move on the new board');

  // ── C. your first drop on the new board is not swallowed ──
  await freshPage();
  seen = await dropAndCatchThink(3);
  ok(seen.yellow === 0, 'C: caught the window');
  await newGame();
  await dropIn(0);
  await page.waitForTimeout(2500);
  seen = await discs(page);
  ok(seen.red === 1, `C4-1: a drop made right after New Game still lands (${seen.red} player discs)`);
  ok(seen.yellow === 1, `C: and the AI answers it exactly once (${seen.yellow} AI discs)`);

  // ── D. 2 Player hotseat must not inherit an AI move ──
  await freshPage();
  seen = await dropAndCatchThink(3);
  ok(seen.yellow === 0, 'D: caught the window');
  await page.click('#view-connect4 .c4-mode-btn[data-mode="2p"]');
  await page.waitForTimeout(2000);
  seen = await discs(page);
  ok(seen.red === 0 && seen.yellow === 0, `C4-1: switching to 2 Player mid-think starts an empty hotseat board (${seen.red}R/${seen.yellow}Y)`);
  ok((await turnText(page)).includes("Red's move"), "D: hotseat opens on Red's move");

  // ── E. a difficulty switch goes through newGame() too ──
  await page.click('#view-connect4 .c4-mode-btn[data-mode="ai"]');
  await page.waitForTimeout(300);
  seen = await dropAndCatchThink(3);
  ok(seen.yellow === 0, 'E: caught the window');
  await page.click('#view-connect4 .c4-diff-btn[data-diff="easy"]');
  await page.waitForTimeout(2000);
  seen = await discs(page);
  ok(seen.red === 0 && seen.yellow === 0, `C4-1: a difficulty switch mid-think starts an empty board (${seen.red}R/${seen.yellow}Y)`);

  // ── F. clean console ──
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

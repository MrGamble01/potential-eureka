/*
 * P5 — 2048 one-step undo (re-runnable, no hooks).
 *  A. Undo button starts disabled; a move enables it.
 *  B. Z restores the exact pre-move board (canvas signature) and score.
 *  C. One step only: a second Z changes nothing.
 *  D. Daily runs never enable undo, and Z is inert there.
 *  E. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const boardSig = page => page.evaluate(() => {
  const c = document.getElementById('g2048-canvas');
  const x = c.getContext('2d');
  const n = 4, cw = c.width / n, ch = c.height / n, out = [];
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    const d = x.getImageData(Math.floor(col * cw + cw / 2), Math.floor(r * ch + ch / 2), 1, 1).data;
    out.push(d[0] + ',' + d[1] + ',' + d[2]);
  }
  return out.join('|');
});
const scoreOf = page => page.evaluate(() => document.getElementById('g2048-score').textContent);
const undoDisabled = page => page.evaluate(() => document.getElementById('g2048-undo-btn').disabled);

// Try directions until one actually changes the board.
async function makeMove(page, sig0) {
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(450);
    if (await boardSig(page) !== sig0) return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#2048', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.keyboard.press(' ');
  await page.waitForTimeout(500);

  // A. disabled → move → enabled
  ok(await undoDisabled(page), 'undo button starts disabled');
  const sig0 = await boardSig(page);
  const score0 = await scoreOf(page);
  ok(await makeMove(page, sig0), 'a move changed the board');
  ok(!(await undoDisabled(page)), 'undo button enables after a move');

  // B. Z restores board + score
  await page.keyboard.press('z');
  await page.waitForTimeout(300);
  ok(await boardSig(page) === sig0, 'Z restores the exact pre-move board');
  ok(await scoreOf(page) === score0, `Z restores the pre-move score (${score0})`);
  ok(await undoDisabled(page), 'undo button disables again after undoing (one step)');

  // C. second Z inert
  const sigAfterUndo = await boardSig(page);
  await page.keyboard.press('z');
  await page.waitForTimeout(250);
  ok(await boardSig(page) === sigAfterUndo, 'second Z changes nothing');

  // D. daily runs: no undo
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(600);
  await page.click('.daily-chip[data-game="game2048"]');
  await page.waitForTimeout(800);
  await page.keyboard.press(' ');
  await page.waitForTimeout(500);
  const dSig0 = await boardSig(page);
  ok(await makeMove(page, dSig0), 'daily: a move changed the board');
  ok(await undoDisabled(page), 'daily: undo button stays disabled');
  const dSig1 = await boardSig(page);
  await page.keyboard.press('z');
  await page.waitForTimeout(250);
  ok(await boardSig(page) === dSig1, 'daily: Z is inert');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

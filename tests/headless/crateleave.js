/*
 * CRATE-1 — the solved puzzle survives leaving the view (re-runnable).
 *
 * Crate Escape's only path to the next puzzle is the `solvedNow` flag:
 * SPACE, Enter and tapping the win overlay all check it. destroy() — which
 * the shell runs on every view switch — used to clear that flag and hide the
 * overlay, so anyone who solved a level and stepped out came back to a board
 * with every crate on its pad, no win panel, and all three "next puzzle"
 * affordances silently dead.
 *
 *  A. Level 1 solves (seeded walk on the real, deterministic level 1).
 *  B. Leaving for the arcade and returning keeps the win overlay up.
 *  C. SPACE on return still advances to level 2 and clears the overlay.
 *  D. Leaving mid-puzzle (unsolved) still leaves no overlay behind.
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
  await page.goto(BASE + '/index.html#crateescape', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const overlayUp = () => page.evaluate(() =>
    document.getElementById('crate-overlay').style.display === 'flex');
  const hudLevel = () => page.evaluate(() =>
    document.getElementById('crate-level').textContent);

  // A. Solve level 1. Levels are generated from a per-level seed, so level 1
  // is the same room for everyone; a seeded random walk (restart, wander,
  // repeat) finds its solution deterministically without this suite having to
  // carry a copy of the generator or a hand-transcribed move list.
  const solvedIt = await page.evaluate(() => {
    let a = 12345;
    const rnd = () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const press = k => document.dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const won = () => document.getElementById('crate-overlay').style.display === 'flex';
    for (let attempt = 0; attempt < 400; attempt++) {
      press('r');                                   // restart the level
      for (let i = 0; i < 120; i++) {
        press(KEYS[Math.floor(rnd() * 4)]);
        if (won()) return true;
      }
    }
    return false;
  });
  ok(solvedIt, 'level 1 solves — win overlay up');
  const winText = await page.evaluate(() => document.getElementById('crate-overlay').textContent);
  ok(/Solved in \d+ moves/.test(winText), `win panel reads "${winText.slice(0, 40)}…"`);
  ok(await hudLevel() === '1', 'still on level 1');

  // B. Step out to the arcade and come back.
  await page.click('#view-crateescape .game-back-btn');
  await page.waitForTimeout(300);
  await page.click('.arcade-card[data-view="crateescape"]');
  await page.waitForTimeout(400);
  ok(await overlayUp(), 'the win overlay is still up after leaving and returning');
  ok(await hudLevel() === '1', 'the solved level is still the one on screen');

  // C. And the flag behind it survived, so SPACE still means "next puzzle".
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  ok(await hudLevel() === '2', 'SPACE on return advances to level 2');
  ok(!(await overlayUp()), 'the new puzzle starts with no overlay');

  // D. Leaving an unsolved puzzle still leaves nothing behind.
  await page.click('#view-crateescape .game-back-btn');
  await page.waitForTimeout(300);
  await page.click('.arcade-card[data-view="crateescape"]');
  await page.waitForTimeout(400);
  ok(!(await overlayUp()), 'no overlay after leaving mid-puzzle and returning');
  ok(await hudLevel() === '2', 'mid-puzzle level is preserved across the trip');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/*
 * Snake — pause (re-runnable, no hooks).
 *  Every real-time arcade game but Age of War had no way to step away
 *  mid-run without either dying to the clock or abandoning the board.
 *  Snake gets a P toggle: freeze the tick loop, ignore steering input,
 *  and put a PAUSED overlay up so a frozen frame doesn't read as a hang.
 *
 *  A. P freezes the board: two canvas snapshots taken seconds apart while
 *     paused are byte-identical (no ticks landed).
 *  B. The pause overlay's PAUSED text actually paints — a visible jump in
 *     bright pixels versus the live frame it interrupted.
 *  C. A second P resumes: the board changes again afterward.
 *  D. No game-over fires during a pause that outlasts several tick
 *     intervals — the wall/tail clock is suspended, not just slowed.
 *  E. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const snapshot = page => page.evaluate(() => document.getElementById('snake-canvas').toDataURL());
// Most of the board is near-black background even mid-run, so an overall
// average brightness barely moves under a 0.7-alpha scrim over near-black;
// the PAUSED/"Press P to resume" text is what actually shows up, as a
// jump in the count of bright pixels.
const brightPixels = page => page.evaluate(() => {
  const c = document.getElementById('snake-canvas');
  const x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 200) n++; }
  return n;
});
const overlayHidden = page => page.evaluate(() =>
  document.getElementById('snake-overlay').style.display === 'none');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => localStorage.setItem('eureka-primer-seen', '1'));
  await page.goto(BASE + '/index.html#snake', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Start a run and let it move a few ticks off the spawn cell.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const liveBright = await brightPixels(page);

  // A/B. Pause, then the board is frozen and dimmer than the live frame.
  await page.keyboard.press('p');
  await page.waitForTimeout(120);
  const paused1 = await snapshot(page);
  const pausedBright = await brightPixels(page);
  await page.waitForTimeout(600); // several tick intervals at Classic pace (120ms)
  const paused2 = await snapshot(page);
  ok(paused1 === paused2, 'paused board is byte-identical across several tick intervals');
  ok(pausedBright > liveBright * 1.5, `paused overlay's text paints (${pausedBright} bright px vs live ${liveBright})`);

  // D. Still alive — the pause suspended the clock rather than just riding
  // it out in the background.
  ok(await overlayHidden(page), 'no game-over overlay after a long pause');

  // C. Resume: the board moves again.
  await page.keyboard.press('p');
  await page.waitForTimeout(500);
  const resumed = await snapshot(page);
  ok(resumed !== paused2, 'a second P resumes and the board changes again');
  ok(await overlayHidden(page), 'still alive after resuming');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

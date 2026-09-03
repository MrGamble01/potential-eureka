/* HV-60 — the camp's residents walk, they don't teleport-and-vibrate.
 *
 * main.js's frame() normalised the NPC wander step with `dt*.016*60`
 * (= dt*0.96) where the hub's convention is "frames elapsed at 60fps"
 * (= dt/16.667, i.e. dt*0.06). That is exactly 16x, so a resident whose
 * `speed` reads 0.02 units/frame moved 0.32 — 19.2 units/second against
 * the player's 4.2, crossing the whole 22-unit camp in about a second.
 * Worse, a 0.32 step overshoots the 0.1-unit "arrived" test, so a
 * resident that lands 0.1-0.22 short of its target ping-pongs across it
 * for the whole 3-8s until the next target is picked.
 *
 *  A. One 60fps frame advances a resident by its own `speed`, not 16x it.
 *  B. The step scales with dt (half a frame moves half as far).
 *  C. Residents shuffle slower than the player's 4.2 u/s, not 4x faster.
 *  D. A resident approaching its target settles on it instead of
 *     oscillating across it forever.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const FRAME = 1000 / 60;   // the ms the hub's dt normalisation is built around

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // Drive frame() by hand with chosen timestamps: headless rAF has a clock of
  // its own, and the whole point of the fix is what one *known* dt does.
  // A far target and a parked wanderTimer keep the walk in a straight line.
  const walk = (speed, steps, dt) => page.evaluate(({ speed, steps, dt }) => {
    const f = figures.find(x => x.userData.type === 'community')
      || spawnFigure(0, 0, 'community');
    f.position.set(0, 0, 0);
    f.userData.target.set(40, 0, 0);
    f.userData.wanderTimer = 1e9;
    f.userData.speed = speed;
    let ts = 1e6;
    frame(ts);                                   // seed lastTime
    const from = f.position.x;
    for (let i = 0; i < steps; i++) frame(ts += dt);
    return f.position.x - from;
  }, { speed, steps, dt });

  // ---- A. one frame moves one `speed` ----
  const oneFrame = await walk(0.02, 1, FRAME);
  ok(Math.abs(oneFrame - 0.02) < 0.002,
    `one 60fps frame moves a 0.02-speed resident 0.02u (got ${oneFrame.toFixed(4)})`);

  // ---- B. and it scales with dt ----
  const halfFrame = await walk(0.02, 1, FRAME / 2);
  ok(Math.abs(halfFrame - 0.01) < 0.002,
    `half a frame moves half as far (got ${halfFrame.toFixed(4)})`);

  // ---- C. residents shuffle; the player strides ----
  const perSecond = await walk(0.02, 60, FRAME);
  ok(perSecond > 0.6 && perSecond < 2.0,
    `a resident covers ~1.2 u/s, well under the player's 4.2 (got ${perSecond.toFixed(2)})`);
  const fastest = await walk(0.035, 60, FRAME);
  ok(fastest < 4.2,
    `even the fastest resident (speed .035) stays slower than the player (got ${fastest.toFixed(2)} u/s)`);

  // ---- D. arriving settles instead of ping-ponging ----
  const settle = await page.evaluate(({ FRAME }) => {
    const f = figures.find(x => x.userData.type === 'community')
      || spawnFigure(0, 0, 'community');
    f.userData.wanderTimer = 1e9;
    f.userData.speed = 0.02;
    f.userData.target.set(0, 0, 0);
    f.position.set(0.2, 0, 0);                   // the ping-pong band: 0.1-0.22
    let ts = 2e6;
    frame(ts);
    const seen = [];
    for (let i = 0; i < 600; i++) { frame(ts += FRAME); seen.push(f.position.x); }
    const tail = seen.slice(-120);
    return { final: Math.abs(f.position.x), spread: Math.max(...tail) - Math.min(...tail) };
  }, { FRAME });
  ok(settle.final <= 0.1 + 1e-6,
    `a resident that walks up to its target stops on it (ended ${settle.final.toFixed(3)}u away)`);
  ok(settle.spread < 1e-6,
    `and stays put instead of oscillating across it (last 120 frames spread ${settle.spread.toFixed(4)}u)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

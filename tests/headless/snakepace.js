/*
 * SNAKE-1 — Snake's Pace button must name the pace the run is actually on.
 *
 * A daily run overrides the tick to Classic on purpose (start(): "a
 * shared-fate board isn't comparable if one player crawled it on Chill"),
 * and Daily's arm is sticky for the view, so every restart in there is daily
 * too. The button went on showing the saved pace through all of it — BLITZ
 * over a snake moving at Classic — and a click still cycled the label and
 * rewrote `snake-pace`, so the control answered a press it could not honour
 * and quietly changed tomorrow's setting. The one place the rule was written
 * down was the button's `title`, which a touch screen never shows.
 *
 *  A. Ground truth, measured, not assumed: with `snake-pace` saved as blitz,
 *     a free run schedules its loop at 92ms and the daily run schedules 120ms.
 *     Everything below is about a control that has to agree with that.
 *  B. SNAKE-1: during the daily run the button names Classic, not Blitz.
 *  C. SNAKE-1: it does not take a click it cannot honour — disabled, and the
 *     inline onclick path leaves both the label and `snake-pace` alone.
 *  D. Baseline, so "nail the button shut" can't pass: back in free play it
 *     cycles, persists, and retimes a live run (a 150ms loop is scheduled).
 *  E. Zero page errors.
 *
 * Hook-free (QA-23): `setInterval` is wrapped from the TEST, the way `sticky`
 * stubs Math.random — nothing is bolted onto the game to see inside it.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// js/snake.js PACES / PACE_ORDER
const CHILL = 150, CLASSIC = 120, BLITZ = 92;
const PACES = { chill: CHILL, classic: CLASSIC, blitz: BLITZ };
const PACE_ORDER = ['chill', 'classic', 'blitz'];

const label = page => page.textContent('#snake-pace-btn').then(t => t.trim());
const locked = page => page.evaluate(() => document.getElementById('snake-pace-btn').disabled);
const saved = page => page.evaluate(() => localStorage.getItem('snake-pace'));
const now = page => page.evaluate(() => Date.now());
// Loop delays the page scheduled since a marker. start() schedules last, so
// the FIRST entry after the marker is the pace the run opened on; eating food
// reschedules a couple of ms faster, which is why only the first is read.
const scheduledSince = (page, t) =>
  page.evaluate(t => window.snakeIntervalLog.filter(e => e.t >= t).map(e => e.ms), t);

const go = async (page, hash) => {
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForTimeout(700);
};

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  await page.addInitScript(() => {
    localStorage.setItem('snake-pace', 'blitz');
    window.snakeIntervalLog = [];
    const orig = window.setInterval;
    window.setInterval = function (fn, ms, ...rest) {
      try { window.snakeIntervalLog.push({ ms, t: Date.now() }); } catch (e) {}
      return orig.call(window, fn, ms, ...rest);
    };
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ── A. ground truth ───────────────────────────────────────────────────
  await go(page, '#snake');
  ok(await label(page) === 'Pace: BLITZ', 'a saved pace of blitz shows on the idle button');

  let t = await now(page);
  await page.keyboard.press(' ');
  await page.waitForTimeout(500);
  let sched = await scheduledSince(page, t);
  ok(sched[0] === BLITZ, `a free run really ticks at the saved pace (${sched[0]}ms, blitz is ${BLITZ}ms)`);

  await go(page, '#arcade');            // destroy() disarms whatever was armed
  await page.click('.daily-chip[data-game="snake"]');   // arms + routes to #snake
  await page.waitForTimeout(900);

  t = await now(page);
  await page.keyboard.press(' ');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => Daily.isActive('snake')), 'the daily run is armed and seeded');
  sched = await scheduledSince(page, t);
  ok(sched[0] === CLASSIC,
    `and it is locked to Classic despite the saved blitz (${sched[0]}ms, classic is ${CLASSIC}ms)`);

  // ── B. the button names the pace the run is on ────────────────────────
  const dailyLabel = await label(page);
  ok(/CLASSIC/i.test(dailyLabel),
    `SNAKE-1: the button names the pace the run is actually on — "${dailyLabel}"`);
  ok(!/BLITZ/i.test(dailyLabel),
    'SNAKE-1: it no longer advertises the saved pace the daily just overrode');
  ok(/daily/i.test(dailyLabel), 'and it says why, on the button rather than in a tooltip');

  // ── C. it does not take a press it cannot honour ──────────────────────
  ok(await locked(page), 'SNAKE-1: the control is disabled while the daily holds the pace');
  // The inline onclick is still reachable even with the button disabled, so
  // drive that path directly rather than through a click Playwright refuses.
  const before = await label(page);
  t = await now(page);
  await page.evaluate(() => SnakeGame.cyclePace());
  await page.evaluate(() => SnakeGame.cyclePace());
  await page.waitForTimeout(300);
  ok(await label(page) === before, 'SNAKE-1: cycling mid-daily cannot change the label');
  ok(await saved(page) === 'blitz',
    `SNAKE-1: and it no longer rewrites your saved pace behind the run (${await saved(page)})`);
  // Baseline, and a note on what was never broken: the run's tick was always
  // right — cyclePace()'s retime has always been gated on !dailyRun. What was
  // wrong was only ever the control's account of it. This row passes either
  // way on purpose, so the failures above name the defect and nothing else.
  ok(!(await scheduledSince(page, t)).includes(CHILL),
    'baseline: the daily loop was never actually retimed — the clock was fine, the button lied');

  // ── D. baseline: free play still has a working pace control ───────────
  // Read the saved pace rather than assuming one, so this section is a real
  // baseline instead of a cascade of whatever section C left behind.
  await go(page, '#arcade');
  await go(page, '#snake');
  ok(!(await locked(page)), 'leaving the daily hands the control back');
  const from = await saved(page);
  ok(await label(page) === 'Pace: ' + from.toUpperCase(),
    `and the unlocked button agrees with the saved pace (${from})`);

  // Wrap on, so the run is still live when the click lands.
  await page.click('#snake-wrap-btn');
  await page.keyboard.press(' ');
  await page.waitForTimeout(200);
  const to = PACE_ORDER[(PACE_ORDER.indexOf(from) + 1) % PACE_ORDER.length];
  t = await now(page);
  await page.click('#snake-pace-btn');
  await page.waitForTimeout(300);
  ok(await label(page) === 'Pace: ' + to.toUpperCase(),
    `free play: the button still cycles (${from} → ${to})`);
  ok(await saved(page) === to, 'free play: the pick is still persisted');
  ok((await scheduledSince(page, t)).includes(PACES[to]),
    `free play: a live run is still retimed on the spot (${PACES[to]}ms scheduled)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

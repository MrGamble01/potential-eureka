/*
 * ARC-10 — Neon Breaker's sticky paddle must announce itself.
 *
 * Neon Breaker drops five power-ups (POWER_META: multi, wide, slow, sticky,
 * life). Two of them were undocumented and one of those changes the controls:
 * the ⊙ sticky paddle CATCHES the ball and holds it until you release it with
 * the same click/tap/Space that launches. The on-canvas launch prompt is gated
 * on `!launched`, so once a run was under way a caught ball sat glued to the
 * paddle with nothing on screen explaining it — it read as a freeze.
 *
 *  A. The on-page power-up legend names every kind the game can actually drop.
 *  B. Drive a real run with a stubbed Math.random so every cleared brick drops
 *     a sticky paddle, catch one, catch the ball with it, and assert the
 *     release prompt is painted in the band the launch prompt uses.
 *  C. It is the RELEASE prompt, not the launch one. A ball waiting to launch
 *     rests at exactly the same height as a caught ball, so the two states are
 *     told apart twice over: the life counter must not have moved since the
 *     launch (a ball only returns to rest height by being caught or by costing
 *     a life), and the painted line must be wider than the launch prompt.
 *  D. The prompt is honest: Space releases the ball and the line clears.
 *  E. Zero page errors.
 *
 * Re-runnable, no hooks: Math.random is stubbed from the test, not from the
 * game, and the prompt is read off the canvas rather than from game state.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// The play field is 720x520 logical px; the backing store is scaled by dpr.
// Sample a horizontal band and report the matching pixels' count, centre and
// horizontal extent (the centre steers the paddle, the extent identifies which
// of the two prompts is on screen).
const band = (page, y0, y1, kind) => page.evaluate(([y0, y1, kind]) => {
  const hit = {
    cyan:  (r, g, b) => b > 180 && g > 150 && r < 120,   // the ball and the paddle
    pink:  (r, g, b) => r > 190 && b > 140 && g < 160,   // a falling ⊙ sticky power-up
    white: (r, g, b) => r > 175 && g > 175 && b > 185,   // prompt text (#E6EDF3)
  }[kind];
  const c = document.getElementById('breakout-canvas');
  const x = c.getContext('2d');
  const s = c.width / 720;
  let lo = -1, hi = -1, count = 0;
  for (let yy = y0; yy <= y1; yy++) {
    const d = x.getImageData(0, Math.round(yy * s), c.width, 1).data;
    for (let i = 0; i < c.width; i++) {
      if (!hit(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])) continue;
      count++;
      const lx = i / s;
      if (lo < 0 || lx < lo) lo = lx;
      if (lx > hi) hi = lx;
    }
  }
  return { count, mid: lo < 0 ? null : (lo + hi) / 2, width: lo < 0 ? 0 : hi - lo };
}, [y0, y1, kind]);

// Both prompts are drawn at HEIGHT - 70 = y 450.
const promptBand = page => band(page, 440, 462, 'white');
// A ball at rest — caught, or waiting to launch — sits at
// PADDLE_Y - BALL_R - 1 = y 478. The paddle itself starts at y 486, below.
const restBand = page => band(page, 468, 482, 'cyan');
const lives = page => page.evaluate(() => {
  const el = document.getElementById('breakout-lives');
  return el ? el.textContent.trim() : '';
});

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  await page.goto(BASE + '/index.html#breakout', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ---- A. the legend covers every power-up the game can drop ----
  // Deepest match only: an ancestor's textContent would sweep in the ♥♥♥ life
  // counter from the info bar and pass the extra-life row for free.
  const legend = await page.evaluate(() => {
    const hits = [...document.querySelectorAll('#view-breakout div')]
      .filter(d => /Power-ups:/.test(d.textContent));
    return hits.length ? hits[hits.length - 1].textContent.replace(/\s+/g, ' ') : '';
  });
  ok(!/Score/.test(legend), 'the legend row is read on its own, not through a parent');
  // The glyphs are POWER_META's — what actually falls out of a brick.
  for (const [kind, glyph] of [['multiball', '×3'], ['wide paddle', '↔'], ['slow-mo', '⏱'],
                               ['sticky paddle', '⊙'], ['extra life', '♥']]) {
    ok(legend.includes(glyph), `legend names the ${kind} power-up (${glyph})`);
  }

  // ---- B. catch the ball with a sticky paddle ----
  // 0.1 < 0.12 clears the drop roll, and 0.08 <= 0.1 < 0.30 picks 'sticky',
  // so every brick destroyed from here drops the power-up under test.
  await page.evaluate(() => { Math.random = () => 0.1; });

  const box = await page.locator('#breakout-canvas').boundingBox();
  const toClient = lx => box.x + (lx / 720) * box.width;

  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);   // start the run
  await page.waitForTimeout(400);
  const idle = await promptBand(page);
  ok(idle.count > 0, 'before launch the field prompts you to launch');

  await page.keyboard.press(' ');                                           // launch
  await page.waitForTimeout(300);
  ok((await promptBand(page)).count === 0, 'the launch prompt clears once the ball is away');

  // Autoplay: chase a falling power-up when there is one, else track the ball.
  // A ball back at rest height for several consecutive polls without the life
  // counter moving can only have been caught — a live ball crosses that band
  // in a frame or two, and the other way back to rest costs a life.
  let livesAtLaunch = await lives(page);
  let stuckPolls = 0, caught = false, relaunches = 0;
  for (let i = 0; i < 1200 && !caught; i++) {
    const now = await lives(page);
    if (now !== livesAtLaunch) {
      // Lost a life (or picked one up): the ball is idle on the paddle. Send
      // it off again and start counting from a known-clean state.
      if (!now) break;
      await page.keyboard.press(' ');
      await page.waitForTimeout(120);
      livesAtLaunch = now; stuckPolls = 0; relaunches++;
      if (relaunches > 12) break;
      continue;
    }
    const pu = await band(page, 240, 470, 'pink');
    const ball = await band(page, 60, 470, 'cyan');
    const target = pu.mid != null ? pu.mid : (ball.mid != null ? ball.mid : 360);
    await page.mouse.move(toClient(target), box.y + box.height * 0.94);
    const rest = await restBand(page);
    stuckPolls = (rest.count > 0 && pu.mid == null) ? stuckPolls + 1 : 0;
    caught = stuckPolls >= 6;
  }
  ok(caught, 'the sticky paddle caught the ball');
  ok(caught && (await lives(page)) === livesAtLaunch,
    'the ball came to rest without costing a life — it was caught, not respawned');

  // ---- C. the line on screen is the release prompt, not the launch one ----
  const held = await promptBand(page);
  ok(held.count > 0, 'a caught ball is explained on the field instead of just sitting there');
  ok(held.width > idle.width,
    `the line reads as a release prompt, not the launch prompt (${Math.round(held.width)}px vs ${Math.round(idle.width)}px)`);

  // ---- D. and it tells the truth ----
  await page.keyboard.press(' ');
  await page.waitForTimeout(350);
  ok((await restBand(page)).count === 0, 'Space releases the caught ball');
  ok((await promptBand(page)).count === 0, 'the release prompt clears with the ball');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

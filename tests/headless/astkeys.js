/*
 * AST-1 — Vector Storm must not keep flying a key you already let go of
 * (re-runnable).
 *
 * Asteroids gates keydown on the active view — right, the hub is one page —
 * and leaves keyup un-gated, which is also right: a release is the end of a
 * command, not one that needs permission. What nothing answered was the
 * release that never arrives at all. Alt-tab while you are turning and the
 * keyup lands in the other window; `keys.left` stays true, the rAF loop keeps
 * ticking, and you come back to a ship spinning on the spot with the engine
 * still burning.
 *
 *  A. The ship reads: it starts mid-screen, facing up.
 *  B. A held turn key turns it, and a normal keyup stops the turn.
 *  C. Losing window focus mid-press stops it too (the AST-1 bug: revert the
 *     fix and the ship turns another ~110° in the next 450ms).
 *  D. The keyboard still works once focus comes back.
 *  E. A keyup delivered while Vector Storm is NOT the active view stops the
 *     turn — the un-gated-keyup half of the idiom, guarded so it can't
 *     regress into `whenViewActive` the way Pong's had (PONG-1).
 *  F. Thrust: held ↑ fires the engine and a blur cuts it — measured on the
 *     exhaust itself, which only `keys.thrust` can draw.
 *  G. Leaving by the Games button and coming back flies clean.
 *  H. Zero page errors.
 *
 * Hook-free. The ship is read off the canvas by colour: it is the only cyan
 * (#22d3ee) thing within 22px of mid-table — rocks spawn at least 140px clear
 * of it, and a ship that is only turning never leaves the spot — and its nose
 * is the point of that cluster furthest from its centroid, which gives the
 * facing in degrees. The exhaust is the only warm colour the game ever draws
 * (rocks are hue 190/265/330, bullets and stars white, hyperspace purple,
 * extra-life green), so a pixel with red over green over blue is thrust and
 * nothing else.
 *
 * Every measurement opens on a fresh New Game so the ship is centred, clear
 * of the respawn blink, and inside the window before any rock can drift into
 * it — a wandering rock mid-measurement would be a flaky suite, not a bug.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// Shortest signed arc between two headings, in degrees.
const turned = (a, b) => {
  if (a === null || b === null) return null;
  let d = (b - a) % 360;
  if (d > 180) d -= 360; else if (d < -180) d += 360;
  return +d.toFixed(1);
};

// The ship's facing, read from the cyan cluster around mid-table.
const facing = page => page.evaluate(() => {
  const c = document.getElementById('asteroids-canvas');
  const dpr = c.width / 720, R = 22, w = Math.round(2 * R * dpr);
  const d = c.getContext('2d')
    .getImageData(Math.round((360 - R) * dpr), Math.round((260 - R) * dpr), w, w).data;
  const pts = [];
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i] < 62 && d[i + 1] > 140 && d[i + 2] > 170) pts.push([x / dpr, y / dpr]);
  }
  if (pts.length < 20) return null;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let nose = pts[0], far = -1;
  for (const p of pts) {
    const dd = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
    if (dd > far) { far = dd; nose = p; }
  }
  return { n: pts.length, deg: +(Math.atan2(nose[1] - cy, nose[0] - cx) * 180 / Math.PI).toFixed(1) };
});
const deg = async page => { const s = await facing(page); return s && s.deg; };

// Exhaust pixels: the orange (#F0883E) particles `keys.thrust` emits, alpha-
// blended over the #0d1117 field, where blue leads on everything unlit.
const exhaust = page => page.evaluate(() => {
  const c = document.getElementById('asteroids-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 30 && r > g + 6 && g > b + 3) n++;
  }
  return n;
});
// The freshest exhaust sits inside the ship's own cyan glow, which is painted
// over it — so sample across a few frames and take the most that got clear.
async function exhaustOver(page, ms) {
  let best = 0;
  for (let t = 0; t < ms; t += 70) {
    best = Math.max(best, await exhaust(page));
    await page.waitForTimeout(70);
  }
  return best;
}

// A fresh run: the New Game button re-centres the ship and respawns the wave
// clear of it. The wait covers the 90-frame invulnerable blink, during which
// the ship is drawn only every other few frames.
async function newGame(page) {
  await page.click('#view-asteroids .game-controls button.primary');
  await page.waitForTimeout(1700);
}

// Hold `key`, run `interrupt`, and report how far the ship turns in the 450ms
// after it — 0° if the key map cleared, ~110° if the key is stuck down.
// `held` is the turn during the press itself: a ship that was never moving
// would sail through the drift check, so each frozen-ship assertion below is
// paired with proof the key was driving it a moment earlier.
async function turnAfter(page, key, interrupt) {
  const opened = await deg(page);
  await page.keyboard.down(key);
  await page.waitForTimeout(250);
  const held = turned(opened, await deg(page));
  await interrupt();
  const before = await deg(page);
  await page.waitForTimeout(450);
  const after = await deg(page);
  return { held, before, after, drift: turned(before, after) };
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#asteroids', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ---- A. the ship reads ----------------------------------------------
  await newGame(page);
  const start = await facing(page);
  ok(start !== null && start.n > 40 && start.n < 300,
    `the ship is the only cyan at mid-table (${start ? start.n : 0}px)`);
  ok(start !== null && Math.abs(turned(-90, start.deg)) < 14,
    `it starts facing up (${start ? start.deg : 'missing'}°)`);
  ok((await exhaust(page)) === 0, 'engine off, no exhaust');

  // ---- B. a held turn key, and a plain release --------------------------
  const a0 = await deg(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(250);
  const a1 = await deg(page);
  await page.keyboard.up('ArrowLeft');
  ok(Math.abs(turned(a0, a1)) > 40, `held ← turns the ship (${a0}° → ${a1}°)`);

  await page.waitForTimeout(450);
  const a2 = await deg(page);
  ok(Math.abs(turned(a1, a2)) < 6,
    `release with Vector Storm on screen stops the turn (turned ${turned(a1, a2)}°)`);

  // ---- C. losing focus mid-press (AST-1) --------------------------------
  await newGame(page);
  const blur = await turnAfter(page, 'ArrowRight',
    () => page.evaluate(() => window.dispatchEvent(new Event('blur'))));
  await page.keyboard.up('ArrowRight');
  ok(Math.abs(blur.held) > 40, `the ship was turning when focus went (${blur.held}°)`);
  ok(blur.before !== null && Math.abs(blur.drift) < 6,
    `blur clears the held key — ship frozen at ${blur.before}° (turned ${blur.drift}°)`);

  // ---- D. the keyboard survives the trip --------------------------------
  const b0 = await deg(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(250);
  const b1 = await deg(page);
  await page.keyboard.up('ArrowLeft');
  ok(Math.abs(turned(b0, b1)) > 40, `keys still turn the ship after focus returns (${b0}° → ${b1}°)`);

  // ---- E. a release delivered while another view is active --------------
  await newGame(page);
  const away = await turnAfter(page, 'ArrowRight', async () => {
    // Exactly what happens when a keypress outlives the navigation that left
    // the game: the release lands while the arcade grid holds .active.
    await page.evaluate(() => {
      document.getElementById('view-asteroids').classList.remove('active');
      document.getElementById('view-arcade').classList.add('active');
    });
    await page.keyboard.up('ArrowRight');
    await page.evaluate(() => {
      document.getElementById('view-arcade').classList.remove('active');
      document.getElementById('view-asteroids').classList.add('active');
    });
  });
  ok(Math.abs(away.held) > 40, `the ship was turning when the view changed (${away.held}°)`);
  ok(away.before !== null && Math.abs(away.drift) < 6,
    `keyup outside the active view clears the key — ship frozen at ${away.before}° (turned ${away.drift}°)`);

  // ---- F. the engine, and what a blur does to it ------------------------
  await newGame(page);
  await page.keyboard.down('ArrowUp');
  const burning = await exhaustOver(page, 420);
  ok(burning > 0, `held ↑ fires the engine (${burning}px of exhaust)`);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(450);          // exhaust particles live 12 frames
  const afterBlur = await exhaustOver(page, 210);
  await page.keyboard.up('ArrowUp');
  ok(afterBlur === 0, `blur cuts the engine (${afterBlur}px still burning after)`);

  // ---- G. leaving by the Games button -----------------------------------
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(150);
  await page.click('#view-asteroids .game-back-btn');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowLeft');     // released on the arcade grid
  await page.click('[data-view="asteroids"]');
  await page.waitForTimeout(200);
  await newGame(page);
  const back = await facing(page);
  ok(back !== null && Math.abs(turned(-90, back.deg)) < 14,
    `coming back re-centres the ship facing up (${back ? back.deg : 'missing'}°)`);
  const rejoin = await deg(page);
  await page.waitForTimeout(450);
  const rejoinLater = await deg(page);
  ok(Math.abs(turned(rejoin, rejoinLater)) < 6,
    `no ship turns on its own after leaving and returning (turned ${turned(rejoin, rejoinLater)}°)`);
  ok((await exhaust(page)) === 0, 'and no engine burning on its own either');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

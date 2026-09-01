/* HVALE-53 — Hearthvale's camera didn't exist yet when the pointer did.
 *
 * `cam` and `view` are declared `let state, cam, view, ...` — undefined —
 * and only ever given real values inside init(), which itself only runs
 * on DOMContentLoaded (or immediately if the document is already past
 * "loading"). But the canvas's pointermove/wheel listeners are wired up
 * at the SAME top-level script scope, unconditionally, before that check
 * ever runs. Anything that lands a pointer event on the canvas in that
 * window calls `screenToTile()`, which reads `cam.x`/`cam.z` off
 * `undefined` and throws — before the town has finished loading.
 *
 * reach.js already tests two flagships (Tycoon, Voxel Isle) through
 * exactly the browser condition that opens this window wide: Chromium's
 * `isMobile`/`hasTouch` device emulation, which — switching a page into
 * "mobile" layout — fires a synthetic pointer event to settle hover
 * state, landing on whatever sits at the pointer's position. Hearthvale
 * was never added to that check, so this shipped unseen: the very phone
 * viewport this project already tests other flagships against threw a
 * page error on Hearthvale on every single load, 100% reproducible,
 * before a single tile had rendered.
 *
 * A. The exact condition reach.js uses for Tycoon/Voxel Isle (390x844,
 *    isMobile+hasTouch) loads Hearthvale with zero page errors.
 * B. Non-vacuous the other way too: the same condition at a size reach.js
 *    doesn't use (900x900) still throws pre-fix — this isn't a fluke of
 *    one viewport, it's `isMobile` itself.
 * C. The fix isn't just "swallow the error": cam/view still take over
 *    real values from init() and normal play works — a mobile-context
 *    drag pans the camera (the canvas gets its `panning` class) and a
 *    wheel zoom is accepted, both without throwing.
 * D. A plain desktop load (no emulation) still has zero page errors, so
 *    the fix didn't regress the common case it already passed.
 * Z. Zero page errors is asserted on every leg above, not bolted on
 *    separately, so a regression can't hide behind an unrelated pass.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// ---- guard the guard: cam/view must be seeded with real numbers at
// declaration, not left to pick up `undefined` until init() runs. ----
const src = fs.readFileSync(path.join(ROOT, 'hearthvale.html'), 'utf8');
const decl = /let state,\s*cam\s*=\s*\{\s*x:\s*0,\s*y:\s*0,\s*z:\s*3\s*\},\s*view\s*=\s*\{\s*w:\s*0,\s*h:\s*0\s*\}/.exec(src);
ok(!!decl, 'cam/view are seeded with real numbers at declaration, before init() ever runs');

async function loadHeadless(browser, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 140)));
  await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // A — reach.js's exact phone condition (see its Section F).
  {
    const { ctx, errs } = await loadHeadless(browser, {
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    });
    ok(errs.length === 0,
      `Hearthvale 390x844 isMobile+hasTouch: zero page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // B — a different size, still isMobile: the bug is the emulation mode,
  // not one particular viewport.
  {
    const { ctx, errs } = await loadHeadless(browser, {
      viewport: { width: 900, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    });
    ok(errs.length === 0,
      `Hearthvale 900x900 isMobile+hasTouch: zero page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // C — the fix hands off to init() cleanly: a real drag still pans the
  // camera (canvas gains .panning), and a wheel zoom is accepted, both
  // under the same mobile context, with no error either way.
  {
    const { ctx, page, errs } = await loadHeadless(browser, {
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    });
    // A fresh profile also shows the welcome/difficulty modal — dismiss it
    // like a player would, so the drag below lands on the town, not the card.
    const welcomeShown = await page.$eval('#welcome', el => el.classList.contains('show')).catch(() => false);
    if (welcomeShown) { await page.click('#welcome-close'); await page.waitForTimeout(300); }

    const canvas = await page.$('#game');
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
    const panning = await page.$eval('#game', el => el.classList.contains('panning'));
    await page.mouse.up();
    ok(panning, 'a real drag under the same mobile context pans the camera (canvas gets .panning)');
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(200);
    ok(errs.length === 0,
      `no page errors through drag + wheel once loaded${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // D — plain desktop still loads clean (no regression on the common case).
  {
    const { ctx, errs } = await loadHeadless(browser, { viewport: { width: 1400, height: 900 } });
    ok(errs.length === 0,
      `Hearthvale 1400x900 desktop: zero page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

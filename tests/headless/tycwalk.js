/* TYC-65 — in walk mode, "click to fix" fixes.
 *
 * A bugged desk floats a "🐛 click to fix" label in both camera modes.
 * The top-down pointerdown handler tests the click against the bugged
 * desks before tap-to-move — and returns early in walk mode, where the
 * walk-mode handler starts a camera orbit instead. So the label told
 * the player to click, and the click spun the camera; the desk stayed
 * at half speed until they toggled back to top-down.
 *
 * The fix raycasts the click through the walk camera (pcam) and lets a
 * hotfix win over an orbit, mirroring the top-down handler. Bugs are
 * random and deliberately not saved, so this suite cannot seed one; it
 * holds the fix at the source layer — the walk-mode handler must test
 * bugged desks through pcam before it takes the pointer for orbiting —
 * and drives the real page to prove walk-mode clicks still run clean.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const source = fs.readFileSync(path.join(__dirname, '../../tycoon/play.html'), 'utf8');

// ── A. source ────────────────────────────────────────────────
{
  const start = source.indexOf("// Drag to orbit the camera");
  const end = source.indexOf('function endTpLook', start);
  const handler = start >= 0 && end > start ? source.slice(start, end) : '';
  ok(handler.length > 0, 'found the walk-mode pointerdown handler');
  const fix = handler.indexOf('tryFixBugAt(raycaster)');
  const orbit = handler.indexOf('tpLookId = e.pointerId');
  ok(fix >= 0, 'the walk-mode handler tests the click against bugged desks');
  ok(fix >= 0 && orbit > fix, 'and does so before it takes the pointer for orbiting');
  ok(/raycaster\.setFromCamera\(pointer, pcam\)/.test(handler), 'through the walk camera, not the top-down one');
  // The top-down handler is untouched: it still hotfixes before tap-to-move and still yields in walk mode.
  const td = source.slice(source.indexOf("// Tap-to-move: project pointer"), start);
  ok(/if \(thirdPerson\) return;/.test(td) && /if \(tryFixBugAt\(raycaster\)\) return;/.test(td),
    'the top-down handler still yields in walk mode and still hotfixes before tap-to-move');
}

// ── B. the real page ─────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
  await page.addInitScript(() => { try { localStorage.setItem('tycoon:welcomeSeen-v1', '1'); } catch (e) {} });
  await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.click('#tp-toggle');
  await page.waitForTimeout(300);
  const label = await page.evaluate(() => document.getElementById('tp-label').textContent);
  ok(/TOP-DOWN/.test(label), `walk mode is on (toggle now offers "${label}")`);
  // Click and drag on the canvas in walk mode: the orbit path still runs, clean.
  await page.mouse.move(600, 400);
  await page.mouse.down();
  await page.mouse.move(650, 420, { steps: 5 });
  await page.mouse.up();
  await page.mouse.click(300, 500);
  await page.waitForTimeout(500);
  ok(errs.length === 0, `walk-mode clicks and drags run without a page error${errs.length ? ' — ' + errs[0] : ''}`);
  await page.click('#tp-toggle');
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => document.getElementById('tp-label').textContent);
  ok(/3RD PERSON/.test(back), 'and the toggle returns to top-down');
  await browser.close();
  ok(pass >= 8, 'suite is populated');
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

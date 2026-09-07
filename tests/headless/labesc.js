/* LAB-59 — Escape did not close The Corner.
 *
 * #chain-modal (The Corner, opened from #chain-toggle) carries
 * role="dialog" aria-modal="true" and is a browsing-only overlay: an
 * X button (#chain-close) and a click on the backdrop already dismiss
 * it. Escape did nothing, even though the WAI-ARIA APG promises a
 * modal dialog answers to it, and every sibling flagship's equivalent
 * overlay already does: Age of War's #aow-chain-modal, Hearthvale's
 * and Voxel Isle's #chain-modal, Tycoon's #wall-modal, and Homeless
 * Village's own #chain-modal (HV-58 fixed exactly this class of bug
 * there). Grow Op was the one flagship never given the fix.
 *
 * Grow Op's other overlays are correctly Escape-silent by design:
 * #event-modal and #diff-modal force a choice, #bust-modal forces an
 * acknowledged restart — none of the three has a close button or a
 * backdrop-click handler. #chain-modal is the only one built to be
 * dismissed casually, which is exactly the one Escape skipped.
 *
 * Hook-free, same shape as hvesc.js: load the real page, click the
 * real control, press the real key, read the real classList.
 * Reverting the fix fails B by name; the source guard in A fails
 * immediately without it.
 *
 * A. Source: a keydown handler in drug-lab.html closes #chain-modal
 *    on Escape.
 * B. The Corner opens from #chain-toggle, and Escape closes it.
 * C. Escape does not fire the close on an untouched page (no crash,
 *    no stray state) and does not touch #diff-modal.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// --- A. source guard -------------------------------------------------
const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
const scoped = /getElementById\(\s*['"]chain-modal['"]\s*\)[\s\S]{0,400}addEventListener\(\s*['"]keydown['"][\s\S]{0,240}classList\.remove\(\s*['"]open['"]\s*\)/.exec(src);
ok(!!scoped, 'LAB-59: drug-lab.html has a keydown handler that removes .open from #chain-modal');
ok(!!scoped && /e\.key\s*===\s*['"]Escape['"]/.test(scoped[0]),
  'LAB-59: that handler gates on e.key === "Escape"');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);

  // --- B. The Corner opens, and Escape closes it ---------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 160)));
    await page.addInitScript(() => { localStorage.removeItem('drug-lab-v1'); });
    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load', timeout: 25000 });

    // A fresh run opens on the difficulty picker, which sits over the
    // whole page — pick one so the test can reach the tray.
    await page.waitForSelector('#diff-careful', { state: 'visible', timeout: 25000 });
    await page.click('#diff-careful');
    await page.waitForSelector('#diff-modal', { state: 'hidden', timeout: 10000 });

    await page.click('#chain-toggle');
    const openedRight = await page.$eval('#chain-modal', el => el.classList.contains('open'));
    ok(openedRight, 'The Corner opens from the tray button');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const closed = await page.$eval('#chain-modal', el => !el.classList.contains('open'));
    ok(closed, 'LAB-59: Escape closes The Corner');

    ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // --- C. Escape is a no-op with nothing open, and leaves the
  //        difficulty picker alone (that one is a forced choice) -----
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 160)));
    await page.addInitScript(() => { localStorage.removeItem('drug-lab-v1'); });
    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForSelector('#diff-modal.open', { state: 'visible', timeout: 25000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const stillUp = await page.$eval('#diff-modal', el => el.classList.contains('open'));
    ok(stillUp, 'Escape does not dismiss the forced difficulty picker');

    ok(errs.length === 0, `idle-Escape path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

/* HV-58 — Escape closes The Bridge.
 *
 * The Bridge (#chain-modal, opened from #chain-btn) is a browsing-only
 * dialog. × and backdrop already dismiss it. The page's only keydown is
 * the HV-56 intro handler, which keys off #intro-modal and never sees
 * this overlay. Same class of drift as TYC-60 (Founder Shop + the Wall).
 *
 * Hook-free, same shape as hvintro.js / focus.js: load the real page,
 * click the real control, press the real key, read the real classList.
 * Reverting the one-line fix fails the named assertion below; the intro
 * assertions are the other direction of the ticket (keep intro Escape
 * working, and do not mark the crash course seen from The Bridge).
 *
 * A. Escape still dismisses the first-run crash course.
 * B. The Bridge opens from the top-bar button.
 * C. Escape closes The Bridge.
 * D. That Escape did not go through closeIntro().
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // --- A. intro Escape still works ---------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    const shown = await page.$eval('#intro-modal', el => el.classList.contains('open')).catch(() => false);
    ok(shown, 'a brand-new camp is met by the crash course');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const gone = await page.$eval('#intro-modal', el => el.classList.contains('open'));
    ok(!gone, 'HV-58: Escape still dismisses the crash course');

    const marked = await page.evaluate(() => localStorage.getItem('hv-intro-seen'));
    ok(marked === '1', 'dismissing the crash course via Escape still records that it has been seen');

    ok(errs.length === 0, `intro path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // --- B–D. The Bridge ---------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    // HV-56's first-run crash course is modal and would swallow the click
    // on the Bridge button. Arrive as a returning camp, same as wall.js.
    await page.addInitScript(() => { localStorage.setItem('hv-intro-seen', '1'); });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    await page.click('#chain-btn');
    await page.waitForSelector('#chain-modal.open', { timeout: 10000 });
    const bridgeOpen = await page.$eval('#chain-modal', el => el.classList.contains('open'));
    ok(bridgeOpen, 'The Bridge opens from the top-bar button');

    // Wipe the seen flag so a mistaken closeIntro() would write it back.
    // Returning camps already have it set; without this, the isolation
    // assertion could not tell closeIntro() from a no-op.
    await page.evaluate(() => localStorage.removeItem('hv-intro-seen'));

    // C — the named assertion. Revert
    // `m.classList.remove('open')` in the HV-58 keydown and this is the
    // line that goes red.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const bridgeClosed = await page.$eval('#chain-modal', el => !el.classList.contains('open'));
    ok(bridgeClosed, 'HV-58: Escape closes The Bridge');

    const introOpen = await page.$eval('#intro-modal', el => el.classList.contains('open'));
    const marked = await page.evaluate(() => localStorage.getItem('hv-intro-seen'));
    ok(!introOpen && marked !== '1',
      'HV-58: Escape on The Bridge does not dismiss or mark the intro seen');

    ok(errs.length === 0, `bridge path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

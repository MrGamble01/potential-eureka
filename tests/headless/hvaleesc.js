/* HVALE-53 — Escape closes The Hall.
 *
 * The Hall (#chain-modal) is a browsing-only dialog. × and backdrop
 * already dismiss it. The global Escape handler already clears
 * buildMode, the inspect panel, and the Achievements / Chronicle /
 * Decrees overlays — and never touched #chain-modal. Same class of
 * drift as TYC-60 (Founder Shop + the Wall).
 *
 * Hook-free, same shape as focus.js: open the real control, press the
 * real key, read the real classList. Reverting the one-line fix fails
 * the named assertion below; the welcome assertion is the other
 * direction of the ticket (do not close first-run on Escape).
 *
 * A. Escape does not dismiss the first-run welcome.
 * B. The Hall opens from the pause menu.
 * C. Escape closes The Hall.
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
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1200 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load' });
  await page.waitForSelector('#welcome-close', { state: 'visible', timeout: 25000 });

  // A — first-run is a choice, not a browsing panel. Escape already
  // never closed it; this assertion keeps a future "close every overlay"
  // sweep from "fixing" it.
  const welcomeOpen = await page.evaluate(() =>
    document.getElementById('welcome').classList.contains('show'));
  ok(welcomeOpen, 'a fresh valley is met by the first-run welcome');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const welcomeStill = await page.evaluate(() =>
    document.getElementById('welcome').classList.contains('show'));
  ok(welcomeStill, 'HVALE-53: Escape does not dismiss the first-run welcome');

  // B — the Hall lives on the pause menu; a fresh valley has to clear
  // the welcome first. The menu has grown past a short laptop, so the
  // viewport is tall enough that #chain-btn is actually on screen.
  await page.click('#welcome-close');
  await page.waitForSelector('#menu-btn', { timeout: 25000 });
  await page.click('#menu-btn');
  await page.waitForSelector('#chain-btn', { state: 'visible', timeout: 25000 });
  await page.click('#chain-btn');
  await page.waitForSelector('#chain-modal.open', { timeout: 10000 });
  const hallOpen = await page.evaluate(() =>
    document.getElementById('chain-modal').classList.contains('open'));
  ok(hallOpen, 'The Hall opens from the pause menu');

  // C — the named assertion. Revert
  // `document.getElementById('chain-modal').classList.remove('open')`
  // in the Escape branch and this is the line that goes red.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const hallClosed = await page.evaluate(() =>
    !document.getElementById('chain-modal').classList.contains('open'));
  ok(hallClosed, 'HVALE-53: Escape closes The Hall');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

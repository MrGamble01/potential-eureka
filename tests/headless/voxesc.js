/* VOX-51 — Escape closes The Shore.
 *
 * The Shore (#chain-modal) is a browsing-only dialog. × and backdrop
 * already dismiss it. The global Escape handler already closes help /
 * achievements / almanac, drops photo mode, and closePanels() — and
 * never touched #chain-modal. Same class of drift as TYC-60 (Founder
 * Shop + the Wall).
 *
 * Hook-free, same shape as focus.js: open the real control, press the
 * real key, read the real classList. Reverting the one-line fix fails
 * the named assertion below. First-person Esc (toggleFP) returns
 * earlier when fp.on and is left alone.
 *
 * A. The Shore opens from the tray.
 * B. Escape closes The Shore.
 * C. That Escape did not go through the first-person path.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForSelector('#chain-btn', { timeout: 25000 });
  await page.waitForTimeout(3500);

  // A fresh isle opens the how-to overlay over the garden. Dismiss it
  // the way a player does, so Escape is measured against The Shore
  // alone rather than against helpOv riding the same branch.
  const helpOpen = await page.evaluate(() =>
    document.getElementById('helpOv').classList.contains('open'));
  if (helpOpen) {
    await page.click('#helpClose');
    await page.waitForTimeout(300);
  }

  await page.click('#chain-btn');
  await page.waitForSelector('#chain-modal.open', { timeout: 10000 });
  const shoreOpen = await page.evaluate(() =>
    document.getElementById('chain-modal').classList.contains('open'));
  ok(shoreOpen, 'The Shore opens from the tray');

  // B — the named assertion. Revert
  // `$('chain-modal').classList.remove('open')`
  // in the Escape branch and this is the line that goes red.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const shoreClosed = await page.evaluate(() =>
    !document.getElementById('chain-modal').classList.contains('open'));
  ok(shoreClosed, 'VOX-51: Escape closes The Shore');

  // C — first-person Esc returns earlier when fp.on. This press ran
  // with fp off, so it must have taken the overlay branch, not toggleFP.
  const fpOff = await page.evaluate(() => !fp.on);
  ok(fpOff, 'VOX-51: Escape with The Shore open does not enter first-person');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

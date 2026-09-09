/* AOW-61: the Pause button never told you P did the same thing.
 *
 * setUserPaused() flips the action-bar button between an icon and a
 * label on every toggle, but the label was a bare "Pause"/"Resume" with
 * no mention of the P key — every other special action button in the
 * bar carries a descriptive title, this one didn't. The pause screen
 * itself says "Press P" once you're already there, but nothing before
 * that point told a keyboard player the shortcut existed.
 *
 * Fix: a <small>P</small> sub-label (the same pattern Age Up/Hero already
 * use for their sub-line) plus a hover title, both updated on every
 * toggle so "Resume" and "Pause" stay in sync with the shortcut hint.
 */
const { chromium } = require('playwright');

let pass = 0, fail = 0;
const ok = (cond, name) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const base = process.env.BASE || 'http://127.0.0.1:8099';
  await page.goto(`${base}/ageofwar/index.html`);
  await page.waitForTimeout(400);

  // First visit opens the welcome modal, which sets modalPaused and
  // would otherwise swallow the P keydown below.
  const welcomeClose = page.locator('#aow-welcome-close');
  if (await welcomeClose.isVisible().catch(() => false)) {
    await welcomeClose.click();
    await page.waitForTimeout(100);
  }

  const btn = page.locator('#aow-pause-btn');
  const label0 = await btn.locator('.aow-action-lbl').innerHTML();
  const title0 = await btn.getAttribute('title');
  ok(label0.includes('Pause') && label0.includes('<small>P</small>'),
    'Pause button shows the P shortcut hint before pausing');
  ok(!!title0 && title0.includes('P'),
    'Pause button has a hover title naming the P shortcut');

  await page.keyboard.press('p');
  await page.waitForTimeout(100);
  const label1 = await btn.locator('.aow-action-lbl').innerHTML();
  const title1 = await btn.getAttribute('title');
  ok(label1.includes('Resume') && label1.includes('<small>P</small>'),
    'Resume label keeps the P shortcut hint while paused');
  ok(!!title1 && title1.includes('Resume'),
    'Title updates to Resume while paused');

  await page.keyboard.press('p');
  await page.waitForTimeout(100);
  const label2 = await btn.locator('.aow-action-lbl').innerHTML();
  ok(label2.includes('Pause') && label2.includes('<small>P</small>'),
    'Label reverts to Pause + hint after resuming');

  await browser.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

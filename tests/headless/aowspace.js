/* Hook-free: focused play controls own Space; unfocused Space still fires. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  for (const width of [1280, 768]) {
    for (const action of ['pause', 'settings', 'recruit', 'shortcut']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(() => {
        localStorage.setItem('aow-welcome-seen', '1');
        localStorage.setItem('aow-session', JSON.stringify({
          v: 2, waveNum: 1, gold: 1000, specialReadyT: 0,
        }));
      });
      await page.goto(BASE + '/ageofwar/');
      await page.click('#aow-resume-cta');
      const special = page.locator('#aow-special-btn');
      await page.waitForFunction(() => !document.querySelector('#aow-special-btn').disabled);
      const selector = action === 'recruit' ? '.aow-spawn-btn' : `#aow-${action}-btn`;
      if (action === 'shortcut') {
        await page.evaluate(() => document.activeElement.blur());
      } else await page.locator(selector).first().focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      if (action === 'pause') {
        const paused = await page.locator('#aow-resume-cta').isVisible();
        ok(paused, `${width}: Space on Pause pauses the battle`);
        if (paused) {
          await page.locator('#aow-resume-cta').focus();
          await page.keyboard.press('Space');
          ok(!(await page.locator('#aow-resume-cta').isVisible()), `${width}: Space on Resume restores play`);
        }
      } else if (action === 'settings') {
        ok(await page.locator('#aow-settings-modal').isVisible(), `${width}: Space on Settings opens the sheet`);
      } else if (action === 'recruit') {
        ok(await page.locator('.aow-train-slot:not(.aow-train-empty)').count() === 1,
          `${width}: Space recruits exactly one focused unit`);
      }
      ok(action === 'shortcut' ? await special.isDisabled() : !(await special.isDisabled()),
        `${width}: ${action === 'shortcut' ? 'unfocused Space still fires the special' : action + ' does not spend the ready special'}`);
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

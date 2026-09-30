/* Hook-free: cooling Space explains the wait; ready Space still fires.
 * Supported saves, real keys, rendered canvas text and persisted stats only.
 */
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
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.clock.install();
    await page.addInitScript(() => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 1, gold: 1000, playerEra: 0, specialReadyT: 4,
      }));
      window.renderedText = [];
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        window.renderedText.push(String(text));
        return fillText.call(this, text, ...args);
      };
    });
    await page.goto(BASE + '/ageofwar/');
    await page.click('#aow-resume-cta');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.evaluate(() => document.activeElement.blur());
    const special = page.locator('#aow-special-btn');
    const snapshot = () => page.evaluate(() => {
      window.dispatchEvent(new Event('beforeunload'));
      return JSON.parse(localStorage.getItem('aow-session'));
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const before = await snapshot();
      ok(before.specialReadyT > 0 && await special.isDisabled(), `${width}/${attempt}: special is cooling`);
      await page.evaluate(() => { window.renderedText = []; });
      await page.keyboard.press('Space');
      await page.clock.runFor(48);
      const after = await snapshot();
      ok(await page.evaluate(seconds => window.renderedText.includes(`Special cooling — ${seconds}s`),
        Math.ceil(before.specialReadyT)), `${width}/${attempt}: Space renders cooling wait in seconds`);
      ok(after.runStats.specialsFired === before.runStats.specialsFired &&
        after.specialReadyT > 0 && after.specialReadyT < before.specialReadyT,
      `${width}/${attempt}: refusal spends no special and cooldown keeps counting down`);
      await page.clock.runFor(1500);
    }
    await page.clock.runFor(1200);
    ok(!(await special.isDisabled()), `${width}: original cooldown reaches READY`);
    const before = await snapshot();
    await page.evaluate(() => { window.renderedText = []; });
    await page.keyboard.press('Space');
    await page.clock.runFor(48);
    const after = await snapshot();
    ok(after.runStats.specialsFired === before.runStats.specialsFired + 1 &&
      after.specialReadyT > 4 && await special.isDisabled(), `${width}: ready Space fires exactly once and starts cooldown`);
    ok(!(await page.evaluate(() => window.renderedText.some(text => /Special cooling/.test(text)))),
      `${width}: ready Space has no cooling refusal`);
    await context.close();
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

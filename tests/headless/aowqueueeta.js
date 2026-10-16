/* Hook-free: full recruiting names the live wait until the front trainee frees a slot.
 * Supported session saves, real keys/clicks, clock, DOM and canvas output only.
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
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
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
        v: 2, waveNum: 1, gold: 1000, playerEra: 0,
        trainingQueue: Array.from({ length: 5 }, (_, i) => ({
          key: 'club', total: 10, remaining: i === 0 ? 7.25 : 10,
        })),
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
    const recruit = page.locator('.aow-spawn-btn').filter({ hasText: 'Clubman' });
    const snapshot = () => page.evaluate(() => {
      window.dispatchEvent(new Event('beforeunload'));
      return JSON.parse(localStorage.getItem('aow-session'));
    });
    let previousSeconds = Infinity;
    for (let attempt = 0; attempt < 2; attempt++) {
      const before = await snapshot();
      const seconds = Math.ceil(Math.max(0, before.trainingQueue[0].remaining));
      const message = `Queue full — next slot in ${seconds}s`;
      ok(seconds < previousSeconds && (attempt !== 0 || seconds === 8),
        `${width}/${attempt}: front trainee wait rounds up and decreases`);
      previousSeconds = seconds;
      ok(await recruit.isDisabled() && (await recruit.getAttribute('title')).startsWith(message) &&
        /cancel.*refund.*Clubman.*HP.*DMG.*Range.*Speed/.test(await recruit.getAttribute('title')),
      `${width}/${attempt}: full recruit title leads with live wait and keeps refund hint/stats`);
      await page.evaluate(() => { window.renderedText = []; });
      await page.keyboard.press('1');
      const refused = await snapshot();
      ok(refused.gold === before.gold && JSON.stringify(refused.trainingQueue) === JSON.stringify(before.trainingQueue) &&
        refused.trainingQueue.length === 5,
      `${width}/${attempt}: refusal spends no gold and changes no queued recruit`);
      await page.clock.runFor(48);
      ok(await page.evaluate(text => window.renderedText.includes(text), message),
        `${width}/${attempt}: keyboard refusal renders rounded-up next-slot wait`);
      await page.clock.runFor(1500);
      const after = await snapshot();
      ok(after.trainingQueue[0].remaining < before.trainingQueue[0].remaining &&
        JSON.stringify(after.trainingQueue.slice(1)) === JSON.stringify(before.trainingQueue.slice(1)),
      `${width}/${attempt}: only front trainee counts down`);
    }
    const full = await snapshot();
    await page.click('#aow-train-slot-4');
    const cancelled = await snapshot();
    ok(cancelled.trainingQueue.length === 4 && cancelled.gold === full.gold + 25 &&
      !(await recruit.isDisabled()) && !/Queue full/.test(await recruit.getAttribute('title')),
    `${width}: cancel refunds cost and clears full title/disabled state`);
    await page.evaluate(() => { window.renderedText = []; });
    await recruit.click();
    const recruited = await snapshot();
    ok(recruited.trainingQueue.length === 5 && recruited.gold === cancelled.gold - 25,
      `${width}: recruit succeeds in freed slot for exactly its cost`);
    await page.clock.runFor(48);
    ok(!(await page.evaluate(() => window.renderedText.some(text => /Queue full/.test(text)))),
      `${width}: successful recruit renders no stale queue-full refusal`);
    await context.close();
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

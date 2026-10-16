/* Hook-free: training ETA follows the page clock through production DOM.
 * Supported session saves, real queue clicks, and persisted state only.
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
        v: 2, waveNum: 1, gold: 1000, playerEra: 5,
        trainingQueue: [
          { key: 'construct', total: 8, remaining: 7.25 },
          { key: 'construct', total: 3, remaining: 2.25 },
        ],
      }));
    });
    await page.goto(BASE + '/ageofwar/');
    await page.click('#aow-resume-cta');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    const snapshot = () => page.evaluate(() => {
      window.dispatchEvent(new Event('beforeunload'));
      return JSON.parse(localStorage.getItem('aow-session'));
    });
    const front = page.locator('#aow-train-slot-0');
    const checkLabel = async (state, stage) => {
      const title = await front.getAttribute('title');
      ok(title.includes('War Construct') && title.includes(`${Math.ceil(state.trainingQueue[0].remaining)}s left`) &&
        /cancel.*refund.*\$5600/i.test(title), `${width}: ${stage} title names unit, rounded-up ETA, and refund`);
      ok(await front.getAttribute('aria-label') === title, `${width}: ${stage} accessible label matches title`);
    };
    const before = await snapshot();
    await checkLabel(before, 'initial');
    const originalSlot = await front.elementHandle();
    const originalTitle = await front.getAttribute('title');
    const originalProgress = await front.evaluate(el => el.style.getPropertyValue('--aow-train'));
    ok(/cancel.*refund.*\$5600/i.test(await page.locator('#aow-train-slot-1').getAttribute('title')),
      `${width}: waiting slot keeps refund hint`);
    ok(await page.locator('#aow-train-slot-2').isDisabled() &&
      await page.locator('#aow-train-slot-2').getAttribute('title') === null,
      `${width}: empty slots stay disabled and untitled`);
    await page.clock.runFor(1500);
    const advanced = await snapshot();
    ok(advanced.trainingQueue[0].remaining < before.trainingQueue[0].remaining - 1 &&
      advanced.trainingQueue[1].remaining === before.trainingQueue[1].remaining,
      `${width}: only the front recruit trains`);
    await checkLabel(advanced, 'after ticking');
    ok(await originalSlot.evaluate(el => el === document.querySelector('#aow-train-slot-0')) &&
      await front.getAttribute('title') !== originalTitle &&
      await front.evaluate(el => el.style.getPropertyValue('--aow-train')) !== originalProgress,
      `${width}: cheap tick updates title and progress without rebuilding slots`);
    await front.click();
    const cancelled = await snapshot();
    ok(cancelled.trainingQueue.length === 1 && cancelled.gold === advanced.gold + 5600,
      `${width}: cancel still refunds exactly the unit cost`);
    await checkLabel(cancelled, 'promoted');
    await page.clock.runFor(2500);
    const completed = await snapshot();
    ok(completed.trainingQueue.length === 0 &&
      completed.units.some(unit => unit.key === 'construct' && unit.side === 'player'),
      `${width}: remaining recruit completes and spawns`);
    await context.close();
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

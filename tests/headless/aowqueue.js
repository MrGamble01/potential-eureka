/* Age of War: full training queue explains blocked recruiting and recovery.
 * Hook-free: seed a supported save, then use real clicks/keys and inspect DOM.
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
    await page.addInitScript(() => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 1, gold: 80000, playerEra: 5,
        trainingQueue: Array.from({ length: 4 }, () => ({ key: 'construct', total: 7, remaining: 7 })),
      }));
    });
    await page.goto(BASE + '/ageofwar/');
    await page.click('#aow-resume-cta');
    const construct = page.locator('.aow-spawn-btn').filter({ hasText: 'War Construct' });
    await construct.click();
    await page.waitForTimeout(100);
    const read = () => page.evaluate(() => ({
      text: document.querySelector('#aow-train-status')?.textContent || '',
      occupied: document.querySelectorAll('.aow-train-slot:not(.aow-train-empty)').length,
      blocked: [...document.querySelectorAll('.aow-spawn-btn')].every(b =>
        b.disabled && /Queue full/.test(b.title)),
      gold: Number(document.querySelector('#aow-gold').textContent.replace(/[^0-9]/g, '')),
    }));
    const full = await read();
    ok(full.occupied === 5 && /Queue full \(5\/5\)/.test(full.text) && /wait/i.test(full.text) && /cancel.*refund/i.test(full.text),
      `${width}: full queue visibly explains the block and both recovery options`);
    ok(full.blocked, `${width}: all recruit cards expose the queue-full reason and disabled state`);
    await page.keyboard.press('1');
    const refused = await read();
    ok(refused.occupied === 5 && refused.gold >= full.gold && refused.gold < full.gold + 25,
      `${width}: keyboard recruiting while full spends no gold`);
    await page.click('#aow-train-slot-4');
    await page.waitForTimeout(100);
    const cancelled = await read();
    ok(cancelled.occupied === 4 && /4\/5 queued/.test(cancelled.text) && !/Queue full/.test(cancelled.text) &&
      cancelled.gold >= refused.gold + 5600 && cancelled.gold < refused.gold + 5625,
      `${width}: cancellation refunds the recruit and clears the full message`);
    ok(!(await construct.isDisabled()) && !/Queue full/.test(await construct.getAttribute('title')),
      `${width}: freed recruit card clears stale disabled semantics and title`);
    await construct.click();
    await page.waitForTimeout(100);
    ok((await read()).occupied === 5 && /Queue full/.test((await read()).text), `${width}: recruiting fills the freed slot again`);
    const status = page.locator('#aow-train-status');
    if (await status.count()) {
      await status.scrollIntoViewIfNeeded();
      const box = await status.boundingBox();
      ok(box && box.x >= 0 && box.x + box.width <= width && box.height > 0,
        `${width}: explanation fits within the play panel`);
    } else ok(false, `${width}: explanation fits within the play panel`);
    await page.waitForFunction(() => document.querySelectorAll('.aow-train-slot:not(.aow-train-empty)').length === 4);
    await page.waitForTimeout(100);
    const completed = await read();
    ok(/4\/5 queued/.test(completed.text) && !completed.blocked && !/Queue full/.test(completed.text),
      `${width}: natural training completion clears the block and message`);
    await context.close();
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

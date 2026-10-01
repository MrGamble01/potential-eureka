/* Age of War: broke recruits explain their cost without spending gold.
 * Hook-free: supported saves, real inputs, DOM and canvas output only.
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
    for (const purse of [0, 100]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.clock.install();
      await page.addInitScript(gold => {
        localStorage.setItem('aow-welcome-seen', '1');
        localStorage.setItem('aow-session', JSON.stringify({
          v: 2, waveNum: 1, gold, playerEra: 0, trainingQueue: [],
        }));
        // Observe actual rendered canvas text; retain the original renderer.
        window.renderedText = [];
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          window.renderedText.push(String(text));
          return fillText.call(this, text, ...args);
        };
      }, purse);
      await page.goto(BASE + '/ageofwar/');
      await page.click('#aow-resume-cta');
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      const recruit = page.locator('.aow-spawn-btn').filter({ hasText: 'Clubman' });
      await recruit.scrollIntoViewIfNeeded();
      const box = await recruit.boundingBox();
      ok(box && box.x >= 0 && box.x + box.width <= width && box.height > 0,
        `${width}/${purse}: recruit is visible in the panel`);
      const read = () => page.evaluate(() => ({
        gold: Number(document.querySelector('#aow-gold').textContent.replace(/[^0-9]/g, '')),
        queued: document.querySelectorAll('.aow-train-slot:not(.aow-train-empty)').length,
        refusal: window.renderedText.some(text => /Need \$\d+ more|Clubman wants 25 gold/.test(text)),
      }));
      for (const input of ['click', 'key']) {
        await page.evaluate(() => { window.renderedText = []; });
        const before = await read();
        if (input === 'click') await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        else await page.keyboard.press('1');
        await page.clock.runFor(48);
        const after = await read();
        if (purse === 0) {
          ok(after.refusal, `${width}/${input}: broke recruit renders a gold refusal`);
          ok(after.gold === before.gold && after.queued === 0,
            `${width}/${input}: refusal spends no gold and queues nothing`);
          ok(/^Need \$\d+ more.*Clubman.*HP.*DMG.*Range.*Speed/.test(await recruit.getAttribute('title')),
            `${width}/${input}: broke tooltip leads with gold need and keeps stats`);
          // Let the previous floater expire before testing another input.
          await page.clock.runFor(1500);
        } else {
          ok(after.queued === before.queued + 1 && after.gold === before.gold - 25 && !after.refusal,
            `${width}/${input}: affordable recruit queues and spends exactly its cost`);
          ok(!/Need \$/.test(await recruit.getAttribute('title')),
            `${width}/${input}: affordable tooltip has no stale refusal`);
        }
      }
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

/* Hook-free: the local hall ghost and the phone field-order sheet.
 * A saved war in this browser races the next one. No network. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.clock.install();
    await page.addInitScript(() => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-neighbor', JSON.stringify({
        wave: 4,
        marks: [{ wave: 2, t: 0.3 }, { wave: 3, t: 0.6 }, { wave: 4, t: 1.2 }],
      }));
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 1, gold: 200, xp: 0, playerEra: 0,
      }));
    });
    await page.goto(BASE + '/ageofwar/');
    await page.click('#aow-resume-cta');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
    await page.clock.runFor(800);
    const chip = await page.locator('#aow-neighbor-chip').innerText();
    ok(chip.includes('Hall W3') || chip.includes('Hall W4'), 'the hall ghost advances on the saved clock (' + chip + ')');
    ok((await page.locator('#aow-neighbor-chip').getAttribute('title')).includes('browser'),
      'the chip says the race is stored in this browser');
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 1, gold: 400, xp: 100, playerEra: 0,
      }));
    });
    await page.goto(BASE + '/ageofwar/');
    await page.click('#aow-resume-cta');
    await page.keyboard.press('q');
    await page.waitForSelector('#aow-field-order.aow-open');
    const sheet = await page.locator('#aow-field-order').boundingBox();
    const button = await page.locator('#aow-field-order button').first().boundingBox();
    ok(sheet && sheet.y > 280, 'on a phone the field order is a bottom sheet (y=' + (sheet && Math.round(sheet.y)) + ')');
    ok(sheet && sheet.y + sheet.height <= 844 + 2, 'the sheet stays inside the phone viewport');
    ok(button && button.height >= 70 && button.width >= 300, 'each order is a full-width thumb target');
    await page.locator('#aow-field-order button', { hasText: 'Levy' }).click();
    await page.waitForFunction(() => {
      const el = document.getElementById('aow-order-chip');
      return el && el.textContent.includes('Levy');
    });
    ok(await page.locator('.aow-spawn-btn', { hasText: 'Clubman' }).locator('.aow-spawn-cost').innerText() === '$28',
      'a thumb can still pick Levy and pay the tax');
    await context.close();
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

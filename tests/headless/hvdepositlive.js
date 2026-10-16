/* Deposit Run follows live resources without rebuilding the action bar.
 * Hook-free: supported save, real actions, DOM-only observations. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  for (const width of [1280, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 768 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.setItem('homeless_village_v1', JSON.stringify({
        days: 3, timeOfDay: 0.2, cans: 6, food: 20,
        structures: { barrel_fire: true, cart: true },
      }));
    });
    await page.goto(BASE + '/homeless-village.html');
    const button = page.locator('#action-deposit');
    await button.waitFor();
    ok(!(await button.isDisabled()) && /6🫙/.test(await button.textContent()), `${width}: saved haul is available`);
    await page.click('#action-trade');
    await page.waitForFunction(() => document.querySelector('#stat-cans').textContent === '3');
    ok(await button.isDisabled() && /3🫙/.test(await button.textContent()), `${width}: trading below minimum updates count and disables the run`);
    ok(/Need 2 more cans/.test(await button.textContent()), `${width}: shortfall is visible without hover`);
    await button.scrollIntoViewIfNeeded();
    await page.mouse.move(350, 450);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/deposit-short-${width}.png` });
    await page.click('#action-oddjob');
    await page.waitForFunction(() => document.querySelector('#stat-cans').textContent === '5');
    ok(!(await button.isDisabled()) && /5🫙/.test(await button.textContent()) && !/Need/.test(await button.textContent()), `${width}: earning cans restores availability and clears shortfall`);
    await button.click();
    await page.waitForTimeout(300);
    ok(await button.isDisabled() && /Hauling/.test(await button.textContent()) &&
      await page.locator('#progress-deposit').evaluate(el => parseFloat(el.style.width) > 0), `${width}: active haul stays disabled with live progress`);
    await page.waitForFunction(() => document.querySelector('#stat-cans').textContent === '0');
    ok(await button.isDisabled() && /Tomorrow/.test(await button.textContent()) && /0🫙/.test(await button.textContent()), `${width}: completion explains the daily lock and updates the haul`);
    await button.scrollIntoViewIfNeeded();
    await page.mouse.move(350, 450);
    const box = await button.boundingBox();
    ok(box && box.x >= 0 && box.x + box.width <= width && box.height > 0 &&
      await button.evaluate(el => el.scrollWidth <= el.clientWidth), `${width}: button and explanation fit`);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/deposit-${width}.png` });
    await context.close();
  }
  await browser.close();
  ok(!errors.length, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

/* Hook-free amenity panel regression: production saves, real purchase clicks,
 * and CDP evaluation in the module's frame (no injected globals/source edits).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const source = fs.readFileSync(path.resolve(__dirname, '../../tycoon/play.html'), 'utf8');
let passed = 0;
function check(value, label) { assert.ok(value, label); console.log('PASS ' + label); passed++; }
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    async function open(save) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
      page.setDefaultTimeout(15000);
      page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(p => {
        localStorage.setItem('startup-tycoon-v7', JSON.stringify(p));
        localStorage.setItem('tycoon:welcomeSeen-v1', '1');
        localStorage.setItem('tycoon:tipsEnabled', '0');
      }, { v: 7, cash: 0, allTimeCash: 1, ...save });
      await page.goto(BASE + '/tycoon/play.html');
      await page.waitForSelector('#amenities-list .tag', { state: 'attached' });
      if (await page.locator('#welcome-start-btn').isVisible()) await page.click('#welcome-start-btn');
      await page.click('#amenities-panel .panel-title');
      return page;
    }
    const button = (page, i) => page.locator('#amenities-list .amenity-btn').nth(i);
    const page = await open({ amenities: [
      { id: 'coffee', stock: 8 }, { id: 'printer', stock: 12 },
      { id: 'pingpong', stock: 999 }, { id: 'standup', stock: 999 }, { id: 'pet', stock: 0 },
    ] });
    for (const [i, tag] of ['8/20', '12/30', 'Owned', 'Owned', 'Owned'].entries()) {
      check(await button(page, i).locator('.tag').textContent() === tag, 'initial owned tag: ' + tag);
      check(await button(page, i).isDisabled(), 'owned button stays disabled: ' + i);
      check(await button(page, i).evaluate(el => el.classList.contains('owned')), 'owned styling: ' + i);
    }
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Debugger.enable');
    // Pause immediately before the normal stock-label loop. Its resumed frame
    // must update the SAME tag nodes, proving refreshHud did not rebuild them.
    const lineNumber = source.slice(0, source.indexOf('  // Amenity stock labels')).split('\n').length;
    async function changeStock(coffee, printer) {
      let pauseTimer;
      const paused = new Promise((resolve, reject) => {
        pauseTimer = setTimeout(() => reject(new Error('Stock-label frame did not pause')), 15000);
        cdp.once('Debugger.paused', event => { clearTimeout(pauseTimer); resolve(event); });
      });
      const { breakpointId } = await cdp.send('Debugger.setBreakpointByUrl', {
        url: BASE + '/tycoon/play.html', lineNumber,
      });
      const event = await paused;
      await cdp.send('Debugger.removeBreakpoint', { breakpointId });
      const result = await cdp.send('Debugger.evaluateOnCallFrame', {
        callFrameId: event.callFrames[0].callFrameId,
        expression: `amenities[0].stock = ${coffee}; amenities[1].stock = ${printer};`,
      });
      assert.ok(!result.exceptionDetails, 'stock evaluation succeeds');
      await cdp.send('Debugger.resume');
    }
    for (const [coffee, printer] of [[7, 11], [20, 30], [0, 0]]) {
      const tag = await button(page, 0).locator('.tag').elementHandle();
      await changeStock(coffee, printer);
      await page.waitForFunction(([c, p]) => {
        const tags = document.querySelectorAll('#amenities-list .tag');
        return tags[0].textContent === `${c}/20` && tags[1].textContent === `${p}/30`;
      }, [coffee, printer]);
      check(await tag.evaluate(el => el === document.querySelector('#amenities-list .tag')),
        `live stock ${coffee}/20, ${printer}/30 without rebuilding shop`);
    }
    await cdp.detach();
    await page.close();

    // Returning saves receive the normal $100 welcome-back bonus.
    const broke = await open({ cash: 25, ideaWorkers: 1, ownedRooms: ['back'] });
    for (const [i, expected] of ['Need $375 more', 'Need $175 more'].entries()) {
      check(await button(broke, i).locator('.tag').textContent() === expected, 'unaffordable: ' + expected + ' (actual: ' + await button(broke, i).locator('.tag').textContent() + ')');
      check(await button(broke, i).isDisabled(), 'unaffordable button disabled');
      check(await button(broke, i).getAttribute('title') === expected, 'shortfall title');
    }
    check((await button(broke, 2).locator('.tag').textContent()).includes('🔒'), 'locked requirement remains');
    await broke.close();

    const funded = await open({ cash: 700, ideaWorkers: 1, ownedRooms: ['back'] });
    for (const [i, price, stock] of [[0, '$500', '0/20'], [1, '$300', '0/30']]) {
      check(await button(funded, i).locator('.tag').textContent() === price, 'affordable price ' + price);
      check(await button(funded, i).isEnabled(), 'affordable purchase enabled');
      check(await button(funded, i).getAttribute('title') === '', 'no stale shortfall title');
      await button(funded, i).click();
      check(await button(funded, i).locator('.tag').textContent() === stock, 'purchase shows initial stock ' + stock);
      check(await button(funded, i).isDisabled(), 'purchase becomes owned/disabled');
    }
    await funded.close();
    check(errors.length === 0, 'zero page errors: ' + errors.join('; '));
    console.log(`${passed} passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

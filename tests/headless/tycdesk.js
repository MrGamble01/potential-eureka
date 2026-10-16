/* Hook-free: saved-game fixtures load through production code; real buttons
 * purchase desks/conversions. No injected module exports or source rewrites.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  let checks = 0;
  const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; console.log('PASS ' + label); };
  try {
    async function seeded(cash, ownedRooms = ['starter'], extraDesksByRoom = {}) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(seed => {
        localStorage.setItem('startup-tycoon-v7', JSON.stringify({ ...seed, allTimeCash: 1, v: 7, savedAt: Date.now(), offlineRatePerSec: 0 }));
        localStorage.setItem('tycoon:tipsEnabled', '0');
      }, { cash, ownedRooms, extraDesksByRoom });
      await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#add-desk-btn').textContent.match(/Desk to| full/));
      await page.click('#room-panel > .panel-title');
      return page;
    }
    async function saved(page) {
      return page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('startup-tycoon-v7'));
      });
    }
    // Returning saves receive the existing $100 welcome-back bonus.
    // Four extra desks make the next desk cost $500.
    const poor = await seeded(40, ['starter'], { starter: 4 });
    const desk = poor.locator('#add-desk-btn');
    eq(await desk.locator('.tag').textContent(), 'Need $360 more', 'next $500 desk names $360 shortfall at $140 cash');
    eq(await desk.isDisabled(), true, 'broke desk disabled');
    eq((await desk.getAttribute('title')).includes('Need $360 more'), true, 'desk title names shortfall');
    await poor.close();

    const rich = await seeded(400, ['starter'], { starter: 4 });
    const buy = rich.locator('#add-desk-btn');
    eq(await buy.locator('.tag').textContent(), '$500', 'raising cash to cost restores full price');
    eq(await buy.isEnabled(), true, 'exact-cost desk enabled');
    eq((await buy.getAttribute('title')).includes('$500'), true, 'affordable title retains cost');
    await buy.click();
    const purchased = await saved(rich);
    eq(purchased.cash, 0, 'desk charges exactly $500');
    eq(purchased.extraDesksByRoom.starter, 5, 'real click adds one desk in starter room');
    eq(await buy.locator('.tag').textContent(), 'Need $600 more', 'next desk uses unchanged escalating cost');
    await rich.close();

    const eligibleRooms = ['starter', 'front', 'left', 'right'];
    const convertPoor = await seeded(900, eligibleRooms);
    const convert = convertPoor.locator('.room-convert');
    eq(await convert.locator('.tag').textContent(), 'Need $500 more', 'eligible $1500 conversion names $500 shortfall');
    eq(await convert.isDisabled(), true, 'broke conversion disabled');
    eq((await convert.getAttribute('title')).includes('Need $500 more'), true, 'conversion title names shortfall');
    await convertPoor.close();

    const locked = await seeded(0, ['starter', 'front']);
    const lock = locked.locator('.room-convert');
    eq(await lock.locator('.tag').textContent(), 'Needs 💻 Engineering Pod + 📞 Sales Corner', 'locked conversion keeps prerequisite copy');
    eq((await lock.textContent()).includes('🔒'), true, 'locked conversion keeps lock');
    eq((await lock.textContent()).includes('Need $'), false, 'lock takes precedence over missing cash');
    eq(await lock.isDisabled(), true, 'locked conversion disabled');
    await locked.close();

    const convertRich = await seeded(1400, eligibleRooms);
    const funded = convertRich.locator('.room-convert');
    eq(await funded.locator('.tag').textContent(), '$1.5k', 'affordable conversion keeps price');
    eq(await funded.isEnabled(), true, 'exact-cost conversion enabled');
    await funded.click();
    const converted = await saved(convertRich);
    eq(converted.cash, 0, 'conversion charges exactly $1500');
    eq(converted.roomModes.front, 'sales', 'real click converts to sales floor');
    await convertRich.close();

    const capped = await seeded(0, ['starter'], { starter: 8 });
    eq((await capped.locator('#add-desk-btn').textContent()).includes(' full'), true, 'room-full copy unchanged');
    eq(await capped.locator('#add-desk-btn .tag').textContent(), '', 'full room has no shortfall tag');
    eq(errors, [], 'zero page errors');
    console.log(`\n${checks} passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

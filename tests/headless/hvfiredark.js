/* Hook-free: real animation frames, production craft clicks and wall-clock expiry. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.removeItem('homeless_village_v1');
      localStorage.setItem('hv-intro-seen', '1');
    });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof G !== 'undefined' && document.getElementById('craft-meal'));
    await page.evaluate(() => {
      G.goalIndex = GOALS.length;
      G.lastEventDay = G.days;
      G.food = 40; G.cans = 10; G.wood = 20;
      G.fireOutUntil = Date.now() + 4500;
      updateHUD();
    });
    const pill = page.locator('.stat-pill').filter({ has: page.locator('#stat-warmth') });
    await page.waitForFunction(() => document.getElementById('stat-warmth').parentElement.title ===
      '🔥 Barrel dark — 5s until the fire is back');
    assert.match(await page.locator('#stat-warmth').textContent(), /^\d+$/);
    await page.waitForFunction(() => document.getElementById('stat-warmth').parentElement.title ===
      '🔥 Barrel dark — 4s until the fire is back');
    console.log('PASS rounded-up HUD countdown ticks from 5s to 4s; warmth stays readable');
    const refused = await page.evaluate(() => {
      const before = JSON.stringify([G.food, G.cans, G.goodwill, G.activeCrafts]);
      const seconds = Math.ceil((G.fireOutUntil - Date.now()) / 1000);
      document.getElementById('craft-meal').click();
      return { seconds, log: document.querySelector('.log-line:last-child').textContent,
        unchanged: before === JSON.stringify([G.food, G.cans, G.goodwill, G.activeCrafts]) };
    });
    assert.match(refused.log, /barrel is dark.*hot meal/);
    assert.ok(refused.log.includes(refused.seconds + 's until the fire is back'));
    assert.ok(refused.unchanged);
    console.log('PASS meal refusal reports live seconds without spending or starting');
    await page.waitForFunction(() => Date.now() >= G.fireOutUntil &&
      !document.getElementById('stat-warmth').parentElement.hasAttribute('title'));
    const started = await page.evaluate(() => {
      const food = G.food, cans = G.cans;
      document.getElementById('craft-meal').click();
      return !!G.activeCrafts.meal && G.food === food - 4 && G.cans === cans - 1;
    });
    assert.ok(started);
    await page.waitForFunction(() => !G.activeCrafts.meal);
    assert.equal(await pill.getAttribute('title'), null);
    console.log('PASS natural expiry clears countdown and an affordable meal crafts');
    await page.evaluate(() => { G.fireOutUntil = Date.now() + 30000; });
    await page.waitForFunction(() => document.getElementById('stat-warmth').parentElement.title.includes('Barrel dark'));
    await page.locator('#craft-fire_ration').click();
    await page.waitForFunction(() => G.fireOutUntil === 0 &&
      !document.getElementById('stat-warmth').parentElement.hasAttribute('title'));
    await page.locator('#craft-meal').click();
    assert.ok(await page.evaluate(() => !!G.activeCrafts.meal));
    console.log('PASS Firewood clears countdown early and permits cooking');
    assert.deepEqual(errors, []);
    console.log('PASS zero page errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

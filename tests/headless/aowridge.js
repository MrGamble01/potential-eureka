/* Hook-free: the Ridge, a side front with two AI companions and a boss.
 * Unlocks after a Castle Age field order. Winning puts the company on the line. */
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
  async function boot(viewport) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 1, gold: 500, xp: 100, playerEra: 0,
      }));
    });
    await page.goto(BASE + '/ageofwar/');
    await page.click('#aow-resume-cta');
    return { context, page };
  }
  {
    const { context, page } = await boot({ width: 1280, height: 800 });
    ok(await page.locator('#aow-ridge-btn.aow-show').count() === 0, 'the ridge stays shut in the stone age');
    await page.keyboard.press('q');
    await page.waitForSelector('#aow-field-order.aow-open');
    ok(await page.locator('#aow-ridge-btn.aow-show').count() === 0, 'the ridge waits until an order is standing');
    await page.keyboard.press('1');
    await page.waitForSelector('#aow-ridge-btn.aow-show');
    await page.keyboard.press('p');
    const before = await page.locator('#aow-gold').innerText();
    await page.click('#aow-ridge-btn');
    await page.waitForSelector('#aow-ridge.aow-open');
    const card = await page.locator('#aow-ridge').innerText();
    ok(card.includes('Warden of the Ridge') && card.includes('Squire') && card.includes('Archer'),
      'the ridge names the boss and both companions');
    ok(card.includes('strike') || card.includes('brace'), 'the company announces the beat it chose');
    await page.evaluate(() => {
      const btn = document.getElementById('aow-ridge-follow');
      for (let i = 0; i < 4; i++) btn.click();
    });
    await page.waitForFunction(() => {
      const chip = document.getElementById('aow-squire-chip');
      return chip && chip.textContent.includes('Squire') && chip.style.display !== 'none';
    });
    ok((await page.locator('#aow-gold').innerText()) === before, 'the company fights the warden without spending gold');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aow-session')));
    ok(saved.ridgeCleared === true && saved.fieldOrder === 'levy', 'the company stays with the war (' + saved.gold + ')');
    await context.close();
  }
  {
    const { context, page } = await boot({ width: 390, height: 844 });
    await page.keyboard.press('q');
    await page.locator('#aow-field-order button', { hasText: 'Levy' }).click();
    await page.waitForSelector('#aow-ridge-btn.aow-show');
    await page.keyboard.press('p');
    await page.click('#aow-ridge-btn');
    await page.waitForSelector('#aow-ridge.aow-open');
    const card = await page.locator('.aow-ridge-card').boundingBox();
    const follow = await page.locator('#aow-ridge-follow').boundingBox();
    ok(card && card.y >= 0 && card.y + card.height <= 846, 'the ridge sheet stays on the phone');
    ok(follow && follow.height >= 60 && follow.width >= 300, 'following the company is a thumb target');
    await page.locator('#aow-ridge-follow').click();
    ok((await page.locator('#aow-ridge-log').innerText()).includes('Squire'), 'a thumb can let the company take the beat');
    await context.close();
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

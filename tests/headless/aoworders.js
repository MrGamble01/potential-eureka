/* Hook-free: Castle Age field orders through real Q / 1-3 input, recruit
 * prices, the next-era label, and the persisted session. */
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
  async function boot(extra) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(seed => {
      localStorage.setItem('aow-welcome-seen', '1');
      // Only the first document of this tab is seeded. A reload must
      // see whatever the game itself wrote.
      if (localStorage.getItem('aow-orders-seeded')) return;
      localStorage.setItem('aow-orders-seeded', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 1, gold: 1000, xp: 100, playerEra: 0, ...seed,
      }));
    }, extra || {});
    await page.goto(BASE + '/ageofwar/');
    await page.click('#aow-resume-cta');
    await page.evaluate(() => document.activeElement.blur());
    return { context, page };
  }
  async function ageToCastle(page) {
    await page.keyboard.press('q');
    await page.waitForSelector('#aow-field-order button');
  }
  function cost(page, name) {
    return page.locator('.aow-spawn-btn', { hasText: name }).locator('.aow-spawn-cost').innerText();
  }

  {
    const { context, page } = await boot();
    ok(await page.locator('#aow-field-order').count() === 0, 'stone age does not offer a field order');
    await ageToCastle(page);
    const buttons = page.locator('#aow-field-order button');
    ok(await buttons.count() === 3, 'castle age offers three field orders');
    ok((await page.locator('#aow-field-order').innerText()).includes('Keys') ||
      (await page.locator('#aow-field-order').innerText()).includes('[1]'), 'the card names the 1-3 keys');
    await page.keyboard.press('1');
    await page.waitForFunction(() => {
      const el = document.getElementById('aow-order-chip');
      return el && el.textContent.includes('Levy') && el.style.display !== 'none';
    });
    ok(await cost(page, 'Clubman') === '$28', 'levy raises Clubman from $25 to $28');
    ok(await cost(page, 'Swordsman') === '$143', 'levy raises Swordsman from $130 to $143');
    const spent = await page.evaluate(() => {
      const read = () => Number(document.getElementById('aow-gold').textContent);
      const before = read();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      const after = read();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
      return { before, after };
    });
    ok(spent.before - spent.after === 28, 'the queued Clubman charges the levied price (' + spent.before + ' → ' + spent.after + ')');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
    await page.goto(BASE + '/ageofwar/');
    const prompt = await page.locator('#aow-overlay').innerText();
    ok(prompt.includes('field order still stands'), 'resume copy remembers the standing order');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aow-session')));
    ok(saved.fieldOrder === 'levy' && saved.playerEra === 1 && saved.gold === spent.after,
      'session keeps levy, era, and the gold left after the levy (' + saved.gold + ')');
    await page.click('#aow-newwar-cta');
    await page.waitForFunction(() => {
      const btn = [...document.querySelectorAll('.aow-spawn-btn')].find(el => el.textContent.includes('Clubman'));
      const chip = document.getElementById('aow-order-chip');
      return btn && btn.querySelector('.aow-spawn-cost').textContent === '$25' && (!chip || chip.style.display === 'none');
    });
    ok(await cost(page, 'Clubman') === '$25', 'a new war clears the levy');
    await context.close();
  }

  {
    const { context, page } = await boot();
    await ageToCastle(page);
    await page.keyboard.press('2');
    await page.waitForFunction(() => {
      const el = document.getElementById('aow-order-chip');
      return el && el.textContent.includes('Shield');
    });
    ok(await cost(page, 'Clubman') === '$25', 'shield drill does not tax recruits');
    ok((await page.locator('#aow-order-chip').getAttribute('title')).includes('12%'), 'shield drill names the damage cut');
    ok(await page.locator('#aow-ageup-btn').getAttribute('title') === 'Need 480 more XP for Renaissance',
      'shield drill leaves the renaissance XP cost alone');
    await context.close();
  }

  {
    const { context, page } = await boot();
    await ageToCastle(page);
    await page.locator('#aow-field-order button', { hasText: 'Sapper' }).click();
    await page.waitForFunction(() => {
      const el = document.getElementById('aow-order-chip');
      return el && el.textContent.includes('Sapper');
    });
    ok(await page.locator('#aow-ageup-btn').getAttribute('title') === 'Need 552 more XP for Renaissance',
      'sapper corps raises the renaissance XP cost by 15%');
    ok((await page.locator('#aow-order-chip').getAttribute('title')).includes('18%'), 'sapper corps names the turret bonus');
    await context.close();
  }

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

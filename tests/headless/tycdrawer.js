/* Phone hire drawer stays under cash and the next step.
   After Let's go the drawer auto-opens. It used to paint over the
   cash chip and the next-step card, which the layout says stays
   visible while the drawer is open. */
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
  const hit = (page, selector) => page.evaluate(selector => {
    const el = document.querySelector(selector);
    if (!el) return { missing: true };
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { hidden: true };
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { self: !!(top && (top === el || el.contains(top))) };
  }, selector);

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
    await page.waitForSelector('#welcome-start-btn', { timeout: 8000 });
    await page.click('#welcome-start-btn');
    await page.waitForFunction(() => {
      const panel = document.getElementById('left-panel');
      const card = document.getElementById('next-action-card');
      return panel && panel.classList.contains('open') &&
        card && getComputedStyle(card).display !== 'none';
    }, { timeout: 8000 });
    await page.waitForTimeout(300);

    const cash = await hit(page, '#cash-hud');
    const card = await hit(page, '#next-action-card');
    const menu = await hit(page, '#sidebar-toggle');
    const hire = await hit(page, '#hire-btn');
    const clear = await page.evaluate(() => {
      const panel = document.getElementById('left-panel');
      const card = document.getElementById('next-action-card');
      const pad = parseFloat(getComputedStyle(panel).paddingBottom);
      const cover = window.innerHeight - card.getBoundingClientRect().top;
      return pad + 1 >= cover;
    });
    ok(cash.self, '390x844: cash chip receives the tap while the drawer is open');
    ok(card.self, '390x844: next step receives the tap while the drawer is open');
    ok(menu.self, '390x844: the menu button still closes the drawer');
    ok(hire.self, '390x844: Hire Engineer still receives the tap');
    ok(clear, '390x844: drawer content can scroll clear of the next step');

    await page.click('#sidebar-toggle');
    await page.waitForFunction(() => !document.getElementById('left-panel').classList.contains('open'));
    const cashClosed = await hit(page, '#cash-hud');
    const cardClosed = await hit(page, '#next-action-card');
    ok(cashClosed.self && cardClosed.self, '390x844: cash and next step stay tappable with the drawer closed');

    await context.close();

    const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const deskPage = await desk.newPage();
    deskPage.on('pageerror', error => errors.push(String(error)));
    await deskPage.addInitScript(() => localStorage.setItem('tycoon:welcomeSeen-v1', '1'));
    await deskPage.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
    await deskPage.waitForSelector('#hire-btn', { timeout: 8000 });
    const deskHire = await hit(deskPage, '#hire-btn');
    const deskCash = await hit(deskPage, '#cash-hud');
    const drawer = await deskPage.evaluate(() => {
      const toggle = document.getElementById('sidebar-toggle');
      const panel = document.getElementById('left-panel');
      return getComputedStyle(toggle).display === 'none' && !panel.classList.contains('open');
    });
    ok(deskHire.self && deskCash.self && drawer, '1280x800: hire and cash stay on the desk, drawer stays put');
    await desk.close();

    ok(errors.length === 0, 'zero page errors');
  } finally {
    console.log(`\n${pass} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail ? 1 : 0);
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});

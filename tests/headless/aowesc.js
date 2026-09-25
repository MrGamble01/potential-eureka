/* Hook-free: real browsing buttons + Escape must release the modal pause.
 * Observe battle time through the production pagehide session writer.
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
  const open = async (width = 1280, council = false, welcome = false) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    if (!welcome) await page.addInitScript(council => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 2, gold: 1000, runStats: { time: 30 },
        ...(council ? { councilPending: ['steel', 'medics'] } : {}),
      }));
    }, council);
    await page.goto(BASE + '/ageofwar/');
    if (!welcome) await page.click('#aow-resume-cta');
    return { context, page };
  };
  const battleTime = page => page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'));
    return JSON.parse(localStorage.getItem('aow-session')).runStats.time;
  });
  try {
    for (const width of [1280, 768]) {
      for (const [id, name] of [['settings', 'Settings'], ['ach', 'Awards'], ['chain', 'The Line']]) {
        const { context, page } = await open(width);
        const label = `${width}: ${name}`;
        await page.click(`#aow-${id}-btn`);
        ok(await page.locator(`#aow-${id}-modal`).isVisible(), `${label} opens from its real button`);
        const held = await battleTime(page);
        await page.waitForTimeout(250);
        ok(await battleTime(page) === held, `${label} pauses the battle while browsing`);
        await page.keyboard.press('Escape');
        ok(await page.$eval(`#aow-${id}-modal`, el => getComputedStyle(el).display === 'none'),
          `${label} closes on Escape`);
        await page.waitForTimeout(350);
        ok(await battleTime(page) > held, `${label} Escape resumes battle time`);
        await context.close();
      }
    }
    {
      const { context, page } = await open();
      const before = await battleTime(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      ok(await battleTime(page) > before, 'Escape on a clean play page leaves the battle running');
      await page.click('#aow-pause-btn');
      const held = await battleTime(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      ok(await page.locator('#aow-resume-cta').isVisible() && await battleTime(page) === held,
        'Escape preserves an intentional user pause');
      await context.close();
    }
    {
      const { context, page } = await open(1280, true);
      ok(await page.locator('#aow-council').isVisible(), 'saved War Council is open');
      await page.keyboard.press('Escape');
      ok(await page.locator('#aow-council').isVisible(), 'Escape leaves the forced-choice War Council open');
      await context.close();
    }
    for (const key of ['Escape', 'Enter']) {
      const { context, page } = await open(1280, false, true);
      ok(await page.locator('#aow-welcome-modal').isVisible(), `${key}: fresh welcome is open`);
      await page.keyboard.press(key);
      ok(await page.locator('#aow-welcome-modal').isHidden() &&
        await page.evaluate(() => localStorage.getItem('aow-welcome-seen')) === '1',
      `${key} still dismisses welcome and records it seen`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });

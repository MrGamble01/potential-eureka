/* Pause, win, and resume sheets stop above the command rail.
   A fixed overlay that ran to the viewport bottom painted relic
   buttons on top of Pause, Awards, and the recruit row. */
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
  const open = async (viewport, mobile) => {
    const context = await browser.newContext({
      viewport,
      isMobile: !!mobile,
      hasTouch: !!mobile,
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      localStorage.setItem('aow-welcome-seen', '1');
    });
    await page.goto(BASE + '/ageofwar/', { waitUntil: 'load' });
    await page.waitForSelector('#aow-pause-btn', { timeout: 8000 });
    await page.waitForTimeout(400);
    return { context, page };
  };
  const hit = (page, selector) => page.evaluate(selector => {
    const el = document.querySelector(selector);
    if (!el) return { missing: true };
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(x, y);
    const sheet = document.getElementById('aow-overlay');
    const bar = document.querySelector('.aow-actionbar');
    const spawn = document.getElementById('aow-spawn-list');
    const sr = sheet ? sheet.getBoundingClientRect() : null;
    const br = bar ? bar.getBoundingClientRect() : null;
    const pr = spawn ? spawn.getBoundingClientRect() : null;
    return {
      self: !!(top && (top === el || el.contains(top))),
      relic: !!(top && top.closest && top.closest('.relic-perk')),
      sheet: !!(top && top.closest && top.closest('#aow-overlay')),
      sheetAboveBar: !!(sr && br && sr.bottom <= br.top + 1),
      sheetAboveSpawn: !!(sr && pr && sr.bottom <= pr.top + 1),
    };
  }, selector);

  try {
    for (const [label, viewport, mobile] of [
      ['390x844', { width: 390, height: 844 }, true],
      ['1280x800', { width: 1280, height: 800 }, false],
    ]) {
      const { context, page } = await open(viewport, mobile);
      await page.click('#aow-pause-btn');
      await page.waitForSelector('#aow-resume-cta', { timeout: 4000 });
      const pause = await hit(page, '#aow-pause-btn');
      const awards = await hit(page, '#aow-ach-btn');
      const spawn = await hit(page, '.aow-spawn-btn');
      const resume = await hit(page, '#aow-resume-cta');
      ok(pause.self && !pause.relic && !pause.sheet && pause.sheetAboveBar,
        `${label}: Pause stays on the action bar, above the pause sheet`);
      ok(awards.self && !awards.relic && !awards.sheet,
        `${label}: Awards stays on the action bar`);
      ok(spawn.self && !spawn.relic && !spawn.sheet && spawn.sheetAboveSpawn,
        `${label}: a recruit button stays on the spawn row`);
      ok(resume.self && !resume.relic,
        `${label}: Resume war is the thing under its own tap`);

      const relic = page.locator('#aow-overlay .relic-perk').first();
      await relic.scrollIntoViewIfNeeded();
      const armed = await page.evaluate(() => {
        const btn = document.querySelector('#aow-overlay .relic-perk');
        const r = btn.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(top && top.closest && top.closest('.relic-perk'));
      });
      ok(armed, `${label}: a relic button is tappable inside the sheet`);
      await relic.click();
      ok(await page.locator('#aow-overlay').isVisible() && await page.locator('#aow-resume-cta').isVisible(),
        `${label}: arming a relic leaves the war paused`);

      const box = await page.locator('#aow-pause-btn').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(200);
      ok(await page.locator('#aow-overlay').evaluate(el => el.style.display === 'none'),
        `${label}: the uncovered Pause button resumes the war`);
      await context.close();
    }
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

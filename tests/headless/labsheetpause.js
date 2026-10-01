/* Browsing Grow Op sheets must hold the operation, including contract deadlines.
 * Uses real controls and the production lifecycle save; no game hooks. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (value, name) => { value ? pass++ : fail++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const width of [1280, 768]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      const saved = () => page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        const s = JSON.parse(localStorage.getItem('drug-lab-v1'));
        return { plots: s.plots, heat: s.heat, cash: s.cash, market: s.market,
          trimQueue: s.trimQueue, trimBags: s.trimBags, contract: s.contract };
      });
      const held = async label => {
        const before = await saved();
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(1400);
        await page.keyboard.up('KeyD');
        ok(JSON.stringify(await saved()) === JSON.stringify(before), `${width}: ${label} holds production, heat, market and contract`);
      };
      const resumed = async label => {
        const before = await saved();
        await page.waitForTimeout(600);
        const after = await saved();
        ok(after.market.shiftIn < before.market.shiftIn, `${width}: ${label} resumes simulation`);
        if (before.contract) ok(after.contract.timeLeft < before.contract.timeLeft &&
          before.contract.timeLeft - after.contract.timeLeft < 1, `${width}: closing does not catch up the paused deadline`);
      };
      await page.goto(BASE + '/drug-lab.html');
      await page.waitForSelector('#diff-modal.open');
      await held('difficulty picker');
      await page.click('#diff-careful');
      await page.waitForSelector('#intro-modal.open');
      await held('first crash course');
      await page.click('#intro-go');
      await resumed('starting play');
      // Seed an established operation through the supported save format.
      await page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        const s = JSON.parse(localStorage.getItem('drug-lab-v1'));
        Object.assign(s, { cash: 1000, heat: 40, trimmers: 1, trimQueue: 5,
          contract: { need: 10, filled: 0, timeLeft: 25, bonusMult: 0.8 },
          plots: s.plots.map(p => ({ ...p, g: 0.1 })), savedAt: Date.now() });
        localStorage.setItem('drug-lab-v1', JSON.stringify(s));
      });
      // Navigate from a separate same-origin page so unload cannot overwrite the seed.
      const seed = await page.evaluate(() => localStorage.getItem('drug-lab-v1'));
      await page.goto(BASE + '/404.html');
      await page.evaluate(seed => localStorage.setItem('drug-lab-v1', seed), seed);
      await page.goto(BASE + '/drug-lab.html');
      await page.waitForSelector('#chain-toggle');
      for (const close of ['button', 'backdrop']) {
        await page.click('#chain-toggle');
        await page.waitForSelector('#chain-modal.open');
        await held(`The Corner (${close})`);
        if (close === 'button') await page.click('#chain-close');
        else await page.locator('#chain-modal').click({ position: { x: 5, y: 5 } });
        await resumed(`The Corner ${close}`);
      }
      await page.click('#lab-help-btn');
      await page.waitForSelector('#intro-modal.open');
      await held('mid-run crash course');
      await page.keyboard.press('Escape');
      await resumed('crash course Escape');
      ok(errors.length === 0, `${width}: no page errors ${errors.join('; ')}`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

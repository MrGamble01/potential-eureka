/*
 * Occupied lots offer Buy & convert beside Demolish & build new.
 * The sound sliders stay off the objective card and the build drawer.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8124';
const SIZES = [[390, 844], [744, 1133], [1366, 768], [1920, 1080]];

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    for (const [width, height] of SIZES) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 });
      page.setDefaultTimeout(20000);
      await page.addInitScript(() => localStorage.removeItem('growop-cartel-v1'));
      await page.goto(BASE + '/games/grow-op/index.html', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#btn-start-operation').click();
      await page.evaluate(() => {
        const g = window.__growOp;
        g.sim.state.dirtyCash = 40000;
        g.sim.state.cleanCash = 40000;
        g.dismissChrome();
        g.openLot('lot_rp_gas');
      });
      await page.waitForTimeout(200);
      const card = await page.evaluate(() => {
        const convert = document.querySelector('[data-path="convert"]');
        const rebuild = document.querySelector('[data-path="rebuild"]');
        if (!convert || !rebuild) return { missing: true };
        const a = convert.getBoundingClientRect();
        const b = rebuild.getBoundingClientRect();
        const text = document.getElementById('lot-card').innerText;
        return {
          side: a.right <= b.left + 2 && Math.abs(a.top - b.top) < 24,
          both: text.includes('Buy & convert') && text.includes('Demolish & build new'),
          cost: /\d+s/.test(text) && text.includes('dirty'),
        };
      });
      ok(!card.missing && card.both, width + ' lot card shows both paths');
      ok(!card.missing && card.side, width + ' paths sit side by side');
      ok(!card.missing && card.cost, width + ' rebuild shows cost and time');

      await page.locator('[data-path="rebuild"] button').first().click();
      await page.waitForTimeout(250);
      const phase = await page.evaluate(() => window.__growOp.sim.state.lots.lot_rp_gas.phase);
      ok(phase === 'demolishing', width + ' demolish started (' + phase + ')');

      await page.evaluate(() => window.__growOp.openZone('jungle_alta'));
      await page.waitForTimeout(200);
      const zone = await page.evaluate(() => {
        const card = document.getElementById('zone-card');
        return { open: card && !card.hidden, text: card ? card.innerText : '' };
      });
      ok(zone.open && zone.text.includes('Selva Alta'), width + ' unlock screen names Selva Alta');

      await page.evaluate(() => {
        document.getElementById('zone-card').hidden = true;
        document.getElementById('btn-mute').click();
      });
      await page.waitForTimeout(100);
      const mix = await page.evaluate(() => {
        const panel = document.getElementById('mix-panel').getBoundingClientRect();
        const obj = document.getElementById('objective-card').getBoundingClientRect();
        const drawer = document.getElementById('go-drawer').getBoundingClientRect();
        const drawerOpen = !document.getElementById('go-drawer').classList.contains('is-collapsed');
        const hit = (a, b) => {
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          return x > 1 && y > 1;
        };
        return {
          shown: panel.width > 20 && panel.height > 20,
          onScreen: panel.left >= -1 && panel.top >= -1 && panel.right <= innerWidth + 1 && panel.bottom <= innerHeight + 1,
          obj: hit(panel, obj),
          drawer: drawerOpen && hit(panel, drawer),
        };
      });
      ok(mix.shown && mix.onScreen && !mix.obj && !mix.drawer, width + ' sound sliders clear the HUD ' + JSON.stringify(mix));
      await page.close();
    }
  } catch (err) {
    ok(false, String(err && err.message || err).split('\n')[0]);
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();

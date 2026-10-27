/*
 * Default HUD is the objective, one cash chip, pause, menu, and Build.
 * At 1366x768 those chips cover under 12% of the screen.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8124';

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
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.setDefaultTimeout(20000);
    await page.addInitScript(() => localStorage.removeItem('growop-cartel-v1'));
    await page.goto(BASE + '/games/grow-op/index.html', { waitUntil: 'load' });
    await page.locator('#btn-start-operation').click();
    await page.evaluate(() => window.__growOp.dismissChrome());
    await page.waitForTimeout(200);
    const hud = await page.evaluate(() => {
      const visible = (el) => {
        if (!el || el.hidden || el.closest('[hidden]')) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2;
      };
      const els = [...document.querySelectorAll('[data-hud]')].filter(visible);
      const area = els.reduce((sum, el) => {
        const r = el.getBoundingClientRect();
        return sum + r.width * r.height;
      }, 0);
      const heat = document.getElementById('heat-meter');
      const eventCard = document.getElementById('event-card');
      return {
        count: els.length,
        names: els.map((el) => el.id),
        cover: area / (innerWidth * innerHeight),
        heat: visible(heat),
        event: visible(eventCard),
        side: visible(document.getElementById('side-goal')),
      };
    });
    ok(hud.count <= 6, 'HUD controls ' + hud.count + ' ' + hud.names.join(','));
    ok(hud.cover < 0.12, 'HUD covers ' + (hud.cover * 100).toFixed(1) + '%');
    ok(!hud.heat && !hud.event && !hud.side, 'heat, events, and side goals stay off');
  } catch (err) {
    ok(false, String(err && err.message || err).split('\n')[0]);
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();

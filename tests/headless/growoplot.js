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
          both: text.includes('Buy & convert') && text.includes('Tear down & build new'),
          cost: /\d+s/.test(text) && !!document.querySelector('#lot-card .go-purse--dirty'),
        };
      });
      ok(!card.missing && card.both, width + ' lot card shows both paths');
      ok(!card.missing && card.side, width + ' paths sit side by side');
      ok(!card.missing && card.cost, width + ' rebuild shows cost and time');

      await page.locator('[data-path="rebuild"] .go-tile').first().click();
      await page.locator('[data-deal="confirm"]').click();
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
      const offer = await page.evaluate(() => {
        const g = window.__growOp;
        g.sim.state.cleanCash = 80000;
        g.sim.state.reputation = 40;
        g.sim.state.mapOpen = true;
        g.sim.state.completedMissions = ['m1_first_export', 'm2_first_front'];
        g.sim.unlockZone('ps_docks');
        g.openLot('lot_dk_wh');
        const text = document.getElementById('lot-card').innerText;
        const tiles = [...document.querySelectorAll('#lot-card .go-tile')];
        const cutOff = tiles.some((btn) => {
          const r = btn.getBoundingClientRect();
          return r.width > 2 && (r.bottom > innerHeight - 4 || r.top < 0);
        });
        const day = document.getElementById('day-sub');
        const dayBox = day ? day.getBoundingClientRect() : null;
        const meters = document.querySelector('.go-meters').getBoundingClientRect();
        const dayOverlap = !!(dayBox && dayBox.width > 2 && dayBox.height > 2 && dayBox.bottom > meters.top + 1 && dayBox.top < meters.bottom - 1 && dayBox.right > meters.left + 1 && dayBox.left < meters.right - 1);
        return {
          farms: /Plantation|Coffee Farm|Highland Farm/.test(text),
          city: /Taxi Front|Warehouse|Chem Lab/.test(text),
          cutOff,
          dayOverlap,
        };
      });
      ok(!offer.farms && offer.city, width + ' city lot skips farms');
      ok(!offer.cutOff, width + ' build tiles stay on screen');
      ok(!offer.dayOverlap, width + ' day line clear of cash meters');

      await page.evaluate(() => {
        document.getElementById('zone-card').hidden = true;
        const menu = document.getElementById('menu-panel');
        if (menu) menu.hidden = false;
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

/* Hook-free wholesale van ETA through production saves and page-clock time. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (value, name) => { value ? pass++ : fail++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.clock.install({ time: new Date('2026-09-25T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-25T12:00:01Z'));
    await page.goto(BASE + '/drug-lab.html');
    const staticTitle = await page.locator('#route-toggle').getAttribute('title');
    await page.click('#diff-careful');
    await page.click('#intro-go');
    const seed = await page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
      return JSON.parse(localStorage.getItem('drug-lab-v1'));
    });
    Object.assign(seed, { totalEarned: 15000, route: true, routeT: 12.2, routeCold: 0,
      stashCount: 0, routeShipped: 0 });
    const load = async overrides => {
      await page.goto(BASE + '/404.html');
      await page.evaluate(s => {
        s.savedAt = Date.now();
        localStorage.setItem('drug-lab-v1', JSON.stringify(s));
      }, { ...seed, ...overrides });
      await page.goto(BASE + '/drug-lab.html');
    };
    const read = () => page.evaluate(() => {
      const b = document.getElementById('route-toggle');
      window.dispatchEvent(new Event('pagehide'));
      return { text: b.textContent, title: b.title, visible: b.style.display !== 'none',
        save: JSON.parse(localStorage.getItem('drug-lab-v1')), feed: document.body.textContent };
    });
    await load({});
    const start = await read();
    ok(start.visible && start.text === '📦 ROUTE: ON · 13s', 'Act III route shows rounded-up next-van seconds');
    await page.clock.runFor(1000);
    const tick = await read();
    ok(tick.save.routeT < start.save.routeT && tick.text === '📦 ROUTE: ON · 12s', 'waiting countdown advances through production time');
    ok(/next.*van.*13s/i.test(start.title) && /next.*van.*12s/i.test(tick.title), 'title names the live next-van wait');
    await page.click('#route-toggle');
    await page.clock.runFor(1000);
    const off = await read();
    ok(off.text === '📦 ROUTE: OFF' && !off.save.route, 'OFF has no countdown');
    ok(off.title === staticTitle, 'turning OFF restores Distributor title');
    await load({ routeCold: 8.2 });
    const burned = await read();
    await page.clock.runFor(1000);
    const coldTick = await read();
    ok(burned.text === '📦 ROUTE BURNED · 9s' && coldTick.text === '📦 ROUTE BURNED · 8s', 'burned state retains live cold seconds');
    ok(burned.title === staticTitle, 'burned route keeps static Distributor title');
    await load({ routeT: 1.2 });
    await page.clock.runFor(1300);
    const waited = await read();
    ok(waited.feed.includes('The van waited on an empty stash.') && waited.save.stashCount === 0 &&
      waited.save.routeShipped === 0 && waited.save.routeCold === 0, 'empty stash still waits without shipping or burning');
    ok(waited.text === '📦 ROUTE: ON · 45s', 'empty-stash wait rearms visible next-van countdown');
    ok(errors.length === 0, `no page errors ${errors.join('; ')}`);
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

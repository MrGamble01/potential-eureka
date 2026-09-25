/* Hook-free street-demand countdowns, seeded through production saves.
 * Page-clock time drives the real animation and market update path. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (value, name) => { value ? pass++ : fail++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const width of [1280, 768]) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.clock.install({ time: new Date('2026-09-25T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-09-25T12:00:01Z'));
      await page.goto(BASE + '/drug-lab.html');
      await page.click('#diff-careful');
      await page.click('#intro-go');
      const seed = await page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('drug-lab-v1'));
      });
      for (const mult of [1.62, 0.68]) {
        seed.market = { mult: 1, target: 1, shiftIn: 100, surgeIn: 100,
          surge: { mult, left: 1.2 } };
        await page.goto(BASE + '/404.html');
        await page.evaluate(s => {
          s.savedAt = Date.now();
          localStorage.setItem('drug-lab-v1', JSON.stringify(s));
        }, seed);
        await page.goto(BASE + '/drug-lab.html');
        const read = () => page.evaluate(() => {
          const hud = document.getElementById('market-hud');
          window.dispatchEvent(new Event('pagehide'));
          return { text: document.getElementById('market-val').textContent,
            title: hud.title, hot: hud.classList.contains('hot'), cold: hud.classList.contains('cold'),
            market: JSON.parse(localStorage.getItem('drug-lab-v1')).market };
        });
        const start = await read();
        await page.clock.runFor(1000);
        const tick = await read();
        await page.clock.runFor(300);
        const calm = await read();
        const result = { start, tick, calm, expired: calm.market.surge === null };
        ok(tick.market.surge.left < start.market.surge.left && tick.market.mult === start.market.mult, `${width}: production time advances at stable multiplier`);
        const name = `${width} ${mult > 1 ? 'surge' : 'crash'}`;
        ok(result.start.text.includes(`${mult.toFixed(2)}×`) && /\b2s\b/.test(result.start.text), `${name}: effective multiplier and rounded-up 2s (${result.start.text})`);
        ok(/\b1s\b/.test(result.tick.text) && result.tick.text !== result.start.text, `${name}: stable multiplier ticks to 1s`);
        ok(mult > 1 ? result.start.hot && !result.start.cold : result.start.cold && !result.start.hot, `${name}: distinct hot/cold style`);
        ok(/\b2s\b/.test(result.start.title) && /\b1s\b/.test(result.tick.title) &&
          (mult > 1 ? /sell high/i : /hold.*stash/i).test(result.tick.title), `${name}: live title explains window`);
        ok(result.expired && !/\d+s\b/.test(result.calm.text) && result.calm.text === '1.00×', `${name}: expiry restores calm multiplier-only chip`);
        ok(result.calm.title === 'Street demand — prices drift, surge and crash. Sell high.', `${name}: calm title restored`);
      }
      ok(errors.length === 0, `${width}: no page errors ${errors.join('; ')}`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

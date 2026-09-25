/* Hook-free Getaway Bag purchases through production saves, DOM clicks and page time. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (value, name) => { value ? pass++ : fail++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const width of [1280, 768]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.clock.install({ time: new Date('2026-09-25T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-09-25T12:00:01Z'));
      await page.goto(BASE + '/drug-lab.html');
      const originalTitle = await page.locator('#bag-toggle').getAttribute('title');
      await page.click('#diff-careful');
      await page.click('#intro-go');
      const seed = await page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('drug-lab-v1'));
      });
      Object.assign(seed, { totalEarned: 15000, cash: 2000, bagPacked: false, skips: 0,
        goalIndex: 6, route: false, stashCount: 0 });
      const load = async overrides => {
        await page.goto(BASE + '/404.html');
        await page.evaluate(s => {
          s.savedAt = Date.now();
          localStorage.setItem('drug-lab-v1', JSON.stringify(s));
        }, { ...seed, ...overrides });
        await page.goto(BASE + '/drug-lab.html');
      };
      const read = () => page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        const b = document.getElementById('bag-toggle');
        return { text: b.textContent, title: b.title, hidden: getComputedStyle(b).display === 'none',
          save: JSON.parse(localStorage.getItem('drug-lab-v1')),
          toast: document.getElementById('toast-container').textContent };
      });
      const check = (value, name) => ok(value, `${width}: ${name}`);
      await load({});
      const broke = await read();
      check(!broke.hidden && broke.text === '🎒 PACK A BAG Need $500 more' &&
        broke.title.includes('Need $500 more'), 'A: broke label and title name shortfall');
      await page.click('#bag-toggle');
      const refused = await read();
      check(refused.toast.includes('Need $500 more') && refused.save.cash === 2000 &&
        !refused.save.bagPacked && refused.save.skips === 0, 'A: real click explains shortfall without packing');
      await load({ cash: 2500 });
      const affordable = await read();
      check(affordable.text === '🎒 PACK A BAG $2.5k' && affordable.title === originalTitle,
        'B: affordable price and original title');
      await page.click('#bag-toggle');
      const packed = await read();
      check(packed.save.cash === 0 && packed.save.bagPacked && packed.save.skips === 0 &&
        packed.text === '🎒 BAG PACKED' && packed.title === originalTitle,
        'B: pack spends $2,500 once and flips label');
      await page.click('#bag-toggle');
      const again = await read();
      check(again.save.cash === 0 && again.save.bagPacked && again.toast.includes('already by the back door'),
        'B: packed refusal stays unchanged');
      await load({ cash: 3000, totalEarned: 2000 });
      check((await read()).hidden, 'C: Act II button is hidden');
      // Exercise the real hidden control handler, without exposing game internals.
      await page.locator('#bag-toggle').evaluate(b => b.onclick());
      const gated = await read();
      check(gated.toast.includes('Getaway bags unlock in Act III') && gated.save.cash === 3000 &&
        !gated.save.bagPacked, 'C: Act gate refuses without packing');
      await load({ totalEarned: 15000, route: true, routeT: 1, stashCount: 3 });
      check((await read()).text === '🎒 PACK A BAG Need $500 more', 'D: shortfall before live wholesale gain');
      await page.clock.runFor(1500);
      const gained = await read();
      const shortfall = 2500 - gained.save.cash;
      check(gained.save.cash > 2000 && gained.save.cash < 2500 && gained.save.routeShipped === 3,
        'D: production route makes a partial cash gain');
      check(gained.text === `🎒 PACK A BAG Need $${shortfall} more` &&
        gained.title.includes(`Need $${shortfall} more`) && !gained.save.bagPacked,
        'D: live shortfall label/title update without reload');
      check(errors.length === 0, `zero page errors ${errors.join('; ')}`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

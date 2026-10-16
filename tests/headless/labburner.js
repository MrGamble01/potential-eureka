/* Hook-free Burner purchases through production saves, DOM clicks and page time. */
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
      const originalTitle = await page.locator('#burner-toggle').getAttribute('title');
      await page.click('#diff-careful');
      await page.click('#intro-go');
      const seed = await page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('drug-lab-v1'));
      });
      Object.assign(seed, { totalEarned: 2000, cash: 300, burnerLeft: 0, burnersBought: 0,
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
        const b = document.getElementById('burner-toggle');
        return { text: b.textContent, title: b.title, hidden: getComputedStyle(b).display === 'none',
          save: JSON.parse(localStorage.getItem('drug-lab-v1')),
          toast: document.getElementById('toast-container').textContent };
      });
      const check = (value, name) => ok(value, `${width}: ${name}`);
      await load({});
      const broke = await read();
      check(!broke.hidden && broke.text === '📱 BURNER Need $500 more' &&
        broke.title.includes('Need $500 more'), 'A: broke label and title name shortfall');
      await page.click('#burner-toggle');
      const refused = await read();
      check(refused.toast.includes('Need $500 more') && refused.save.cash === 300 &&
        refused.save.burnerLeft === 0 && refused.save.burnersBought === 0, 'A: real click explains shortfall without spending/charging');
      await load({ cash: 800 });
      const affordable = await read();
      check(affordable.text === '📱 BURNER $800' && affordable.title === originalTitle,
        'B: affordable price and original title');
      await page.click('#burner-toggle');
      const bought = await read();
      check(bought.save.cash === 0 && bought.save.burnerLeft === 10 && bought.save.burnersBought === 1 &&
        bought.text === '📱 BURNER · 10 LEFT' && bought.title === originalTitle,
        'B: purchase spends $800 once and flips label');
      await page.click('#burner-toggle');
      const again = await read();
      check(again.save.cash === 0 && again.save.burnerLeft === 10 && again.save.burnersBought === 1 && again.toast.includes('10 sales of charge left.'), 'B: fresh-number refusal stays unchanged');
      await load({ cash: 2000, totalEarned: 0 });
      check((await read()).hidden, 'C: Act I button is hidden');
      // Exercise the real hidden control handler, without exposing game internals.
      await page.locator('#burner-toggle').evaluate(b => b.onclick());
      const gated = await read();
      check(gated.toast.includes('Clean numbers unlock in Act II') && gated.save.cash === 2000 &&
        gated.save.burnerLeft === 0 && gated.save.burnersBought === 0, 'C: Act gate refuses without spending/charging');
      await load({ totalEarned: 15000, route: true, routeT: 1, stashCount: 3 });
      check((await read()).text === '📱 BURNER Need $500 more', 'D: shortfall before live wholesale gain');
      await page.clock.runFor(1500);
      const gained = await read();
      const shortfall = 800 - gained.save.cash;
      check(gained.save.cash > 300 && gained.save.cash < 800 && gained.save.routeShipped === 3,
        'D: production route makes a partial cash gain');
      check(gained.text === `📱 BURNER Need $${shortfall} more` &&
        gained.title.includes(`Need $${shortfall} more`) && gained.save.burnerLeft === 0 && gained.save.burnersBought === 0,
        'D: live shortfall label/title update without reload');
      check(errors.length === 0, `zero page errors ${errors.join('; ')}`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

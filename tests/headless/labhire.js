/* Hire refusals and disabled-button explanations, through saves and real DOM
 * handlers. No game hooks; invoke onclick because disabled buttons block clicks. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (value, name) => { value ? pass++ : fail++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); };
const roles = [
  ['trimmer', 'trimmers', 3, 150, '✂️ Trimmer hired.'],
  ['lookout', 'lookouts', 2, 300, '👁️ Lookout on duty.'],
  ['runner', 'runners', 3, 400, '🏃 Runner hired — hauls product & closes deals.'],
  ['cook', 'cooks', 3, 800, '🧪 Cook hired.'],
];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const scenario of ['broke', 'full', 'full and broke', 'affordable']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(BASE + '/drug-lab.html');
      await page.click('#diff-careful');
      await page.click('#intro-go');
      const seed = await page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('drug-lab-v1'));
      });
      seed.cash = scenario.includes('broke') ? 0 : 10000;
      for (const [, key, cap] of roles) seed[key] = scenario.includes('full') ? cap : 1;
      seed.totalEarned = 2000;
      seed.upgrades.chemistry = 1;
      seed.ownedRooms = ['garage', 'growroom', 'warehouse'];
      await page.goto(BASE + '/404.html');
      await page.evaluate(s => {
        s.savedAt = Date.now();
        localStorage.setItem('drug-lab-v1', JSON.stringify(s));
      }, seed);
      await page.goto(BASE + '/drug-lab.html');
      await page.click('#lab-help-btn'); // Hold the simulation during exact save comparisons.
      await page.waitForSelector('#intro-modal.open');
      for (const [role, key, cap, baseCost, success] of roles) {
        const result = await page.evaluate(({ role, key }) => {
          const snapshot = () => {
            window.dispatchEvent(new Event('pagehide'));
            const s = JSON.parse(localStorage.getItem('drug-lab-v1'));
            return { cash: s.cash, count: s[key] };
          };
          const button = document.getElementById(`hire-${role}-btn`);
          const before = snapshot();
          const title = button.title, disabled = button.disabled;
          document.getElementById('toast-container').replaceChildren();
          button.onclick();
          return { before, after: snapshot(), title, disabled, nextTitle: button.title,
            toast: document.querySelector('#toast-container .toast')?.textContent || '' };
        }, { role, key });
        const name = role[0].toUpperCase() + role.slice(1);
        const cost = baseCost * (1 + result.before.count);
        if (scenario === 'affordable') {
          ok(!result.disabled && result.after.cash === result.before.cash - cost &&
            result.after.count === result.before.count + 1, `${role}: affordable hire spends once and adds one`);
          ok(result.toast === success, `${role}: success toast unchanged`);
          ok(!/Can't afford|full/.test(result.title) && result.title.includes(role === 'runner' ? 'Runners' : name), `${role}: available title explains hire`);
          if (result.after.count === cap) ok(result.nextTitle.includes('full'), `${role}: title updates after filling last seat`);
        } else {
          const expected = scenario.includes('full') ? `${name} crew is full (${cap}/${cap}).` :
            `Can't afford a ${name} yet ($${cost === 1600 ? '1.6k' : String(cost)}).`;
          ok(result.disabled, `${scenario} ${role}: disabled`);
          ok(result.toast === expected, `${scenario} ${role}: refusal toast (${result.toast || 'silent'})`);
          ok(result.title === expected, `${scenario} ${role}: disabled title`);
          ok(JSON.stringify(result.before) === JSON.stringify(result.after), `${scenario} ${role}: cash and count unchanged`);
        }
      }
      ok(errors.length === 0, `${scenario}: no page errors ${errors.join('; ')}`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

/* HV-131 — the Anniversary said a whole year, then counted three looks.
 *
 * The 🕯️ tooltip and the payout log both claim the camp has held a
 * whole year. The gate is three snapshot looks (annivCounts), not
 * 28 days / four seasons. A two-day camp with three looks still
 * lights a candle for a year.
 *
 *  A. The 🕯️ row exists. Three looks still pay; two looks still refuse.
 *  B. THE LIE: the tooltip must not claim a whole year.
 *     On main this fails — it says "held a whole year under this bridge."
 *  C. THE LIE: the payout log on a two-day camp must not claim a year.
 *  D. The dish is still 3+looks (cap 5). We did not touch the pot.
 *  Z. Zero page errors.
 *
 * Hook-free. Distinct from HV-44 (hvanniv: dish + once-a-session).
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvyear-init')) {
      sessionStorage.setItem('hvyear-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-portrait');
      localStorage.removeItem('hv-anniversary');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // A — the gate and the pot stay
  const gate = await page.evaluate(() => {
    saveHvSnap({ looks: 2 });
    saveHvAnniv({ toasts: 0 });
    annivMarked = false;
    G.food = 10;
    G.days = 2;
    finishAction({ id: 'anniv' });
    const refused = { food: G.food, toasts: loadHvAnniv().toasts, counts: annivCounts() };
    saveHvSnap({ looks: 3 });
    const row = ACTIONS.find(a => a.id === 'anniv');
    return {
      refused,
      counts3: annivCounts(),
      dish: annivDish(),
      tip: row && row.tooltip,
    };
  });
  ok(gate.refused.food === 10 && gate.refused.toasts === 0 && !gate.refused.counts,
    'two snapshot looks still refuse the candle');
  ok(gate.counts3 && gate.dish === 6,
    `three looks still open the candle and pay 6 food (dish ${gate.dish})`);

  // B — the tooltip must not sell a year the gate never counted
  ok(gate.tip && !/whole year|\ba year\b/i.test(gate.tip),
    `the Anniversary tip does not claim a whole year (got ${JSON.stringify(gate.tip)})`);

  // C — a two-day camp must not log a year
  const lit = await page.evaluate(() => {
    const feed = document.getElementById('log-feed');
    if (feed) feed.innerHTML = '';
    annivMarked = false;
    G.days = 2;
    G.food = 10;
    finishAction({ id: 'anniv' });
    const lines = [...document.querySelectorAll('#log-feed .log-line')]
      .map(el => el.textContent).join('\n');
    return { food: G.food, toasts: loadHvAnniv().toasts, days: G.days, lines };
  });
  ok(lit.food === 16 && lit.toasts === 1 && lit.days === 2,
    `a two-day camp with three looks still lights the candle (food ${lit.food}, days ${lit.days})`);
  ok(lit.lines && !/whole year|\ba year\b/i.test(lit.lines),
    `the payout log does not claim a year on a two-day camp (got ${JSON.stringify(lit.lines.slice(0, 240))})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

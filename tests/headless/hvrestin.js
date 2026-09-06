/* HV-141 — the crash course said rest brings health, and never
 * named morale.
 *
 * The Rest tooltip already says health and morale. finishAction
 * pays both. The opening panel lists rest as health only.
 *
 *  A. The crash course exists and names rest.
 *  B. THE LIE: the rest line must also name morale.
 *     On main this fails — it says "rest (health)."
 *  C. Rest still pays health and morale. We did not touch the action.
 *  Z. Zero page errors.
 *
 * Hook-free. Distinct from #741 (the rest log omitted morale) and
 * #784 (intro said rain closes the corner).
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
    if (!sessionStorage.getItem('hvrestin-init')) {
      sessionStorage.setItem('hvrestin-init', '1');
      localStorage.removeItem('hv-intro-seen');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const copy = await page.$eval('#intro-body', el => el.innerText.replace(/\s+/g, ' ')).catch(() => '');
  const tip = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'rest');
    return a && a.tooltip;
  });
  ok(/rest/i.test(copy),
    `the crash course names rest (got ${JSON.stringify(copy.slice(0, 180))})`);
  ok(/morale/i.test(tip || ''),
    `the Rest tip already names morale (got ${JSON.stringify(tip)})`);

  ok(/rest[\s\S]{0,48}morale|morale[\s\S]{0,48}rest/i.test(copy),
    `the crash course rest line also names morale (got ${JSON.stringify(copy)})`);

  const paid = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0;
    G.health = 50;
    G.morale = 40;
    finishAction({ id: 'rest' });
    Math.random = real;
    return { health: G.health, morale: G.morale };
  });
  ok(paid.health > 50 && paid.morale > 40,
    `Rest still pays health and morale (${paid.health}, ${paid.morale})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

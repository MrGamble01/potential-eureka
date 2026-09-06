/* HV-124 — Street light said thieves take half as much at night.
 *
 * The petition promises: "Thieves take half as much at night."
 * Theft is a dawn card. tickDay wraps timeOfDay past 1, then
 * onNewDay → maybeEvent. There is no night-phase raid. The half
 * applies to that dawn card, the same way with or without a night.
 *
 *  A. The street light row exists, costs 20, and still promises half.
 *  B. THE LIE: the desc must not claim the half is a night-only perk.
 *     On main this fails — the sentence ends "at night."
 *  C. The half still applies to a dawn raid (timeOfDay = 0), pinned
 *     the same way hvpetition G does. Distinct from #752 (Trade after
 *     theft) and #798 (garage nights vs theft).
 *  D. The Theft card is still the night raid — we did not rewrite it.
 *  Z. Zero page errors.
 *
 * Hook-free. Reads PETITIONS / EVENTS_BAD and drives ev.effect.
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
    if (!sessionStorage.getItem('hvstreet-init')) {
      sessionStorage.setItem('hvstreet-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // A — the row and the half
  const row = await page.evaluate(() => {
    const p = PETITIONS.find(x => x.id === 'streetlight');
    return { id: p && p.id, cost: p && p.cost, desc: p && p.desc };
  });
  ok(row.id === 'streetlight' && row.cost === 20 && /half/i.test(row.desc || ''),
    `the street light costs 20 and still promises half (got ${JSON.stringify(row)})`);

  // B — the clock word. The raid is a dawn card. "at night" is the lie.
  ok(row.desc && !/at night/i.test(row.desc),
    `the street light does not claim the half is a night-only perk (got ${JSON.stringify(row.desc)})`);

  // C — dawn raid, timeOfDay just wrapped. Half still applies.
  const dawn = await page.evaluate(() => {
    G.timeOfDay = 0;
    G.rep = 50;
    G.goodwill = 20;
    G.petitions = {};
    doPetition('streetlight');
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    G.dog = 0;
    G.structures.stash = false;
    G.cans = 100; G.food = 100; G.scraps = 100; G.morale = 80;
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    return {
      tod: G.timeOfDay,
      won: !!G.petitions.streetlight,
      cans: G.cans, food: G.food, scraps: G.scraps,
    };
  });
  ok(dawn.tod === 0 && dawn.won,
    `the raid under test is a dawn card (timeOfDay ${dawn.tod}, light ${dawn.won})`);
  ok(dawn.cans === 82 && dawn.food === 85 && dawn.scraps === 90,
    `under the light, the dawn raid takes exactly half (${dawn.cans}/${dawn.food}/${dawn.scraps})`);

  // D — the Theft card keeps its night flavor. We only fixed the petition.
  const card = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    return { title: ev && ev.title, desc: ev && ev.desc };
  });
  ok(card && card.title === 'Theft' && /night/i.test(card.desc || ''),
    `the Theft card is still the night raid (got ${JSON.stringify(card)})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

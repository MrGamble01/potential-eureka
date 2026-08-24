/* HV-18 — the Cold Snap (one-shot, classic-script globals).
 * A. Fresh camp: no snap, none weathered; the goal is on the ladder;
 *    the numbers read 2 days / +10 warmth / 25%.
 * B. The roll: spring dawns never snap; a winter dawn with a high
 *    pinned roll stays quiet; a low pinned roll grips the block for
 *    exactly two days.
 * C. The fire drains exactly SNAP_WARMTH harder at a snap dawn than
 *    at a matched quiet dawn.
 * D. A Respected camp is rallied: +2 goodwill per snap dawn.
 * E. Foot traffic thins: the same pinned panhandle roll that pays on
 *    a quiet day fails inside a snap.
 * F. The snap breaks: +4 morale, the tally counts, the sky clears.
 * G. The snap and tally ride the save; legacy saves migrate clean.
 * Z. Zero page errors.
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
    if (!sessionStorage.getItem('hvsnap-init')) {
      sessionStorage.setItem('hvsnap-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => ({
    active: snapActive(), survived: G.snapsSurvived || 0,
    consts: [SNAP_DAYS, SNAP_WARMTH, SNAP_CHANCE].join(','),
    goal: GOALS.some(g => g.id === 'snap2'),
  }));
  ok(!fresh.active && fresh.survived === 0, 'fresh camp: no snap, none weathered');
  ok(fresh.consts === '2,10,0.25' && fresh.goal, 'the numbers read 2 days / +10 warmth / 25%; the goal is on the ladder');

  // B — the roll
  const rolled = await t(() => {
    const real = Math.random;
    G.season = 1; G.days = 30;
    Math.random = () => 0.01;
    snapAtDawn();
    const spring = snapActive();
    G.season = 3;
    Math.random = () => 0.99;
    snapAtDawn();
    const quiet = snapActive();
    Math.random = () => 0.01;
    snapAtDawn();
    Math.random = real;
    return { spring, quiet, active: snapActive(), until: G.snapUntil, days: G.days };
  });
  ok(!rolled.spring && !rolled.quiet, 'spring dawns never snap; a high winter roll stays quiet');
  ok(rolled.active && rolled.until === rolled.days + 2, 'a low winter roll grips the block for exactly two days');

  // C — the harder drain (two matched dawns, snap on vs off)
  const drained = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;                 // freeze every side roll
    G.population = 1; G.food = 50; G.dog = 0; G.structures.tent = false;
    G.rep = 0; G.snapUntil = G.days + 99;    // snap on
    G.warmth = 90;
    onNewDay();
    const lossSnap = 90 - G.warmth;
    G.snapUntil = null;                      // snap off (same weather rolls)
    G.warmth = 90;
    onNewDay();
    const lossQuiet = 90 - G.warmth;
    Math.random = real;
    return { lossSnap, lossQuiet, diff: lossSnap - lossQuiet };
  });
  ok(drained.diff === 10, `a snap dawn drains exactly +10 warmth (${drained.lossSnap} vs ${drained.lossQuiet})`);

  // D — the block rallies
  const rally = await t(() => {
    G.rep = 60;                              // Respected (tier 2)
    G.snapUntil = G.days + 5;
    G.goodwill = 10;
    snapAtDawn();
    return { gw: G.goodwill, tier: repTier() };
  });
  ok(rally.tier === 2 && rally.gw === 12, 'a Respected camp is rallied: +2 goodwill at a snap dawn');

  // E — thin foot traffic
  const thin = await t(() => {
    const real = Math.random;
    G.rep = 0; G.dog = 0; G.mural = 0; G.weather = 'clear';
    G.goodwill = 0;
    Math.random = () => 0.5;                 // pays on a quiet day (.5 < .55), fails cut to .4125
    finishAction({ id: 'panhandle' });
    const inSnap = G.goodwill;
    G.snapUntil = null;
    finishAction({ id: 'panhandle' });
    Math.random = real;
    return { inSnap, after: G.goodwill };
  });
  ok(thin.inSnap === 0 && thin.after > 0, 'the same roll that pays on a quiet day fails inside a snap');

  // F — the break
  const broke = await t(() => {
    G.snapUntil = G.days;                    // expired
    G.morale = 50;
    snapAtDawn();
    return { until: G.snapUntil, survived: G.snapsSurvived, morale: G.morale };
  });
  ok(broke.until === null && broke.survived === 1 && broke.morale === 54,
    'the snap breaks: +4 morale and the tally counts');

  // G — persistence + legacy migration
  await t(() => { G.snapUntil = G.days + 2; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ active: snapActive(), survived: G.snapsSurvived }));
  ok(back.active && back.survived === 1, 'a gripping snap and the tally ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.snapUntil; delete sv.snapsSurvived;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ active: snapActive(), until: G.snapUntil, survived: G.snapsSurvived }));
  ok(!legacy.active && legacy.until === null && legacy.survived === 0, 'pre-HV-18 saves migrate clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

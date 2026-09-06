/* HV-53 — the Dry Corner: the first link under the bridge that asks
 * for something back (classic-script page, no hook).
 * A. Constants hv-drycorner/12🧱+8📦 paying 12+1; the goal stands;
 *    two names do not open the corner.
 * B. Three names offer it — the button appears, and reads as a build.
 * C. Short of materials the corner stays open to the sky and takes
 *    nothing.
 * D. THE SEAM: paid, it debits exactly 12 scraps and 8 cardboard,
 *    and the same button becomes the sitting.
 * E. The sitting pays once a session, tallies separately from the
 *    build, and cannot buy the roof twice.
 * F. The dish scales with names, cap 5; two sittings complete dry2.
 * G. The roof survives a reload — so does the once-a-session latch, since
 *    it now rides G like every other daily action; only a new dawn clears
 *    it (HV-57 — it used to be a bare in-memory flag: permanently stuck
 *    "already done" for the rest of the tab, and wiped for free by any
 *    reload).
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
    // addInitScript re-runs on reload; the persistence assertion below
    // depends on what the first pass wrote surviving it.
    if (!sessionStorage.getItem('hvdry-init')) {
      sessionStorage.setItem('hvdry-init', '1');
      localStorage.removeItem('hv-mark');
      localStorage.removeItem('hv-drycorner');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the corner is not on offer yet
  const bare = await t(() => {
    saveHvMark({ names: 2 });
    saveHvDry({ built: false, sits: 0 });
    G.dryDay = -1;
    G.scraps = 40; G.cardboard = 40; G.food = 10;
    buildActionUI();
    finishAction({ id: 'dry' });
    return { key: HVDRY_KEY, scr: HVDRY_SCRAPS, card: HVDRY_CARD,
      base: HVDRY_BASE, per: HVDRY_PER,
      goal: GOALS.some(g => g.id === 'dry2'),
      offered: dryOffered(), built: dryBuilt(),
      btn: !!document.getElementById('action-dry'),
      s: G.scraps, c: G.cardboard, food: G.food, sits: loadHvDry().sits };
  });
  ok(bare.key === 'hv-drycorner' && bare.scr === 12 && bare.card === 8
     && bare.base === 12 && bare.per === 1 && bare.goal,
    'hv-drycorner at 12🧱 + 8📦, paying 12+1 — the dry2 goal stands');
  ok(!bare.offered && !bare.btn && !bare.built
     && bare.s === 40 && bare.c === 40 && bare.food === 10 && bare.sits === 0,
    'two names in two hands do not open the corner — no button, nothing spent');

  // B — the third name puts it on offer, as a build
  const offer = await t(() => {
    saveHvMark({ names: 3 });
    buildActionUI();
    const b = document.getElementById('action-dry');
    return { offered: dryOffered(), built: dryBuilt(), btn: !!b,
      label: b ? b.textContent.trim() : '', dish: dryDish() };
  });
  ok(offer.offered && offer.btn && !offer.built,
    'the third name in a third hand offers the corner — the button appears');
  ok(/Roof the Dry Corner/.test(offer.label) && /12/.test(offer.label) && /8/.test(offer.label),
    `unbuilt, the button is the build and names its price (${offer.label})`);

  // C — short of materials
  const short = await t(() => {
    G.scraps = 11; G.cardboard = 40;
    finishAction({ id: 'dry' });
    const a = { s: G.scraps, c: G.cardboard, built: dryBuilt() };
    G.scraps = 40; G.cardboard = 7;
    finishAction({ id: 'dry' });
    return { a, b: { s: G.scraps, c: G.cardboard, built: dryBuilt() } };
  });
  ok(!short.a.built && short.a.s === 11 && short.a.c === 40,
    'a scrap short, the corner stays open to the sky and takes nothing');
  ok(!short.b.built && short.b.s === 40 && short.b.c === 7,
    'a sheet of cardboard short, likewise — no partial charge');

  // D — the seam
  const built = await t(() => {
    G.scraps = 30; G.cardboard = 20; G.food = 10;
    finishAction({ id: 'dry' });
    const b = document.getElementById('action-dry');
    return { s: G.scraps, c: G.cardboard, food: G.food,
      built: dryBuilt(), sits: loadHvDry().sits, sat: (G.dryDay===G.days),
      label: b ? b.textContent.trim() : '' };
  });
  ok(built.built && built.s === 18 && built.c === 12,
    `paid for, it debits exactly 12🧱 and 8📦 (30→${built.s}, 20→${built.c})`);
  ok(built.food === 10 && built.sits === 0 && !built.sat,
    'roofing the corner is not sitting in it — no food, tally still zero');
  ok(/Sit in the Dry Corner/.test(built.label),
    `roofed, the same button becomes the sitting (${built.label})`);

  // E — the sitting
  const sat = await t(() => {
    G.food = 10;
    finishAction({ id: 'dry' });
    const f1 = G.food, s1 = loadHvDry().sits;
    finishAction({ id: 'dry' });
    return { f1, s1, f2: G.food, s2: loadHvDry().sits,
      scraps: G.scraps, card: G.cardboard };
  });
  ok(sat.f1 === 25 && sat.s1 === 1,
    `the first sitting pays 12 + 1 per name, three names up (10 → ${sat.f1})`);
  ok(sat.f2 === sat.f1 && sat.s2 === 1,
    'a second sitting the same session pays nothing and adds nothing');
  ok(sat.scraps === 18 && sat.card === 12,
    'and the roof is never charged for again');

  // F — the dish scales, and the goal completes
  const scale = await t(() => {
    saveHvMark({ names: 3 }); const d3 = dryDish();
    saveHvMark({ names: 9 }); const dCap = dryDish();
    saveHvMark({ names: 3 });
    saveHvDry({ built: true, sits: 2 });
    const g = GOALS.find(x => x.id === 'dry2');
    return { d3, dCap, val: g.value(), target: g.target };
  });
  ok(scale.d3 === 15 && scale.dCap === 17,
    `the dish scales with names on the wall, capped at 5 (${scale.d3}, ${scale.dCap})`);
  ok(scale.val >= scale.target,
    'two sittings complete the dry2 goal');

  // G — persistence
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const after = await t(() => ({
    built: dryBuilt(), sits: loadHvDry().sits, sat: (G.dryDay===G.days),
    offered: dryOffered(), btn: !!document.getElementById('action-dry'),
  }));
  ok(after.built && after.sits === 2 && after.offered && after.btn,
    'the roof and the tally survive a reload');
  ok(after.sat,
    'the once-a-session latch survives a reload too — no free replay from an F5');

  // H — only a new dawn clears the latch
  const nextDay = await t(() => {
    G.days += 1;
    G.food = 10;
    finishAction({ id: 'dry' });
    return { sits: loadHvDry().sits, food: G.food };
  });
  ok(nextDay.sits === 3 && nextDay.food > 10,
    'a new dawn clears the latch — the sit pays out again');

  ok(errs.length === 0, `no page errors (${errs.length ? errs[0] : 'clean'})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

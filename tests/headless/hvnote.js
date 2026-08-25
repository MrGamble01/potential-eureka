/* HV-33 — the Note in the Fridge Door (classic-script page, no hook).
 * A. Constants hv-letter/2; the letters2 goal stands; nothing read
 *    (the boot camp had no history).
 * B. A bridge with no history gets no note — morale untouched.
 * C. The note cites the fridge's camps and the bridge's longest hold
 *    by their real numbers.
 * D. A find reads the note: the tally ticks, morale lifts exactly 2.
 * E. THE SEAM: a genuinely fresh camp (Start Over, keys kept) finds
 *    the note on its own at the once-per-camp boundary.
 * F. Two notes complete the letters2 goal.
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
    if (!sessionStorage.getItem('hvnote-init')) {
      sessionStorage.setItem('hvnote-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: HVNOTE_KEY, morale: HVNOTE_MORALE,
    goal: GOALS.some(g => g.id === 'letters2'),
    n: loadHvNote(),
  }));
  ok(fresh.key === 'hv-letter' && fresh.morale === 2 && fresh.goal,
    'hv-letter at +2 morale a note — the letters2 goal stands');
  ok(fresh.n.read === 0, 'nothing read — the boot camp had no history');

  // B — no history, no note
  const bare = await t(() => {
    G.morale = 50;
    deliverHvNote();
    return { n: loadHvNote(), morale: G.morale };
  });
  ok(bare.n.read === 0 && bare.morale === 50, 'a bridge with no history gets no note');

  // C — the citation
  const cited = await t(() => {
    saveFridge({ built: true, camps: 3 });
    saveHvRec({ days: 14, beats: 1 });
    return composeHvNote();
  });
  ok(cited.includes('Camp #3') && cited.includes('14 dawns'),
    'the note cites the fridge and the long memory by their real numbers');

  // D — the find
  const found = await t(() => {
    G.morale = 50;
    deliverHvNote();
    return { n: loadHvNote(), morale: G.morale };
  });
  ok(found.n.read === 1 && found.morale === 52,
    'a find reads the note — the tally ticks, morale lifts exactly 2');

  // E — the seam at a genuinely fresh camp
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('homeless_village_v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const seam = await t(() => ({ n: loadHvNote(), camps: loadFridge().camps }));
  ok(seam.n.read === 2 && seam.camps === 4,
    'a genuinely fresh camp finds the note on its own');

  // F — the goal
  const goal = await t(() => {
    const g = GOALS.find(x => x.id === 'letters2');
    return { v: g.value(), target: g.target };
  });
  ok(goal.v === 2 && goal.v >= goal.target, 'two notes complete the letters2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

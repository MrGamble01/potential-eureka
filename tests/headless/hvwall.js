/* HV-34 — the Writing on the Wall (classic-script page, no hook).
 * A. Constants hv-history; the 🧱 action row and the wall2 goal
 *    stand; nothing read.
 * B. A bare bridge refuses — the wall has no story yet.
 * C. The chalked lines cite every store by its real number.
 * D. A reading ticks the tally; twice ticks twice.
 * E. Two readings complete the wall2 goal; the tally survives Start
 *    Over in its own key.
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
    if (!sessionStorage.getItem('hvwall-init')) {
      sessionStorage.setItem('hvwall-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-history');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: HVWALL_KEY,
    row: ACTIONS.some(a => a.id === 'wall'),
    goal: GOALS.some(g => g.id === 'wall2'),
    w: loadHvWall(),
  }));
  ok(fresh.key === 'hv-history' && fresh.row && fresh.goal,
    'hv-history — the 🧱 action row and the wall2 goal stand');
  ok(fresh.w.opens === 0, 'nothing read');

  // B — the bare bridge
  const bare = await t(() => {
    finishAction({ id: 'wall' });
    return loadHvWall();
  });
  ok(bare.opens === 0, 'a bare bridge refuses — the wall has no story yet');

  // C — the citation
  const cited = await t(() => {
    saveFridge({ built: true, camps: 3 });
    saveHvRec({ days: 14, beats: 2 });
    saveHvNote({ read: 2 });
    return composeHvWall().join(' | ');
  });
  ok(cited.includes('3 camps') && cited.includes('14 dawns')
    && cited.includes('2 mornings') && cited.includes('2 notes'),
    'the chalked lines cite every store by its real number');

  // D — the reading
  const read = await t(() => {
    finishAction({ id: 'wall' });
    const one = loadHvWall().opens;
    finishAction({ id: 'wall' });
    return { one, two: loadHvWall().opens };
  });
  ok(read.one === 1 && read.two === 2, 'a reading ticks the tally — twice ticks twice');

  // E — the goal + Start Over survival
  const goal = await t(() => {
    const g = GOALS.find(x => x.id === 'wall2');
    return { v: g.value(), target: g.target };
  });
  ok(goal.v === 2 && goal.v >= goal.target, 'two readings complete the wall2 goal');
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('homeless_village_v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => loadHvWall());
  ok(back.opens === 2, 'the tally survives Start Over in its own key');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

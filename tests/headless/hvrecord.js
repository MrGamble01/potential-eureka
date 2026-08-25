/* HV-32 — the Long Memory (classic-script page, no hook needed).
 * A. Constants hv-record/3; the record2 goal stands; the dawn seam
 *    reports; no memory yet.
 * B. The first dawns open the memory silently — no morale moved.
 * C. Later dawns climb it silently within the session.
 * D. THE MORNING: a fresh session (re-armed mark) outlasting the
 *    standing mark pays +3 morale once — and only once.
 * E. Two beaten mornings complete the record2 goal; the memory
 *    survives Start Over in its own key.
 * F. A bridge with no memory pays nothing — the first dawn opens it.
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
    if (!sessionStorage.getItem('hvrecord-init')) {
      sessionStorage.setItem('hvrecord-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: HVREC_KEY, morale: HVREC_MORALE,
    goal: GOALS.some(g => g.id === 'record2'),
    seam: onNewDay.toString().includes('recordDays'),
    r: loadHvRec(),
  }));
  ok(fresh.key === 'hv-record' && fresh.morale === 3 && fresh.goal && fresh.seam,
    'hv-record at +3 morale a morning — the record2 goal stands, the dawn seam reports');
  ok(fresh.r.days === 0 && fresh.r.beats === 0, 'no memory yet');

  // B — the virgin memory
  const first = await t(() => {
    const m0 = G.morale;
    recordDays(5);
    return { r: loadHvRec(), rung: hvRecRung, moved: G.morale !== m0 };
  });
  ok(first.r.days === 5 && first.r.beats === 0 && !first.rung && !first.moved,
    'the first dawns open the memory silently — no morale moved');

  // C — silent climb
  const grown = await t(() => {
    const m0 = G.morale;
    recordDays(8);
    return { r: loadHvRec(), rung: hvRecRung, moved: G.morale !== m0 };
  });
  ok(grown.r.days === 8 && grown.r.beats === 0 && !grown.rung && !grown.moved,
    'later dawns climb it silently within the session');

  // D — the morning on a fresh session (atomic)
  const morning = await t(() => {
    hvRecMark = null; hvRecRung = false;
    recordDays(3);           // arms the mark below it — quiet
    const armedQuiet = !hvRecRung, mark = hvRecMark;
    G.morale = 50;
    recordDays(mark + 1);
    const one = { r: loadHvRec(), rung: hvRecRung, morale: G.morale };
    recordDays(mark + 4);
    return { armedQuiet, mark, one, again: loadHvRec().beats, morale2: G.morale };
  });
  ok(morning.armedQuiet && morning.mark === 8 && morning.one.rung
    && morning.one.r.days === 9 && morning.one.r.beats === 1 && morning.one.morale === 53,
    'outlasting the standing mark pays +3 morale — once');
  ok(morning.again === 1 && morning.morale2 === 53,
    'a longer hold the same session stays quiet — the memory still climbs');

  // E — the goal + Start Over survival
  const goal = await t(() => {
    saveHvRec({ days: 12, beats: 2 });
    const g = GOALS.find(x => x.id === 'record2');
    return { v: g.value(), target: g.target };
  });
  ok(goal.v === 2 && goal.v >= goal.target, 'two beaten mornings complete the record2 goal');
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('homeless_village_v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ r: loadHvRec(), days: G.days }));
  ok(back.r.days === 12 && back.r.beats === 2 && back.days === 0,
    'the memory survives Start Over in its own key — the camp does not');

  // F — the bare bridge
  const bare = await t(() => {
    localStorage.removeItem('hv-record');
    hvRecMark = null; hvRecRung = false;
    const m0 = G.morale;
    recordDays(1);
    return { r: loadHvRec(), rung: hvRecRung, moved: G.morale !== m0 };
  });
  ok(bare.r.days === 1 && bare.r.beats === 0 && !bare.rung && !bare.moved,
    'a bridge with no memory pays nothing — the first dawn just opens it');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/* HV-19 — the Busker's Guitar (one-shot, classic-script globals).
 * A. Fresh camp: no guitar, no button; the Scrap Guitar recipe is on
 *    the workbench (8🧱 + 4🪵); the goal is on the ladder.
 * B. The take rides the spirits: 1 + morale/25, doubled on a
 *    scorcher — checked across four exact points.
 * C. With the guitar built the button appears; a set pays the exact
 *    take, +1 rep, +2 morale, marks the day.
 * D. A second set the same day is refused; dawn reopens the corner.
 * E. The tally, the day guard and the guitar ride the save; legacy
 *    saves migrate clean.
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
    if (!sessionStorage.getItem('hvbusk-init')) {
      sessionStorage.setItem('hvbusk-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'guitar');
    return { guitar: !!G.structures.guitar, btn: !!document.getElementById('action-busk'),
      recipe: r ? { s: r.cost.scraps, w: r.cost.wood, req: r.requires, gives: r.gives.structure } : null,
      goal: GOALS.some(g => g.id === 'busk5') };
  });
  ok(!fresh.guitar && !fresh.btn, 'fresh camp: no guitar, no corner set');
  ok(fresh.recipe && fresh.recipe.s === 8 && fresh.recipe.w === 4
    && fresh.recipe.req === 'workbench' && fresh.recipe.gives === 'guitar' && fresh.goal,
    'the Scrap Guitar recipe is on the workbench (8🧱 + 4🪵); the goal is on the ladder');

  // B — the pay table
  const pay = await t(() => {
    const at = (m, w) => { G.morale = m; G.weather = w; return buskPay(); };
    return [at(0, 'clear'), at(50, 'clear'), at(100, 'clear'), at(50, 'heat')].join(',');
  });
  ok(pay === '1,3,5,6', 'the take rides the spirits: 1/3/5, doubled to 6 on a scorcher');

  // C — the set
  const played = await t(() => {
    G.structures.guitar = true;
    buildActionUI();
    const btn = !!document.getElementById('action-busk');
    G.morale = 50; G.weather = 'clear'; G.goodwill = 0;
    const rep0 = G.rep || 0;
    finishAction(buskAction());
    return { btn, gw: G.goodwill, rep: (G.rep || 0) - rep0, morale: G.morale,
      busks: G.busks, day: G.buskDay === G.days };
  });
  ok(played.btn, 'with the guitar built the button appears');
  ok(played.gw === 3 && played.rep === 1 && played.morale === 52 && played.busks === 1 && played.day,
    'a set pays the exact take (+3🩶), +1 rep, +2 morale');

  // D — one set a day
  const rested = await t(() => {
    doAction(buskAction());            // guard refuses at the door
    const same = G.busks;
    G.days += 1;
    finishAction(buskAction());        // dawn reopens the corner
    return { same, next: G.busks };
  });
  ok(rested.same === 1 && rested.next === 2, 'one set a day; dawn reopens the corner');

  // E — persistence + legacy migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ busks: G.busks, guitar: !!G.structures.guitar,
    done: buskDone(), btn: !!document.getElementById('action-busk') }));
  ok(back.busks === 2 && back.guitar && back.done && back.btn,
    'the tally, the day guard and the guitar ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.busks; delete sv.buskDay; delete sv.structures.guitar;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ busks: G.busks, day: G.buskDay, guitar: G.structures.guitar }));
  ok(legacy.busks === 0 && legacy.day === -9 && legacy.guitar === false, 'pre-HV-19 saves migrate clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/* HV-24 — the Tool Box (one-shot, classic-script globals).
 * A. The 🧰 recipe on the bench (scraps 6 + cans 2), the goal on the
 *    ladder, the bonus reads +2, no box yet.
 * B. The wobble roll: pinned low, an unkept workbench falls apart at
 *    dawn; with the tool box it's tightened back up and the tally
 *    ticks.
 * C. A quiet dawn (high roll) touches nothing — no wobble, no tick.
 * D. The odd job: exactly +2 extra goodwill with the box, none
 *    without, on the same posting.
 * E. The box and the tally ride the save; a legacy save migrates.
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
    if (!sessionStorage.getItem('hvtoolbox-init')) {
      sessionStorage.setItem('hvtoolbox-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'toolbox');
    return { rec: r ? { s: r.cost.scraps, c: r.cost.cans, req: r.requires } : null,
      goal: GOALS.some(g => g.id === 'bench5'),
      bonus: TOOLBOX_JOB_BONUS, built: !!G.structures.toolbox };
  });
  ok(fresh.rec && fresh.rec.s === 6 && fresh.rec.c === 2 && fresh.rec.req === 'workbench',
    'the 🧰 Tool Box is on the bench — scraps 6 + cans 2');
  ok(fresh.goal && fresh.bonus === 2 && !fresh.built, 'the goal is on the ladder; the bonus reads +2');

  // B — the wobble, kept vs unkept
  const wobbled = await t(() => {
    const real = Math.random;
    Math.random = () => 0.035;               // under the 4% wobble
    G.population = 1; G.food = 50; G.dog = 0; G.structures.tent = false;
    G.structures.garden = false; G.workers.scrapper = null; G.workers.cook = null;
    G.rep = 0; G.snapUntil = null; G.forecast = 'clear'; G.days = 1;
    G.structures.workbench = true; G.structures.toolbox = false; G.benchSaves = 0;
    G.lastEventDay = G.days + 5;             // hold the event roll out of the frame
    onNewDay();
    const bare = { bench: G.structures.workbench, saves: G.benchSaves };
    G.structures.workbench = true; G.structures.toolbox = true;
    G.forecast = 'clear'; G.lastEventDay = G.days + 5;
    onNewDay();
    const kept = { bench: G.structures.workbench, saves: G.benchSaves };
    Math.random = real;
    return { bare, kept };
  });
  ok(!wobbled.bare.bench && wobbled.bare.saves === 0,
    'unkept, the wobble takes the workbench down');
  ok(wobbled.kept.bench && wobbled.kept.saves === 1,
    'the tool box tightens the wobble back up and the tally ticks');

  // C — a quiet dawn
  const quiet = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.workbench = true; G.structures.toolbox = true; G.benchSaves = 0;
    G.forecast = 'clear'; G.lastEventDay = G.days + 5;
    onNewDay();
    Math.random = real;
    return { bench: G.structures.workbench, saves: G.benchSaves };
  });
  ok(quiet.bench && quiet.saves === 0, 'a quiet dawn touches nothing — no wobble, no tick');

  // D — the odd job pays extra with the right tools
  const jobbed = await t(() => {
    G.structures.toolbox = false;
    G.oddJobDay = -1; G.goodwill = 0; G.morale = 50;
    const j = todaysJob();
    finishAction(oddJobAction());
    const base = { gw: G.goodwill, job: j.id };
    G.structures.toolbox = true;
    G.oddJobDay = -1; G.goodwill = 0; G.morale = 50;
    finishAction(oddJobAction());
    return { base, boxed: G.goodwill, expectBase: (j.gives.goodwill || 0) };
  });
  ok(jobbed.base.gw === jobbed.expectBase && jobbed.boxed === jobbed.expectBase + 2,
    `the same posting pays +2 extra goodwill with the box (${jobbed.base.gw} vs ${jobbed.boxed})`);

  // E — persistence
  await t(() => { G.benchSaves = 3; G.structures.toolbox = true; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ saves: G.benchSaves, built: G.structures.toolbox }));
  ok(back.saves === 3 && back.built, 'the box and the tally ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.benchSaves; delete sv.structures.toolbox;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ saves: G.benchSaves, built: G.structures.toolbox }));
  ok(legacy.saves === 0 && legacy.built === false, 'a pre-HV-24 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

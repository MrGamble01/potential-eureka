/*
 * HV-11 — the Underpass Mural (re-runnable: classic scripts, globals
 * reachable, save cleared on boot).
 *  A. Fresh camp: mural 0, no session button below Known, goal on the ladder.
 *  B. Known (rep 30): button appears; a session costs 2 scraps, paints a
 *     panel, pays +3 morale +2 rep and stamps muralDay.
 *  C. A second session the same day is refused (doAction and finishAction).
 *  D. Three more days finish the wall: +5 goodwill, 4 pillar meshes, the
 *     button retires from the action list.
 *  E. Dawn: the finished mural pays a deterministic +2 morale.
 *  F. Sweep: morale loss softened by 5; the mural itself survives.
 *  G. Panhandle: the finished mural widens the success window ×1.1.
 *  H. Reload keeps the mural; a pre-HV-11 save migrates to 0/-1.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvmural-init')) {
      sessionStorage.setItem('hvmural-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // A. fresh camp: no mural, no button (rep 0 < Known), goal on the ladder
  const fresh = await t(() => ({ mural: G.mural, day: G.muralDay,
    btn: !!document.getElementById('action-mural'),
    hasGoal: GOALS.some(g => g.id === 'mural') }));
  ok(fresh.mural === 0 && fresh.day === -1 && !fresh.btn, 'fresh camp: no mural, no session button');
  ok(fresh.hasGoal, 'the mural goal is on the ladder');

  // B. Known: the button appears, and one session pays out exactly
  const first = await t(() => {
    G.rep = 30; G.days = 1; G.dog = 1; G.dogMetDay = 99;   // park the dog arc
    G.goalIndex = GOALS.length;   // park the ladder: survive-goal payouts would skew the exact goodwill math
    buildActionUI();
    const btnShown = !!document.getElementById('action-mural');
    G.scraps = 10; G.morale = 50;
    finishAction(muralAction());
    return { btnShown, scraps: G.scraps, mural: G.mural, muralDay: G.muralDay,
      morale: G.morale, rep: G.rep,
      msg: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  });
  ok(first.btnShown, 'Known unlocks the session button');
  ok(first.scraps === 8 && first.mural === 1 && first.muralDay === 1,
    `a session costs 2 scraps and paints panel 1 (scraps ${first.scraps}, mural ${first.mural})`);
  ok(first.morale === 53 && first.rep === 32, `+3 morale, +2 rep (${first.morale}, ${first.rep})`);
  ok(first.msg.includes('first panel'), 'the stage line narrates the panel');

  // C. same-day repeat refused on both gates
  const repeat = await t(() => {
    doAction(muralAction());            // gated in doAction
    finishAction(muralAction());        // and re-checked in finishAction
    return { scraps: G.scraps, mural: G.mural, job: !!activeJobs['mural'] };
  });
  ok(repeat.scraps === 8 && repeat.mural === 1 && !repeat.job, 'one session a day — the second is refused');

  // D. three more days finish the wall
  const done = await t(() => {
    const gw0 = G.goodwill;
    G.days = 2; finishAction(muralAction());
    G.days = 3; finishAction(muralAction());
    G.days = 4; finishAction(muralAction());
    return { mural: G.mural, scraps: G.scraps, gw: G.goodwill - gw0,
      meshes: muralMeshes.length, btn: !!document.getElementById('action-mural'),
      msg: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  });
  ok(done.mural === 4 && done.scraps === 2, `four sessions finish the wall (mural ${done.mural}, scraps ${done.scraps})`);
  ok(done.gw === 5 && done.msg.includes('mural is finished'), `completion pays +5 goodwill (${done.gw})`);
  ok(done.meshes === 4, `four pillar panels stand in the scene (${done.meshes})`);
  ok(!done.btn, 'the session button retires once the wall is done');

  // E. dawn: deterministic +2 morale from the finished mural
  const dawn = await t(() => {
    const real = Math.random; Math.random = () => 0.99;   // no tears, gifts, events or mural log
    G.lastEventDay = G.days + 5; G.forecast = 'clear';
    // warmth 40 keeps HV-13's warm-dawn bonus out of this leg — the
    // mural's +2 is what's under test here
    G.morale = 50; G.warmth = 40; G.food = 20; G.population = 1; G.rep = 40;
    onNewDay();
    Math.random = real;
    return { morale: G.morale };
  });
  ok(dawn.morale === 49, `dawn: -3 decay +2 mural = 49 (${dawn.morale})`);

  // F. sweep: softened, and the mural survives
  const sweep = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.morale = 50; G.scraps = 20; G.food = 20; G.packedUp = false;
    G.structures.tent = false; G.structures.soup_kitchen = false;
    G.structures.workbench = false; G.structures.garden = false;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { morale: G.morale, scraps: G.scraps, food: G.food, mural: G.mural,
      meshes: muralMeshes.length,
      msg: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  });
  ok(sweep.morale === 35 && sweep.msg.includes('mural still stands'),
    `sweep morale loss softened: 50 - 20 + 5 = 35 (${sweep.morale})`);
  ok(sweep.scraps === 10 && sweep.food === 13, `supply losses unchanged (scraps ${sweep.scraps}, food ${sweep.food})`);
  ok(sweep.mural === 4 && sweep.meshes === 4, 'the paint survives the sweep');

  // G. panhandle: 0.65 roll clears only the mural-widened window
  // (.55 × 1.15 rep = .6325 without; × 1.1 mural = .69575 with)
  const pan = await t(() => {
    const real = Math.random; Math.random = () => 0.65;
    G.weather = 'clear'; G.cooldowns = {}; G.rep = 30; G.dog = 1;
    const gw0 = G.goodwill;
    finishAction(ACTIONS.find(a => a.id === 'panhandle'));
    Math.random = real;
    return { gw: G.goodwill - gw0 };
  });
  ok(pan.gw === 3, `finished mural widens panhandle to .696 — the .65 roll pays +3 (${pan.gw})`);

  // H. persistence + migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const back = await t(() => ({ mural: G.mural, meshes: muralMeshes.length,
    btn: !!document.getElementById('action-mural') }));
  ok(back.mural === 4 && back.meshes === 4 && !back.btn, `reload keeps the finished wall (mural ${back.mural})`);
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.mural; delete s.muralDay;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const legacy = await t(() => ({ mural: G.mural, day: G.muralDay, meshes: muralMeshes.length }));
  ok(legacy.mural === 0 && legacy.day === -1 && legacy.meshes === 0, 'pre-HV-11 save migrates to a bare wall');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

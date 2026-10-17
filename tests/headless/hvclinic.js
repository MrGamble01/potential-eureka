/* Night Clinic — a building, a shelf, a medic, and a need that lasts.
 *
 * A. Recipes, costs, gates, and the five ladder rungs.
 * B. A quiet dawn with the tarp down does not touch care, gauze, or warmth.
 * C. finishCraft raises the tarp, seats June on the sidewalk, and shows Dress.
 * D. A real Gauze Roll click puts two rolls on the shelf.
 * E. Dressing refuses with an empty shelf and does not start a cooldown.
 * F. A real Dress click spends one roll: +8 health, +25 care.
 * G. The third dressing keeps June. Her round pays once, then refuses.
 * H. Dawn: the open tarp drops 8 care; June on shift spends a roll for +4 health.
 * I. Care on the floor costs 6 health. Five steady dawns tick the streak.
 * J. A fourth-day ask can be spared, or it lapses for 12 care.
 * K. A sweep pulls the tarp down and keeps the gauze. Rebuilding does not reset June.
 * L. The five goals pay in order. Low health and empty care paint the pills.
 * M. A legacy save migrates. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 180)));
  await page.addInitScript(() => {
    localStorage.setItem('hv-intro-seen', '1');
    if (!sessionStorage.getItem('hvclinic-init')) {
      sessionStorage.setItem('hvclinic-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof G !== 'undefined' && typeof finishCraft === 'function');
  await page.waitForTimeout(400);
  const t = fn => page.evaluate(fn);

  const fresh = await t(() => {
    const clinic = RECIPES.find(r => r.id === 'clinic');
    const gauze = RECIPES.find(r => r.id === 'gauze');
    const ids = ['clinic1', 'gauze4', 'dress6', 'june1', 'care5'];
    return {
      clinic: clinic && { w: clinic.cost.wood, s: clinic.cost.scraps, c: clinic.cost.cardboard, g: clinic.cost.goodwill, req: clinic.requires },
      gauze: gauze && { s: gauze.cost.scraps, c: gauze.cost.cardboard, n: gauze.gives.bandages, req: gauze.requires },
      goals: ids.every(id => GOALS.some(g => g.id === id)),
      built: !!G.structures.clinic,
      dress: !!document.getElementById('action-dress'),
      pill: document.getElementById('bandage-pill').hidden,
    };
  });
  ok(fresh.clinic && fresh.clinic.w === 7 && fresh.clinic.s === 5 && fresh.clinic.c === 3 && fresh.clinic.g === 4 && fresh.clinic.req === 'workbench',
    'Night Clinic is on the bench — 7 wood, 5 scraps, 3 cardboard, 4 goodwill, after the workbench');
  ok(fresh.gauze && fresh.gauze.s === 2 && fresh.gauze.c === 1 && fresh.gauze.n === 2 && fresh.gauze.req === 'clinic',
    'Gauze Roll is two rolls for 2 scraps and 1 cardboard, and it needs the clinic');
  ok(fresh.goals && !fresh.built && !fresh.dress && fresh.pill,
    'the five goals are on the ladder; a fresh camp has no tarp, no Dress button, and a hidden gauze pill');

  const quiet = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.clinic = false;
    G.care = 60; G.june = 0; G.bandages = 3; G.health = 80; G.morale = 50;
    G.days = 1; G.warmth = 90; G.forecast = 'clear'; G.snapUntil = null;
    G.population = 1; G.food = 50; G.dog = 0;
    G.workers.cook = false; G.workers.scrapper = false;
    G.structures.tent = false; G.structures.garden = false; G.structures.pantry = false;
    G.rep = 0; G.lastEventDay = 99; G.goalIndex = GOALS.length;
    G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false; G.favor = null;
    onNewDay();
    Math.random = real;
    return { care: G.care, bandages: G.bandages, warmth: G.warmth, health: G.health };
  });
  ok(quiet.care === 60 && quiet.bandages === 3 && quiet.warmth === 82 && quiet.health === 80,
    `a dawn with the tarp down leaves care, gauze, warmth and health alone (${quiet.care}/${quiet.bandages}, warmth ${quiet.warmth}, health ${quiet.health})`);

  const raised = await t(() => {
    G.june = 0; G.care = 0; G.structures.clinic = false; G.goalIndex = GOALS.length;
    G.activeCrafts.clinic = { start: Date.now() - 50, duration: 1 };
    finishCraft(RECIPES.find(r => r.id === 'clinic'));
    const row = document.getElementById('clinic-row');
    return {
      built: !!G.structures.clinic, june: G.june, care: G.care,
      mesh: !!clinicMesh, juneMesh: !!juneMesh,
      dress: !!document.getElementById('action-dress'),
      round: !!document.getElementById('action-juneround'),
      name: row ? row.querySelector('.w-name').textContent : '',
      log: Array.from(document.querySelectorAll('.log-line')).map(e => e.textContent).join(' '),
      layout: (function(){
        function inside(el, box, slack){
          if(!el || !box) return false;
          var r = el.getBoundingClientRect();
          return r.width > 8 && r.height > 8 && r.left >= -1 && r.top >= box.top - slack && r.bottom <= box.bottom + slack && r.right <= window.innerWidth + 1;
        }
        var warmth = document.getElementById('warmth-pill').getBoundingClientRect();
        var pill = document.getElementById('bandage-pill');
        var pr = pill.getBoundingClientRect();
        var panel = document.getElementById('workers-panel').getBoundingClientRect();
        return {
          warmthIn: warmth.left >= 0 && warmth.right <= window.innerWidth + 1 && warmth.width > 8,
          pillIn: !pill.hidden && pr.top > window.innerHeight * 0.5 && pr.right <= window.innerWidth + 1 && pr.width > 8,
          rowIn: inside(row, panel, 2),
          dressExists: !!document.getElementById('action-dress'),
          status: row ? row.querySelector('.w-status').textContent : '',
        };
      })(),
    };
  });
  ok(raised.built && raised.june === 1 && raised.care === 60 && raised.mesh && raised.juneMesh && raised.dress && !raised.round,
    `raising the clinic seats June on the sidewalk and unlocks Dress (june=${raised.june}, care=${raised.care})`);
  ok(/June watches from the sidewalk/.test(raised.log) && /June, watching/.test(raised.name),
    `the log and the roster both name June (${raised.name})`);
  ok(raised.layout && raised.layout.warmthIn && raised.layout.pillIn && raised.layout.rowIn && raised.layout.dressExists && /to stay/.test(raised.layout.status),
    `warmth stays on the top bar, care sits on the bottom bar, and June's row is in view (${JSON.stringify(raised.layout)})`);

  await t(() => {
    G.structures.clinic = true; G.structures.workbench = true;
    G.scraps = 5; G.cardboard = 3; G.bandages = 0; G.bandagesRolled = 0;
    G.goalIndex = GOALS.length; G.activeCrafts = {};
    buildCraftUI();
  });
  const gauzeBtn = page.locator('#craft-gauze');
  await gauzeBtn.scrollIntoViewIfNeeded();
  await gauzeBtn.click();
  await page.waitForFunction(() => (G.bandages || 0) === 2, null, { timeout: 8000 });
  const rolled = await t(() => ({
    bandages: G.bandages, rolled: G.bandagesRolled, scraps: G.scraps, card: G.cardboard,
    cost: document.querySelector('#craft-gauze .ci-cost').textContent,
    pill: document.getElementById('bandage-pill').hidden,
    shown: document.getElementById('stat-bandages').textContent,
  }));
  ok(rolled.bandages === 2 && rolled.rolled === 2 && rolled.scraps === 3 && rolled.card === 2,
    `a real Gauze Roll click spends 2 scraps and 1 cardboard and shelves 2 (scraps ${rolled.scraps}, card ${rolled.card})`);
  ok(/2 shelf/.test(rolled.cost) && !rolled.pill && rolled.shown === '2',
    `the craft row and the HUD both show the shelf (${rolled.cost}, pill ${rolled.shown})`);

  const refused = await t(() => {
    G.bandages = 0; G.cooldowns = {}; G.health = 40; G.care = 30; G.goalIndex = GOALS.length;
    updateHUD();
    const disabled = document.getElementById('action-dress').disabled;
    doAction(dressAction());
    return {
      disabled, bandages: G.bandages, health: G.health, care: G.care,
      cd: G.cooldowns.dress || 0, job: !!activeJobs.dress,
      log: document.querySelector('.log-line:last-child').textContent,
    };
  });
  ok(refused.disabled && refused.bandages === 0 && refused.health === 40 && refused.care === 30 && !refused.cd && !refused.job,
    'an empty shelf disables Dress and the click spends nothing and starts nothing');
  ok(/No gauze on the shelf/.test(refused.log), `the refusal names the shelf (${refused.log})`);

  await t(() => {
    G.bandages = 2; G.health = 40; G.care = 30; G.morale = 40; G.dressings = 0;
    G.june = 1; G.cooldowns = {}; G.goalIndex = GOALS.length;
    updateHUD();
  });
  const dressBtn = page.locator('#action-dress');
  await dressBtn.scrollIntoViewIfNeeded();
  await dressBtn.click();
  await page.waitForFunction(() => (G.dressings || 0) === 1, null, { timeout: 8000 });
  const dressed = await t(() => ({
    bandages: G.bandages, health: G.health, care: G.care, morale: G.morale, dressings: G.dressings,
    cd: G.cooldowns.dress > Date.now(),
    log: Array.from(document.querySelectorAll('.log-line')).map(e => e.textContent).join(' '),
  }));
  ok(dressed.bandages === 1 && dressed.health === 48 && dressed.care === 55 && dressed.morale === 42 && dressed.dressings === 1 && dressed.cd,
    `Dress spends one roll for +8 health and +25 care (health ${dressed.health}, care ${dressed.care}, gauze ${dressed.bandages})`);
  ok(/Wound dressed/.test(dressed.log), 'the log names the dressing');

  const stayed = await t(() => {
    G.bandages = 5; G.june = 1; G.dressings = 1; G.structures.clinic = true; G.cooldowns = {};
    G.goalIndex = GOALS.length;
    finishAction(dressAction());
    const mid = G.june;
    finishAction(dressAction());
    buildActionUI();
    return {
      mid, june: G.june, dressings: G.dressings,
      round: !!document.getElementById('action-juneround'),
      name: document.querySelector('#clinic-row .w-name').textContent,
      badge: document.getElementById('pop-val').textContent,
    };
  });
  ok(stayed.mid === 1 && stayed.june === 2 && stayed.dressings === 3 && stayed.round,
    `the third dressing keeps June and puts her round on the rail (june ${stayed.mid}→${stayed.june})`);
  ok(/night shift/.test(stayed.name) && stayed.badge.includes('🩺'),
    `the roster and the headcount both show her on shift (${stayed.name}, ${stayed.badge})`);

  const round = await t(() => {
    G.june = 2; G.structures.clinic = true; G.bandages = 2; G.care = 40; G.goodwill = 0; G.rep = 0;
    G.juneRoundDay = -9; G.days = 6; G.cooldowns = {}; G.goalIndex = GOALS.length;
    finishAction(juneRoundAction());
    const once = { bandages: G.bandages, care: G.care, goodwill: G.goodwill, rep: G.rep, day: G.juneRoundDay };
    G.cooldowns = {};
    doAction(juneRoundAction());
    return { once, bandages: G.bandages, job: !!activeJobs.juneround,
      log: document.querySelector('.log-line:last-child').textContent };
  });
  ok(round.once.bandages === 1 && round.once.care === 50 && round.once.goodwill === 4 && round.once.rep === 1 && round.once.day === 6,
    `June's round spends one roll for +10 care, +4 goodwill, +1 rep (care ${round.once.care})`);
  ok(round.bandages === 1 && !round.job && /already walked/.test(round.log),
    `a second round the same day refuses before the timer (${round.log})`);

  const dawn = await t(() => {
    G.structures.clinic = true; G.clinicAsk = null; G.goalIndex = GOALS.length;
    G.june = 1; G.bandages = 4; G.care = 60; G.health = 70; G.clinicSteady = 0; G.days = 2;
    clinicAtDawn();
    const open = { care: G.care, bandages: G.bandages, health: G.health, steady: G.clinicSteady };
    G.june = 2; G.care = 50; G.bandages = 2; G.health = 70; G.juneRounds = 0; G.days = 3; G.clinicAsk = null;
    clinicAtDawn();
    return { open, shift: { care: G.care, bandages: G.bandages, health: G.health, rounds: G.juneRounds } };
  });
  ok(dawn.open.care === 52 && dawn.open.bandages === 4 && dawn.open.health === 70 && dawn.open.steady === 1,
    `an open tarp drops 8 care and does not spend gauze (${dawn.open.care})`);
  ok(dawn.shift.care === 66 && dawn.shift.bandages === 1 && dawn.shift.health === 74 && dawn.shift.rounds === 1,
    `June on shift spends one roll and gives back 4 health (care ${dawn.shift.care}, health ${dawn.shift.health})`);

  const floor = await t(() => {
    G.june = 1; G.structures.clinic = true; G.bandages = 0; G.care = 4; G.health = 80; G.morale = 50;
    G.clinicSteady = 3; G.clinicAsk = null; G.days = 2; G.goalIndex = GOALS.length;
    clinicAtDawn();
    const neglected = { care: G.care, health: G.health, morale: G.morale, steady: G.clinicSteady };
    G.june = 1; G.dressings = 0; G.care = 80; G.bandages = 0; G.clinicSteady = 0; G.clinicAsk = null; G.days = 2;
    for (let i = 0; i < 5; i++) clinicAtDawn();
    return { neglected, steady: G.clinicSteady, care: G.care };
  });
  ok(floor.neglected.care === 0 && floor.neglected.health === 74 && floor.neglected.morale === 46 && floor.neglected.steady === 0,
    `care on the floor costs 6 health and 4 morale and breaks the streak (health ${floor.neglected.health})`);
  ok(floor.steady === 5 && floor.care === 40,
    `five dawns that stay at 40 or better complete the streak (steady ${floor.steady}, care ${floor.care})`);

  const ask = await t(() => {
    G.structures.clinic = true; G.june = 1; G.days = 4; G.clinicAsk = null;
    G.care = 60; G.bandages = 2; G.goodwill = 0; G.rep = 10; G.goalIndex = GOALS.length;
    clinicAtDawn();
    const posted = !!G.clinicAsk && !!document.getElementById('action-spare');
    finishAction(spareAction());
    const spared = { ask: G.clinicAsk, bandages: G.bandages, goodwill: G.goodwill, rep: G.rep, care: G.care,
      btn: !!document.getElementById('action-spare') };
    G.clinicAsk = { day: 4 }; G.days = 5; G.care = 50; G.june = 1; G.bandages = 2; G.clinicSteady = 2;
    clinicAtDawn();
    return { posted, spared, lapsed: { ask: G.clinicAsk && G.clinicAsk.day, care: G.care, steady: G.clinicSteady } };
  });
  ok(ask.posted && ask.spared.ask === null && ask.spared.bandages === 1 && ask.spared.goodwill === 4 && ask.spared.rep === 12 && ask.spared.care === 60 && !ask.spared.btn,
    `day 4 posts the ask, and sparing a roll pays +4 goodwill, +2 rep, +8 care (care ${ask.spared.care})`);
  ok(ask.lapsed.ask === null && ask.lapsed.care === 30 && ask.lapsed.steady === 0,
    `an ask left overnight costs 12 care on top of the dawn drop and breaks the streak (care ${ask.lapsed.care})`);

  const sweep = await t(() => {
    G.structures.clinic = true; G.june = 2; G.bandages = 3; G.clinicAsk = { day: 1 };
    G.structures.tent = false; G.structures.garden = false; G.structures.radio = false;
    G.structures.pantry = false; G.structures.coats = false; G.structures.guitar = false;
    G.structures.toolbox = false; G.structures.workbench = true; G.structures.stash = false;
    G.food = 0; G.scraps = 0; G.wood = 0; G.cans = 0; G.cardboard = 0;
    G.dog = 0; G.packedUp = false; G.garageCover = false; G.barrelWater = 0; G.grantDay = -1;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    const down = {
      clinic: !!G.structures.clinic, june: G.june, bandages: G.bandages, ask: G.clinicAsk,
      dress: !!document.getElementById('action-dress'),
      log: Array.from(document.querySelectorAll('.log-line')).map(e => e.textContent).join(' '),
    };
    G.june = 2; G.care = 10;
    G.activeCrafts.clinic = { start: Date.now() - 50, duration: 1 };
    finishCraft(RECIPES.find(r => r.id === 'clinic'));
    return { down, back: { clinic: !!G.structures.clinic, june: G.june, care: G.care, round: !!document.getElementById('action-juneround') } };
  });
  ok(!sweep.down.clinic && sweep.down.june === 2 && sweep.down.bandages === 3 && sweep.down.ask === null && !sweep.down.dress,
    'a sweep pulls the tarp down, clears the ask, and leaves June and the gauze');
  ok(/night clinic was pulled down/.test(sweep.down.log), 'the sweep names the clinic');
  ok(sweep.back.clinic && sweep.back.june === 2 && sweep.back.care === 45 && sweep.back.round,
    `rebuilding keeps June on shift and lifts care off the floor (care ${sweep.back.care})`);

  const goals = await t(() => {
    const start = GOALS.findIndex(g => g.id === 'clinic1');
    G.goalIndex = start; G.goodwill = 0;
    G.structures.clinic = true; G.bandagesRolled = 4; G.dressings = 6; G.june = 2; G.clinicSteady = 5;
    checkGoals();
    const paid = G.goodwill;
    const rewards = GOALS.slice(start, start + 5).map(g => g.reward);
    return { paid, rewards, index: G.goalIndex, start: start };
  });
  ok(goals.rewards.join(',') === '6,4,6,8,8' && goals.paid === 32 && goals.index === goals.start + 5,
    `the five clinic goals pay 6+4+6+8+8 goodwill (${goals.paid}) and then step off the rung`);

  const pills = await t(() => {
    G.health = 15; G.warmth = 28; G.structures.clinic = true; G.care = 0;
    updateHUD();
    const health = document.getElementById('health-pill').className;
    const warmth = document.getElementById('warmth-pill').className;
    const shelf = document.getElementById('bandage-pill').className;
    const title = document.getElementById('health-pill').title;
    G.health = 100; G.warmth = 80; G.care = 60; updateHUD();
    return {
      health, warmth, shelf, title,
      cleared: !document.getElementById('health-pill').className.includes('vital'),
    };
  });
  ok(/vital-critical/.test(pills.health) && /vital-low/.test(pills.warmth) && /vital-critical/.test(pills.shelf),
    'low health, low warmth, and empty care paint the pills');
  ok(/critical/.test(pills.title) && pills.cleared, 'the health pill says why, and a recovered camp clears the warning');

  await t(() => saveGame());
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.bandages; delete s.bandagesRolled; delete s.dressings; delete s.care;
    delete s.june; delete s.juneRounds; delete s.juneRoundDay; delete s.clinicSteady; delete s.clinicAsk;
    delete s.structures.clinic;
    s.care = 9999; s.june = 9; s.bandages = -3;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof G !== 'undefined' && typeof G.care === 'number');
  const legacy = await t(() => ({
    clinic: G.structures.clinic, bandages: G.bandages, rolled: G.bandagesRolled,
    care: G.care, june: G.june, steady: G.clinicSteady, ask: G.clinicAsk,
  }));
  ok(legacy.clinic === false && legacy.bandages === 0 && legacy.care === 100 && legacy.june === 0 && legacy.steady === 0 && legacy.ask === null,
    `a hostile save migrates (clinic ${legacy.clinic}, gauze ${legacy.bandages}, care ${legacy.care}, june ${legacy.june})`);

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

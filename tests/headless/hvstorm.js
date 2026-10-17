/* Storm night on the river lot.
 *
 * A. Storm Gate is 6 wood, 4 scraps, 3 goodwill, after the clinic.
 *    Workbench still gates 14 of 21 recipes.
 * B. Rio's choice is local: she spends a phase's pile if it can bear it,
 *    and she always counts heads. No random roll.
 * C. A dawn with the gate down does not offer a storm and does not
 *    move warmth or health. Day 5 with the gate up does, without
 *    spending a random number. Day 4 and day 0 do not.
 * D. Building the gate raises the lot and brings Rio to the rope.
 * E. Holding the line spends the pile. Coming up short waits for Rio.
 *    Two misses lose the night and leave the offer up. Three holds
 *    clear it, Rio stays, and the storm goal pays 8.
 * F. Salvage is once a day after a cleared night: 3 wood, 2 cardboard.
 * G. A hostile save without a gate, with rio 9 and a negative tally,
 *    comes back quiet.
 * H. On a phone the banner's hold is a 44px target inside the screen.
 *    On a desktop the pad stays hidden and the player can still walk.
 * Z. Zero page errors.
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
    if (!sessionStorage.getItem('hvstorm-init')) {
      sessionStorage.setItem('hvstorm-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-night-ledger');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof stormAtDawn === 'function' && typeof G !== 'undefined');
  await page.waitForTimeout(300);
  const t = fn => page.evaluate(fn);

  const recipe = await t(() => {
    const gate = RECIPES.find(r => r.id === 'gate');
    const gated = RECIPES.filter(r => r.requires === 'workbench').length;
    return {
      wood: gate.cost.wood, scraps: gate.cost.scraps, goodwill: gate.cost.goodwill,
      req: gate.requires, n: RECIPES.length, gated,
    };
  });
  ok(recipe.wood === 6 && recipe.scraps === 4 && recipe.goodwill === 3 && recipe.req === 'clinic',
    `Storm Gate is 6 wood, 4 scraps, 3 goodwill, after the clinic (${recipe.wood}/${recipe.scraps}/${recipe.goodwill})`);
  ok(recipe.n === 21 && recipe.gated === 14,
    `the bench still gates 14 of 21 recipes (${recipe.gated} of ${recipe.n})`);

  const policy = await t(() => {
    const real = Math.random;
    let rolls = 0;
    Math.random = () => { rolls++; return 0.5; };
    G.wood = 2;
    const fed = rioChoose(STORM_PHASES[1]).ok;
    G.wood = 0;
    const cold = rioChoose(STORM_PHASES[1]).ok;
    const heads = rioChoose(STORM_PHASES[2]).ok;
    Math.random = real;
    return { fed, cold, heads, rolls };
  });
  ok(policy.fed && !policy.cold && policy.heads && policy.rolls === 0,
    `Rio feeds a stocked barrel, skips an empty one, and always counts heads (${policy.rolls} rolls)`);

  const quiet = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    localStorage.removeItem('hv-night-ledger');
    ledgerCache = null;
    G.structures.clinic = false;
    G.structures.gate = false;
    G.care = 60; G.june = 0; G.bandages = 3; G.health = 80; G.morale = 50;
    G.days = 1; G.warmth = 90; G.forecast = 'clear'; G.snapUntil = null;
    G.population = 1; G.food = 50; G.dog = 0; G.rio = 0; G.stormDue = false; G.stormOn = false;
    G.workers.cook = false; G.workers.scrapper = false;
    G.structures.tent = false; G.structures.garden = false; G.structures.pantry = false;
    G.rep = 0; G.lastEventDay = 99; G.goalIndex = GOALS.length;
    G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false; G.favor = null;
    onNewDay();
    Math.random = real;
    return {
      care: G.care, bandages: G.bandages, warmth: G.warmth, health: G.health,
      due: G.stormDue, ledger: localStorage.getItem('hv-night-ledger'),
    };
  });
  ok(quiet.care === 60 && quiet.bandages === 3 && quiet.warmth === 82 && quiet.health === 80 && !quiet.due && quiet.ledger === null,
    `a dawn with the gate down leaves warmth, health, and the ledger alone (warmth ${quiet.warmth}, due ${quiet.due})`);

  const offer = await t(() => {
    const real = Math.random;
    let rolls = 0;
    Math.random = () => { rolls++; return 0.5; };
    G.structures.gate = true; G.stormOn = false; G.goalIndex = GOALS.length;
    G.stormDue = false; G.days = 4; stormAtDawn();
    const day4 = G.stormDue;
    G.days = 0; stormAtDawn();
    const day0 = G.stormDue;
    G.days = 5; stormAtDawn();
    const day5 = G.stormDue;
    G.stormDue = true; stormAtDawn();
    const twice = G.stormDue;
    Math.random = real;
    return { day4, day0, day5, twice, rolls };
  });
  ok(!offer.day4 && !offer.day0 && offer.day5 && offer.twice && offer.rolls === 0,
    `day 5 offers the night once, and the offer spends no random number (${offer.rolls} rolls)`);

  const built = await t(() => {
    G.rio = 0; G.structures.gate = false; G.goalIndex = GOALS.length; G.stormDue = false; G.stormOn = false;
    G.activeCrafts.gate = { start: Date.now() - 50, duration: 1 };
    finishCraft(RECIPES.find(r => r.id === 'gate'));
    const row = document.querySelector('#rio-row .w-name');
    return {
      gate: !!G.structures.gate, rio: G.rio, lot: !!lotMesh, mesh: !!rioMesh,
      name: row && row.textContent,
    };
  });
  ok(built.gate && built.rio === 1 && built.lot && built.mesh && built.name === 'Rio, at the gate',
    `the gate raises the lot and Rio comes up from the water (${built.name})`);

  const line = await t(() => {
    G.structures.gate = true; G.stormDue = true; G.stormOn = false; G.goalIndex = GOALS.length;
    G.scraps = 0; G.wood = 4; G.warmth = 90; G.health = 90; G.stormsCleared = 0; G.rio = 1;
    stormStart();
    stormHoldReadyAt = 0;
    const waited = stormHold() === false && G.stormPhase === 0 && G.scraps === 0;
    G.scraps = 3;
    stormHoldReadyAt = 0;
    const held = stormHold() === true && G.stormPhase === 1 && G.scraps === 1;
    G.stormOn = false; G.stormDue = true; G.scraps = 0; G.wood = 0;
    G.warmth = 80; G.health = 80; G.stormsCleared = 0;
    stormStart();
    G.stormDeadline = Date.now() - 5;
    stormExpireIfDue();
    const tarp = { phase: G.stormPhase, strikes: G.stormStrikes, warmth: G.warmth, health: G.health };
    G.stormDeadline = Date.now() - 5;
    stormExpireIfDue();
    return {
      waited, held, tarp,
      lost: { on: G.stormOn, due: G.stormDue, cleared: G.stormsCleared, strikes: G.stormStrikes, warmth: G.warmth, health: G.health },
    };
  });
  ok(line.waited && line.held && line.tarp.phase === 1 && line.tarp.strikes === 1 && line.tarp.warmth === 72 && line.tarp.health === 76,
    `a short pile waits, a hold spends 2 scraps, and a missed tarp costs 8 warmth (${line.tarp.warmth})`);
  ok(!line.lost.on && line.lost.due && line.lost.cleared === 0 && line.lost.strikes === 2 && line.lost.warmth === 64 && line.lost.health === 72,
    `two breaks lose the night and leave the offer up (cleared ${line.lost.cleared}, due ${line.lost.due})`);

  const cleared = await t(() => {
    const start = GOALS.findIndex(g => g.id === 'storm1');
    G.goalIndex = start; G.goodwill = 0; G.structures.gate = true; G.stormDue = true; G.stormOn = false;
    G.rio = 1; G.stormsCleared = 0; G.scraps = 4; G.wood = 4; G.warmth = 70; G.health = 70;
    stormStart();
    stormHoldReadyAt = 0; stormHold();
    stormHoldReadyAt = 0; stormHold();
    stormHoldReadyAt = 0; stormHold();
    buildActionUI();
    return {
      on: G.stormOn, due: G.stormDue, cleared: G.stormsCleared, rio: G.rio,
      scraps: G.scraps, wood: G.wood, goodwill: G.goodwill, index: G.goalIndex,
      salvage: !!document.getElementById('action-salvage'),
      name: document.querySelector('#rio-row .w-name').textContent,
      badge: document.getElementById('pop-val').textContent,
      walking: overlayOpen(),
      done: G.goalIndex === GOALS.length,
    };
  });
  ok(!cleared.on && !cleared.due && cleared.cleared === 1 && cleared.rio === 2 && cleared.scraps === 2 && cleared.wood === 2,
    `three holds clear the night and Rio stays (scraps ${cleared.scraps}, wood ${cleared.wood})`);
  ok(cleared.goodwill === 8 && cleared.done && cleared.salvage && cleared.name === 'Rio, staying' && cleared.badge.includes('🌧️') && !cleared.walking,
    `the storm goal pays 8, salvage unlocks, and the player can still walk (${cleared.badge})`);

  const haul = await t(() => {
    G.structures.gate = true; G.stormsCleared = 1; G.wood = 0; G.cardboard = 0;
    G.days = 3; G.lotSalvageDay = -9; G.goalIndex = GOALS.length; G.cooldowns = {};
    buildActionUI();
    finishAction(salvageAction());
    const once = { wood: G.wood, card: G.cardboard, day: G.lotSalvageDay };
    doAction(salvageAction());
    const refused = G.wood === 3 && G.cardboard === 2 && !activeJobs.salvage;
    G.days = 4; G.cooldowns = {};
    finishAction(salvageAction());
    return { once, refused, wood: G.wood, card: G.cardboard };
  });
  ok(haul.once.wood === 3 && haul.once.card === 2 && haul.once.day === 3 && haul.refused && haul.wood === 6 && haul.card === 4,
    `salvage pays once a day, and the next dawn pays again (${haul.wood} wood, ${haul.card} cardboard)`);

  await t(() => saveGame());
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.structures.gate;
    s.rio = 9; s.stormsCleared = -3; s.stormPhase = 9; s.lotSalvageDay = null;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof G !== 'undefined' && typeof G.rio === 'number');
  const legacy = await t(() => ({
    gate: G.structures.gate, rio: G.rio, cleared: G.stormsCleared, phase: G.stormPhase, day: G.lotSalvageDay,
  }));
  ok(legacy.gate === false && legacy.rio === 0 && legacy.cleared === 0 && legacy.phase === 0 && legacy.day === -9,
    `a hostile save comes back quiet (gate ${legacy.gate}, rio ${legacy.rio}, cleared ${legacy.cleared})`);

  ok(errs.length === 0, `no page errors on the desk${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await phone.newPage();
  mp.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 180)));
  await mp.addInitScript(() => localStorage.setItem('hv-intro-seen', '1'));
  await mp.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await mp.waitForFunction(() => typeof stormStart === 'function');
  await mp.evaluate(() => {
    G.goalIndex = GOALS.length; G.structures.gate = true; G.rio = 1; G.stormDue = true; G.stormOn = false;
    G.scraps = 4; G.wood = 4;
    refreshStructures(); updateHUD();
  });
  const call = await mp.evaluate(() => {
    const el = document.getElementById('storm-call');
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      h: Math.round(r.height),
      in: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      owns: !!hit && (hit === el || el.contains(hit)),
      shown: el.classList.contains('show'),
    };
  });
  ok(call.shown && call.h >= 44 && call.in && call.owns,
    `the phone call button owns its centre (${call.h}px)`);
  await mp.locator('#storm-call').click();
  const hold = await mp.evaluate(() => {
    const el = document.getElementById('storm-hold');
    const rain = document.getElementById('storm-rain');
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const pad = document.getElementById('walk-pad').getBoundingClientRect();
    const overlap = Math.min(pad.right, r.right) - Math.max(pad.left, r.left) > 2
      && Math.min(pad.bottom, r.bottom) - Math.max(pad.top, r.top) > 2;
    return {
      on: G.stormOn, phase: document.getElementById('storm-title').textContent,
      h: Math.round(r.height),
      in: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      owns: !!hit && (hit === el || el.contains(hit)),
      rain: getComputedStyle(rain).display !== 'none',
      overlap,
    };
  });
  ok(hold.on && hold.phase === 'Weight the tarp' && hold.h >= 44 && hold.in && hold.owns && hold.rain && !hold.overlap,
    `the phone storm banner holds the line inside the screen (${hold.phase}, ${hold.h}px)`);
  await phone.close();

  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await desk.newPage();
  dp.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 180)));
  await dp.addInitScript(() => localStorage.setItem('hv-intro-seen', '1'));
  await dp.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await dp.waitForFunction(() => typeof stormStart === 'function');
  const wide = await dp.evaluate(() => {
    G.goalIndex = GOALS.length; G.structures.gate = true; G.rio = 2; G.stormDue = true; G.stormsCleared = 1;
    G.scraps = 4; G.wood = 4;
    refreshStructures(); buildActionUI(); stormStart();
    const banner = document.getElementById('storm-banner');
    const pad = getComputedStyle(document.getElementById('walk-pad')).display;
    const salvage = document.getElementById('action-salvage');
    return {
      shown: banner.classList.contains('show'),
      display: getComputedStyle(banner).display,
      pad, parent: salvage && salvage.parentElement.id,
      walking: overlayOpen(),
    };
  });
  ok(wide.shown && wide.display === 'block' && wide.pad === 'none' && wide.parent === 'action-list' && !wide.walking,
    `on a wide screen the banner shows, salvage stays on the rail, and the pad is hidden (${wide.display})`);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

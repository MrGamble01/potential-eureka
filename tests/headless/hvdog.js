/*
 * HV-6 — the stray dog companion (re-runnable: classic scripts, globals
 * reachable, save cleared on boot).
 *  A. Fresh camp: no dog; the goal ladder ends with 'Befriend the stray dog'.
 *  B. Day 4 dawn: Biscuit appears at the fence (dog=1), event fires, mesh spawns.
 *  C. Two days later with food on hand he joins the camp (dog=2).
 *  D. Fed upkeep: -1 food, +2 morale, +3 warmth, 🐕 on the pop badge.
 *  E. Hungry upkeep: -2 extra morale, 🐕💢 badge.
 *  F. Panhandle: fed dog widens the success window; hungry dog doesn't.
 *  G. Theft losses halved with the dog in camp.
 *  H. No Lookout: Biscuit barks a 15s sweep warning instead of an instant sweep.
 *  I. Reload keeps the dog; a pre-HV-6 save migrates to dog-less defaults.
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
    if (!sessionStorage.getItem('hvdog-init')) {
      sessionStorage.setItem('hvdog-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // A. fresh state + the befriend goal on the ladder (position-agnostic:
  // later features append their own rungs after it)
  const fresh = await t(() => ({ dog: G.dog, hasGoal: GOALS.some(g => g.id === 'dog'), mesh: !!dogMesh }));
  ok(fresh.dog === 0 && !fresh.mesh, 'fresh camp has no dog');
  ok(fresh.hasGoal, 'the befriend goal is on the ladder');

  // B. day 4: the stray appears
  const stray = await t(() => {
    G.days = 3; G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.food = 1;
    onNewDay();
    return { dog: G.dog, mesh: !!dogMesh,
      title: document.getElementById('ev-title').textContent };
  });
  ok(stray.dog === 1 && stray.mesh, 'day 4 dawn brings the wary stray (dog=1, mesh spawned)');
  ok(stray.title === 'A Stray Dog', `stray event fires (${stray.title})`);

  // C. two days later, with food, he joins
  const joins = await t(() => {
    G.lastEventDay = G.days + 5; G.food = 1; onNewDay();          // day 5 — too soon
    const early = G.dog;
    G.lastEventDay = G.days + 5; G.food = 10; onNewDay();         // day 6 — joins
    return { early, dog: G.dog, title: document.getElementById('ev-title').textContent };
  });
  ok(joins.early === 1, 'one day later he is still at the fence');
  ok(joins.dog === 2 && joins.title === 'Biscuit Comes Closer', `with food on day 6 he joins (${joins.title})`);

  // D. fed upkeep
  const fed = await t(() => {
    G.lastEventDay = G.days + 5; G.forecast = 'clear';
    G.food = 10; G.warmth = 50; G.morale = 50; G.goodwill = 0; G.health = 90;
    onNewDay();
    return { food: G.food, warmth: G.warmth, morale: G.morale, hungry: G.dogHungry,
      badge: document.getElementById('pop-val').textContent };
  });
  ok(fed.food === 7.5, `fed dog: 1.5 (camp) + 1 (Biscuit) food eaten (${fed.food})`);
  ok(fed.warmth === 45, `warmth -8 drain +3 dog = 45 (${fed.warmth})`);
  ok(fed.morale === 49, `morale -3 decay +2 dog = 49 (${fed.morale})`);
  ok(!fed.hungry && fed.badge.includes('🐕') && !fed.badge.includes('💢'), `pop badge shows a fed 🐕 (${fed.badge})`);

  // E. hungry upkeep
  const hungry = await t(() => {
    G.lastEventDay = G.days + 5; G.forecast = 'clear';
    G.food = 0; G.morale = 50;
    onNewDay();
    return { morale: G.morale, hungry: G.dogHungry, badge: document.getElementById('pop-val').textContent };
  });
  ok(hungry.morale === 45 && hungry.hungry, `hungry dog: morale -3 -2 = 45, dogHungry set (${hungry.morale})`);
  ok(hungry.badge.includes('🐕💢'), `pop badge flips to 🐕💢 (${hungry.badge})`);

  // F. panhandle: same roll succeeds fed, fails hungry
  const pan = await t(() => {
    const real = Math.random; Math.random = () => 0.6;   // .55 < .6 < .55*1.25
    G.weather = 'clear'; G.cooldowns = {};
    G.dogHungry = true; G.goodwill = 0; G.morale = 50;
    finishAction(ACTIONS.find(a => a.id === 'panhandle'));
    const hungryGw = G.goodwill, hungryMorale = G.morale;
    G.dogHungry = false; G.cooldowns = {};
    finishAction(ACTIONS.find(a => a.id === 'panhandle'));
    Math.random = real;
    return { hungryGw, hungryMorale, fedGw: G.goodwill };
  });
  ok(pan.hungryGw === 0 && pan.hungryMorale === 47, `hungry dog: 0.6 roll misses the .55 window (+0 goodwill, morale -3)`);
  ok(pan.fedGw === 3, `fed dog widens it to .6875 — same roll pays +3 goodwill (${pan.fedGw})`);

  // G. theft halved
  const theft = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return { cans: G.cans, food: G.food, scraps: G.scraps, morale: G.morale,
      msg: document.querySelectorAll('.log-line')[document.querySelectorAll('.log-line').length - 1].textContent };
  });
  ok(theft.cans === 17 && theft.food === 17 && theft.scraps === 18,
    `theft losses halved by the dog (cans 20→${theft.cans}, food 20→${theft.food}, scraps 20→${theft.scraps})`);
  ok(theft.msg.includes('Biscuit chased'), 'theft log credits Biscuit');

  // H. bark warning instead of an instant sweep
  const bark = await t(() => {
    const real = Math.random; Math.random = () => 0.1;
    G.workers.lookout = false; G.sweepWarned = false; G.packedUp = false;
    const sweptBefore = G.timesSwept;
    maybeEvent();
    Math.random = real;
    const out = { warned: G.sweepWarned, swept: G.timesSwept - sweptBefore,
      visible: document.getElementById('sweep-warning').style.display === 'block',
      msg: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
    G.sweepWarned = false; showSweepWarning(false);   // disarm the 15s timer
    return out;
  });
  ok(bark.warned && bark.swept === 0 && bark.visible, 'no Lookout: the sweep is warned, not instant');
  ok(bark.msg.includes('Biscuit will not stop barking'), 'the warning is the dog barking');

  // I. persistence + migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const back = await t(() => ({ dog: G.dog, badge: document.getElementById('pop-val').textContent }));
  ok(back.dog === 2 && back.badge.includes('🐕'), `reload keeps Biscuit (dog=${back.dog})`);
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.dog; delete s.dogMetDay; delete s.dogHungry;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const legacy = await t(() => ({ dog: G.dog, met: G.dogMetDay, hungry: G.dogHungry }));
  ok(legacy.dog === 0 && legacy.met === 0 && legacy.hungry === false, 'pre-HV-6 save migrates to dog-less defaults');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/*
 * HV-7 — the regulars (re-runnable: classic scripts, globals reachable,
 * save cleared on first load).
 *  A. Fresh camp: roster shows three ??? strangers with empty hearts.
 *  B. Trading bumps Marisol; the first bump puts a name to the face.
 *  C. Reaching 5 fires the friendship log + fills the row.
 *  D. Friend Marisol: a 0.1 dawn roll leaves tamales (+2 food, exact math).
 *  E. Friend Ray: the same 0.15 scavenge roll comes up empty as a
 *     stranger but pays as a friend (threshold .2 → .1).
 *  F. Friend Dee patches health <30 (+10), then respects the 3-day rest.
 *  G. Save → reload keeps affinity; a pre-HV-7 save migrates cleanly.
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
    if (!sessionStorage.getItem('hvr-init')) {
      sessionStorage.setItem('hvr-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // A. fresh roster
  const fresh = await t(() => {
    const rows = Array.from(document.querySelectorAll('#regulars-list .worker-row')).map(r => r.textContent);
    return { n: rows.length, anon: rows.every(r => r.includes('???')), hearts: rows.every(r => r.includes('♡♡♡♡♡')) };
  });
  ok(fresh.n === 3 && fresh.anon && fresh.hearts, 'fresh camp: three ??? strangers, empty hearts');

  // B. first trade puts a name to the face
  const named = await t(() => {
    G.cans = 30;
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    return { a: G.regulars.marisol,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
      row: document.querySelectorAll('#regulars-list .worker-row')[0].textContent };
  });
  ok(named.a === 1 && named.log.includes('You learn the name') && named.log.includes('Marisol'),
    'first trade: affinity 1 + the name reveal');
  ok(named.row.includes('Marisol') && !named.row.includes('???'), 'roster row now shows her name');

  // C. friendship at 5
  const friend = await t(() => {
    for (let i = 0; i < 4; i++) { G.cans = 30; G.cooldowns = {}; finishAction(ACTIONS.find(a => a.id === 'trade')); }
    return { a: G.regulars.marisol,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
      hired: document.querySelectorAll('#regulars-list .worker-row')[0].className.includes('hired') };
  });
  ok(friend.a === 5 && friend.log.includes('counts you as a friend'), 'fifth trade fires the friendship log');
  ok(friend.hired, 'her row lights up as a friend');

  // D. Marisol's dawn tamales (0.1 roll < .3, rand(2,4) with 0.1 → 2)
  const tamale = await t(() => {
    const real = Math.random; Math.random = () => 0.1;
    G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.dog = 0;
    G.food = 10; G.population = 1;
    onNewDay();
    Math.random = real;
    return { food: G.food, log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  });
  ok(tamale.food === 10.5, `dawn leftovers: 10 − 1.5 (camp) + 2 (tamales) = 10.5 (${tamale.food})`);
  ok(tamale.log.includes('Marisol left a bag of tamales'), 'the drop is logged by name');

  // E. Ray halves empty scavenge hauls (roll 0.15: stranger empty, friend pays)
  const ray = await t(() => {
    const real = Math.random; Math.random = () => 0.15;
    G.weather = 'clear'; G.season = 0; G.cooldowns = {};
    G.regulars.ray = 0; G.cans = 0; G.scraps = 0;
    finishAction(ACTIONS.find(a => a.id === 'scavenge'));
    const strangerScraps = G.scraps;
    G.regulars.ray = 5; G.cooldowns = {}; G.scraps = 0;
    finishAction(ACTIONS.find(a => a.id === 'scavenge'));
    Math.random = real;
    return { strangerScraps, friendScraps: G.scraps };
  });
  ok(ray.strangerScraps === 0 && ray.friendScraps > 0,
    `same 0.15 roll: stranger digs an empty bin, Ray's friend finds scraps (+${ray.friendScraps})`);

  // F. Dee patches you up, then respects the cooldown
  const dee = await t(() => {
    const real = Math.random; Math.random = () => 0.9;   // no tamales, no events
    G.regulars.dee = 5; G.lastDeeDay = -9;
    G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.warmth = 80; G.food = 50;
    G.health = 20;
    onNewDay();
    const patched = G.health;
    G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.warmth = 80; G.food = 50;
    G.health = 20;
    onNewDay();
    Math.random = real;
    return { patched, second: G.health, day: G.lastDeeDay };
  });
  ok(dee.patched === 30, `Dee patches 20 → ${dee.patched} when health is low`);
  ok(dee.second === 20, 'but not two dawns in a row (3-day cooldown)');

  // G. persistence + migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const back = await t(() => ({ m: G.regulars.marisol, d: G.regulars.dee,
    row: document.querySelectorAll('#regulars-list .worker-row')[0].textContent }));
  ok(back.m === 5 && back.d === 5 && back.row.includes('Marisol'), 'reload keeps the roster');
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.regulars; delete s.lastDeeDay;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const legacy = await t(() => ({ ok: G.regulars && G.regulars.marisol === 0 && G.lastDeeDay === -9,
    rows: document.querySelectorAll('#regulars-list .worker-row').length }));
  ok(legacy.ok && legacy.rows === 3, 'pre-HV-7 save migrates to three strangers');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

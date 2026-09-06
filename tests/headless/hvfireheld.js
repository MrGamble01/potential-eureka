/* HV-83 — Fire Went Out, then dawn said the fire held.
 *
 * The card promises: "The barrel fire died overnight."
 * The effect logs "The fire burned out." Then the next dawn, if
 * warmth is still 50+, HV-13 logs "The fire held all night" and
 * pays +2 morale. The card named a dead fire. Dawn named a live one.
 *
 * Not HV-81 (#744): that is the 30-second barrel dim. This ticket
 * is the dawn morale line. fireOutUntil is theirs.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: fire_out stamps G.fireOutDay. onNewDay's fire-held
 *    branch asks that stamp. ui.js is not touched.
 * B. Behaviour: fire_out then a warm dawn does not log "fire held"
 *    and does not pay the +2. A warm dawn with no fire-out still
 *    does. A later dawn after the burned night can hold again.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const save = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const fireAt = loop.indexOf("id:'fire_out'");
const fire = fireAt >= 0 ? loop.slice(fireAt, fireAt + 700) : '';
const dawnAt = loop.indexOf('function onNewDay(){');
const dawn = dawnAt >= 0 ? loop.slice(dawnAt, dawnAt + 2800) : '';
const heldAt = dawn.indexOf('The fire held all night');
const held = heldAt >= 0 ? dawn.slice(Math.max(0, heldAt - 280), heldAt + 80) : '';

ok(fireAt >= 0 && /died overnight/.test(fire),
   'the Fire Went Out card still says the barrel died overnight — guards the guard');

ok(/fireOutUntil/.test(fire),
   'fireOutUntil is still there — HV-81 owns the barrel dim, not this ticket');

ok(/G\.fireOutDay\s*=\s*G\.days/.test(fire),
   'HV-83: the effect stamps G.fireOutDay so dawn knows the fire died');

ok(/fireOutDay/.test(held) && /days\s*-\s*1/.test(held),
   'onNewDay\'s fire-held branch asks fireOutDay — last night\'s burn is not a hold');

ok(/fireOutDay:\s*-1/.test(cfg),
   'G defaults fireOutDay to -1 — a fresh camp has no burned night pending');

ok(/typeof G\.fireOutDay!=='number'/.test(save),
   'loadGame migrates a pre-HV-83 save that never wrote fireOutDay');

ok(!/fireOutDay/.test(ui) && !/fire_out/.test(ui),
   'ui.js is not this ticket — it still only shows the event banner');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    ev: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'fire_out')),
    desc: (EVENTS_BAD.find(e => e.id === 'fire_out') || {}).desc || '',
  }));
  ok(!boot.intro && boot.ev,
     'a returning camp can fire Fire Went Out — not behind the crash course');
  ok(/died overnight/.test(boot.desc),
     'the live card still says the barrel died overnight');

  const quiet = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
    G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.weather = 'clear';
    G.food = 20; G.population = 1; G.rep = 0;
    G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false;
    G.structures.soup_kitchen = false; G.structures.garden = false;
    G.structures.coats = false; G.mural = 0; G.season = 0;
    G.warmth = 80; G.morale = 50; G.fireOutDay = -1;
    onNewDay();
    Math.random = real;
    return {
      warmth: G.warmth, morale: G.morale,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(quiet.warmth === 72 && quiet.morale === 49 && /fire held/.test(quiet.log),
     `isolation: a warm dawn with no fire-out still holds (warmth ${quiet.warmth}, morale ${quiet.morale})`);

  // fire_out with random=0.5: rand(15,25) = 20, warmth 80 → 60.
  // Dawn drain 8: 60 → 52, still ≥ 50, so HV-13 would pay +2 and lie.
  // After the fix: no "fire held", morale is the plain −3 (47).
  const burned = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
    G.forecast = 'clear'; G.weather = 'clear';
    G.food = 20; G.population = 1; G.rep = 0;
    G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false;
    G.structures.soup_kitchen = false; G.structures.garden = false;
    G.structures.coats = false; G.mural = 0; G.season = 0;
    G.warmth = 80; G.morale = 50;
    const before = G.days;
    EVENTS_BAD.find(e => e.id === 'fire_out').effect();
    const afterBurn = { warmth: G.warmth, day: G.fireOutDay, days: G.days };
    Math.random = () => 0.99;
    G.lastEventDay = G.days + 5;
    onNewDay();
    Math.random = real;
    return {
      afterBurn, warmth: G.warmth, morale: G.morale, days: G.days, before,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(burned.afterBurn.warmth === 60 && burned.warmth === 52,
     `the burned night still wakes warm enough for HV-13 (warmth ${burned.warmth})`);
  ok(burned.afterBurn.day === burned.before,
     `the stamp is the night that died (fireOutDay ${burned.afterBurn.day})`);
  ok(burned.morale === 47 && !/fire held/.test(burned.log),
     `HV-83: a burned night does not log that the fire held (morale ${burned.morale})`);

  const later = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
    G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.weather = 'clear';
    G.food = 20; G.population = 1; G.rep = 0;
    G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false;
    G.structures.soup_kitchen = false; G.structures.garden = false;
    G.structures.coats = false; G.mural = 0; G.season = 0;
    G.warmth = 80; G.morale = 50;
    onNewDay();
    Math.random = real;
    return {
      warmth: G.warmth, morale: G.morale,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(later.morale === 49 && /fire held/.test(later.log),
     `a later warm dawn can hold again (morale ${later.morale})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

/*
 * HV-102 — the pot read 0 food, and an empty larder never bit.
 *
 * The crash course says an empty larder costs health at dawn, the
 * same way warmth below 20% does. Dawn eats population × 1.5. A
 * one-person camp with 2 food wakes to 0.5 left. The HUD floors
 * that crumb to 0 — the pot reads empty. Hunger used G.food<=0, so
 * a half-meal still counted as a full larder and health never moved.
 * Soup Night already treats 0.5 < 1 as a cold pot. Biscuit already
 * needs a whole food. Only the empty-larder bite was looking past
 * the floor the player can see.
 *
 *  A. Source: onNewDay's hunger gate is G.food<1 — the same empty
 *     the HUD prints. The 1.5 drain stays. ui.js is not this ticket.
 *  B. The crash course still names the empty larder.
 *  C. Behaviour: 2 food, one mouth → leftover 0.5, pot reads 0,
 *     health drops. 3 food leaves 1.5, the pot reads 1, health holds.
 *     A true 0 still bites (we did not turn the empty check off).
 *  D. Isolation: the 1.5 drain still creates halves. Soup Night
 *     still compares to population. Biscuit still needs >=1.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'homeless-village.html'), 'utf8');
const dawnAt = loop.indexOf('function onNewDay(){');
const bumpAt = loop.indexOf('function bumpRegular(');
const dawn = dawnAt >= 0 && bumpAt > dawnAt ? loop.slice(dawnAt, bumpAt) : '';
const hunger = /if\(G\.food[^)]+\)\s*G\.health=Math\.max\(0,G\.health-rand\(4,10\)\)/.exec(dawn);

ok(dawnAt >= 0 && /function onNewDay\(\)\{/.test(dawn),
  'onNewDay is still in gameloop.js — guards the gate');

ok(/G\.food\s*=\s*Math\.max\(0,G\.food\s*-\s*G\.population\*1\.5\)/.test(dawn),
  'dawn still eats population × 1.5 — the half-meal is the leftover, not a new drain');

ok(hunger && /G\.food\s*<\s*1/.test(hunger[0]) && !/G\.food\s*<=\s*0/.test(hunger[0]),
  'HV-102: hunger bites when food < 1 — the pot the HUD floors to 0');

ok(/G\.warmth\s*<\s*20/.test(dawn),
  'warmth below 20% still bites — the other half of the crash-course line');

ok(!/function updateHUD/.test(loop) && !/stat-food/.test(loop),
  'the HUD floor stays in ui.js — this ticket is the hunger gate');

ok(/empty larder/.test(html),
  'the crash course still says an empty larder costs health at dawn');

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

  const dawnOnce = (food) => page.evaluate((startFood) => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.days = 5;
    G.lastEventDay = 99;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.season = 0;
    G.population = 1;
    G.warmth = 80;
    G.morale = 50;
    G.rep = 0;
    G.dog = 1;
    G.dogMetDay = 99;
    G.dogHungry = false;
    G.mural = 0;
    G.structures.soup_kitchen = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.structures.coats = false;
    G.petitions = {};
    G.workers.cook = false;
    G.workers.scrapper = false;
    G.snapUntil = null;
    G.friendDay = -1;
    G.rayDebt = 0;
    G.rainBetOn = false;
    G.arcDone = true;
    G.arcStage = 0;
    G.food = startFood;
    G.health = 80;
    onNewDay();
    Math.random = real;
    updateHUD();
    return {
      food: G.food,
      hud: document.getElementById('stat-food').textContent,
      health: G.health,
      hudHealth: document.getElementById('stat-health').textContent,
    };
  }, food);

  // C. half-meal leftover — pot reads 0, larder must bite
  const crumb = await dawnOnce(2);

  ok(crumb.food === 0.5, `2 food − 1.5 leaves a half-meal (${crumb.food})`);
  ok(crumb.hud === '0', `the pot reads 0 — floor of ${crumb.food} (${crumb.hud})`);
  ok(crumb.health < 80 && Number(crumb.hudHealth) < 80,
    `an empty larder costs health — 80 → ${crumb.health}, HUD ${crumb.hudHealth}`);

  // 3 food leaves a visible bowl — health holds
  const bowl = await dawnOnce(3);

  ok(bowl.food === 1.5 && bowl.hud === '1',
    `3 food leaves 1.5 — the pot still reads a bowl (${bowl.food}, HUD ${bowl.hud})`);
  ok(bowl.health === 80, `a bowl in the pot holds health at 80 (${bowl.health})`);

  // a true empty still bites — we did not turn the check off
  const bare = await dawnOnce(0);

  ok(bare.food === 0 && bare.health < 80,
    `a true empty still bites — food ${bare.food}, health ${bare.health}`);

  // D. isolation
  const iso = await page.evaluate(() => {
    const soup = soupNightAtDawn.toString();
    const dog = onNewDay.toString();
    return {
      soupPop: /G\.food\s*<\s*G\.population/.test(soup),
      biscuit: /G\.food\s*>=\s*1/.test(dog),
      drain: /G\.population\*1\.5/.test(dog),
    };
  });
  ok(iso.soupPop, 'Soup Night still compares the pot to the headcount');
  ok(iso.biscuit, 'Biscuit still needs a whole food');
  ok(iso.drain, 'the 1.5 drain is still the 1.5 drain');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

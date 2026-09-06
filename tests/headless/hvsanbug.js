/*
 * HV-181 — Illness Spreading said a bug is going through the camp,
 * then the sanitation unit never touched it.
 *
 * The Sanitation unit petition says the city dropped a portable unit
 * by the underpass and everyone wakes a little healthier. Illness
 * Spreading is the one event that is a bug going through the camp.
 * The effect dropped health and food and never read G.petitions.
 * A camp that paid 15 goodwill for the unit took the same dose as
 * a camp that never asked.
 *
 * Distinct from HV-164 (#854: one dose for a village of five) and
 * HV-94 (#762: the dawn +1 did not scale by heads). This is the
 * unit × the bug, not a scaling leftover.
 *
 *  A. Source: the sickness effect consults petitions.sanitation.
 *  B. The card is still Illness Spreading / a bug through the camp.
 *  C. Sanitation still promises everyone wakes +1 health at dawn.
 *  D. A bare camp, pinned roll: full dose (health −12, food −2).
 *  E. The same roll with the unit: half dose, and the log names it.
 *  F. Injury still ignores the unit. Dawn +1 still lands.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent on the production sickness path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const sick = /id:'sickness'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
ok(!!sick, 'sickness event is still in gameloop.js');
ok(sick && /petitions/.test(sick[1]) && /sanitation/.test(sick[1]),
  'HV-181: sickness effect consults the sanitation unit');
ok(/title:'Illness Spreading'/.test(loop) && /bug is going through the camp/.test(loop),
  'the card is still Illness Spreading — a bug through the camp');
ok(/id:'sanitation'[\s\S]{0,180}?Everyone wakes \+1 health at dawn/.test(cfg),
  'Sanitation still promises everyone wakes +1 health at dawn');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvsanbug-init')) {
      sessionStorage.setItem('hvsanbug-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const hit = (unit) => page.evaluate((hasUnit) => {
    const ev = EVENTS_BAD.find(e => e.id === 'sickness');
    const real = Math.random;
    Math.random = () => 0;
    G.petitions = hasUnit ? { sanitation: true } : {};
    G.health = 80; G.food = 20; G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return {
      health: G.health,
      food: G.food,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, unit);

  // rand(12,22) and rand(2,5) at Math.random=0 → 12 and 2
  const bare = await hit(false);
  ok(bare.banner === 'Illness Spreading',
    `the card still titles itself Illness Spreading (${bare.banner})`);
  ok(/bug is going through the camp/i.test(bare.body),
    'the body is still a bug going through the camp');
  ok(bare.health === 68 && bare.food === 18,
    `a bare camp takes the full dose (80→${bare.health} health, 20→${bare.food} food)`);
  ok(/Sickness hit the community/.test(bare.log) && !/sanitation unit/i.test(bare.log),
    'the bare-camp log is the old sickness line, not the unit');

  const unit = await hit(true);
  ok(unit.health === 74 && unit.food === 19,
    `the same roll with the unit is half (80→${unit.health} health, 20→${unit.food} food)`);
  ok(/sanitation unit/i.test(unit.log),
    `the log names the unit (${unit.log.slice(-120)})`);

  const injury = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'injury');
    const real = Math.random;
    Math.random = () => 0;
    G.petitions = { sanitation: true };
    G.health = 80; G.injuredUntil = 0;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return { health: G.health, until: G.injuredUntil };
  });
  ok(injury.health === 65 && injury.until > Date.now(),
    `Injury still ignores the unit (80→${injury.health}, limp armed)`);

  const dawn = await t(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.petitions = { sanitation: true };
    G.health = 50; G.food = 60; G.warmth = 80; G.weather = 'clear';
    G.lastEventDay = G.days;
    onNewDay();
    Math.random = real;
    return { health: G.health };
  });
  ok(dawn.health >= 51 && dawn.health <= 53,
    `dawn +1 still lands with the unit (health ${dawn.health})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

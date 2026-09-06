/* HV-94 — Sanitation said everyone wakes +1, and a camp of five got one.
 *
 * The petition sells civic infrastructure: "Everyone wakes +1 health
 * at dawn." Soup Night already treats G.population as every mouth.
 * After you grow the camp, the unit still added a flat +1 and logged
 * "+1 health" — the same payout as a solo camp. Five people paid for
 * everyone +1 and woke like only one person used the unit.
 *
 * hvpetition only asserts +1 at the default population of 1.
 * #732 is Illness morale. #741 is the Rest log. Neither is the
 * per-head dawn grant.
 *
 * Write-first, hook-free, source-driven.
 *
 * A. The petition still says everyone +1. The dawn grant reads
 *    G.population. ui.js is not touched. Streetlight and the grant
 *    stay on their own tickets.
 * B. Live: a five-person camp with the unit wakes +5. A solo camp
 *    still wakes +1. No unit, five people, health does not move.
 *
 * Named assertion: HV-94: Sanitation said everyone wakes +1 and a camp of five got one
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const petAt = cfg.indexOf("id:'sanitation'");
const pet = petAt >= 0 ? cfg.slice(petAt, petAt + 280) : '';
const onAt = loop.indexOf('function onNewDay');
const onEnd = loop.indexOf('function bumpRegular');
const onFn = onAt >= 0 && onEnd > onAt ? loop.slice(onAt, onEnd) : '';
const sanAt = onFn.indexOf('petitions.sanitation');
const san = sanAt >= 0 ? onFn.slice(sanAt, sanAt + 280) : '';

(async () => {
  ok(/Everyone wakes \+1 health/i.test(pet),
     `the petition still promises everyone +1 (got ${JSON.stringify((pet.match(/desc:'[^']+'/)||[''])[0])})`);

  ok(/G\.population/.test(san),
     'the dawn grant scales with population — not a flat +1 for a full camp');

  ok(!/petitions\.sanitation/.test(ui) && !/Everyone wakes/.test(ui),
     'ui.js is not this ticket — it still only paints the petition board');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
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
    pet: !!(typeof PETITIONS !== 'undefined' && PETITIONS.some(p => p.id === 'sanitation')),
    pop: G.population,
    san: !!(G.petitions && G.petitions.sanitation),
  }));
  ok(!boot.intro && boot.pet,
     'a returning camp can win Sanitation — not behind the crash course');
  ok(boot.pop === 1 && !boot.san,
     `a fresh camp is one person with no unit (pop ${boot.pop}, san ${boot.san})`);

  const dawn = (pop, san, health0) => page.evaluate(({ pop, san, health0 }) => {
    const real = Math.random;
    Math.random = () => 0.99;
    SNAP_CHANCE = 0; G.snapUntil = null;
    G.petitions = G.petitions || {};
    G.petitions.sanitation = san;
    G.population = pop;
    G.health = health0;
    G.food = 80; G.warmth = 90; G.morale = 80;
    G.weather = 'clear'; G.forecast = 'clear';
    G.structures.soup_kitchen = false;
    G.structures.tent = false;
    G.structures.garden = false;
    G.dog = 0;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.lastEventDay = G.days + 5;
    onNewDay();
    Math.random = real;
    return { health: G.health, pop: G.population, san: !!G.petitions.sanitation };
  }, { pop, san, health0 });

  const none = await dawn(5, false, 50);
  ok(none.health === 50,
     `no unit, five people — health does not move (${none.health})`);

  const solo = await dawn(1, true, 50);
  ok(solo.health === 51,
     `a solo camp still wakes +1 (health ${solo.health})`);

  const five = await dawn(5, true, 50);
  ok(five.health === 55,
     `HV-94: Sanitation said everyone wakes +1 and a camp of five got one (health ${five.health})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

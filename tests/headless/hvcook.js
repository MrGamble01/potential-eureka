/* HV-67 — the Cook never cooked when dawn hunger ran first.
 *
 * You spend 10 goodwill to hire the Cook: "Makes meals from food
 * automatically." The dawn step is `if(G.workers.cook&&G.food>=3)`.
 * That check ran AFTER `G.food -= G.population*1.5`. A camp of two
 * with 5 food — enough for the 3-food meal — woke with 2 food and
 * no "+2 goodwill". The worker stayed "active" and did nothing.
 *
 * Soup Night (#716) is a different pot: 1 food per head, later in
 * onNewDay. This ticket is only the hired Cook.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the Cook block sits above the population drain in
 *    onNewDay. ui.js is not touched.
 * B. Behaviour: cook hired, population 2, 5 food. A controlled dawn
 *    cooks (goodwill +2, the log line) then drains. Without the
 *    cook the same dawn does not pay. Reverting the order fails
 *    the named cook-pay assertion.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const dawnAt = loop.indexOf('function onNewDay(){');
const dawn = dawnAt >= 0 ? loop.slice(dawnAt, dawnAt + 4500) : '';

const cookAt = dawn.indexOf("if(G.workers.cook&&G.food>=3)");
const drainAt = dawn.indexOf('G.food  =Math.max(0,G.food  -G.population*1.5)');
const soupAt = loop.indexOf('soupNightAtDawn()');
const drainAbs = loop.indexOf('G.food  =Math.max(0,G.food  -G.population*1.5)');

ok(dawnAt >= 0 && cookAt >= 0 && drainAt >= 0,
   'onNewDay still has the Cook step and the population drain — guards the guard');
ok(cookAt < drainAt,
   'the Cook cooks before dawn hunger takes the food');
ok(soupAt > drainAbs && soupAt > 0,
   'Soup Night stays where it is — that pot is not this ticket');
ok(/Makes meals from food automatically/.test(cfg),
   'the Cook still promises automatic meals');
ok(!/workers\.cook/.test(ui) && !/function onNewDay/.test(ui),
   'ui.js is not this ticket — it still only paints the Community row');

(async () => {
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
    cook: !!(typeof WORKER_DEFS !== 'undefined' && WORKER_DEFS.some(w => w.id === 'cook')),
  }));
  ok(!boot.intro && boot.cook,
     'a returning camp can hire a Cook — not behind the crash course');

  // Quiet dawn: no dog arc, no soup kitchen, no garden, no events.
  // random=0.5 keeps weather/events boring.
  const dawn = () => page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.dog = 1; G.dogMetDay = 999;
    G.structures.tent = false; G.structures.workbench = false;
    G.structures.toolbox = false; G.structures.garden = false;
    G.structures.barrel = false; G.structures.soup_kitchen = false;
    G.structures.coats = false; G.structures.compost = false;
    G.workers.scrapper = false;
    G.rep = 0; G.snapUntil = null; G.warmth = 40; G.forecast = 'clear';
    G.lastEventDay = G.days + 5; G.rainBetOn = false; G.mural = 0;
    G.petitions = {}; G.arcStage = 3; G.arcDone = true;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.goalIndex = 99;
    onNewDay();
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { food: G.food, gw: G.goodwill, feed, days: G.days };
  });

  // Named case: two mouths, 5 food. The meal costs 3; hunger costs 3.
  // Cook-first: 5-3=2, then 2-3=0, +2 goodwill.
  // Drain-first (the bug): 5-3=2, cook skips, goodwill stays.
  await page.evaluate(() => {
    G.workers.cook = true;
    G.population = 2;
    G.food = 5;
    G.goodwill = 4;
    G.days = 6;
  });
  const cooked = await dawn();
  ok(/The Cook prepared meals/.test(cooked.feed),
     'the Cook logs the meal on a dawn that has 5 food for 2 people');
  ok(cooked.gw === 6,
     `HV-67: the Cook pays +2 goodwill before hunger (goodwill ${cooked.gw})`);
  ok(cooked.food === 0,
     `the meal then the two mouths leave the larder empty (food ${cooked.food})`);

  // Control: no cook, same 5 food / 2 people → drain only, 5-3=2.
  await page.evaluate(() => {
    G.workers.cook = false;
    G.population = 2;
    G.food = 5;
    G.goodwill = 4;
    G.days = 8;
  });
  const raw = await dawn();
  ok(!/The Cook prepared meals/.test(raw.feed),
     'without a Cook there is no meal line');
  ok(raw.gw === 4 && raw.food === 2,
     `without a Cook, hunger alone leaves 2 food and the goodwill (food ${raw.food}, gw ${raw.gw})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

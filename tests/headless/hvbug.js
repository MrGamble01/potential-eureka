/*
 * HV-240 — Illness Spreading said a bug is going through the camp,
 * then the Cook still prepared meals.
 *
 * The card says everyone feels terrible. The Cook is one of everyone.
 * Illness fires at the end of a dawn, after breakfast already landed.
 * The next dawn the Cook still plated meals like nobody was sick.
 *
 * Rest recovering a healthy sleep is not this card. Sanitation is
 * not this card. The five-person dose is not this card. Dawn's
 * ordinary hunger is not this card.
 *
 *  A. Source: the sickness card stamps the Cook's down day.
 *  B. A well Cook still plates. After the bug, tomorrow's breakfast
 *     stays cold. The dawn after, the Cook is back.
 *  C. Rest still recovers. Sanitation still wakes +1.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() and onNewDay on the production row.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const sickAt = loop.indexOf("id:'sickness'");
const lockAt = loop.indexOf("id:'dumpster_locked'");
const sickBlock = sickAt >= 0 && lockAt > sickAt ? loop.slice(sickAt, lockAt) : '';
const cookAt = loop.indexOf('G.workers.cook&&G.food>=3');
const cookBlock = cookAt >= 0 ? loop.slice(cookAt, cookAt + 420) : '';

ok(sickAt >= 0 && /Everyone feels terrible/.test(sickBlock),
  'the sickness card still says everyone feels terrible');
ok(/sickUntil/.test(sickBlock),
  'HV-240: the sickness effect stamps the Cook\'s down day');
ok(/sickUntil/.test(cookBlock),
  'HV-240: the Cook reads the bug before plating');
ok(/sickUntil:\s*-1/.test(config),
  'a fresh camp has no bug pending');
ok(!/homeless-village\/js\/ui\.js/.test(loop) && !/homeless-village\/js\/ui\.js/.test(config),
  'the bug lives in the dawn Cook — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvbug-init')) {
      sessionStorage.setItem('hvbug-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const well = await t(() => {
    G.workers.cook = true;
    G.workers.scrapper = false;
    G.food = 20; G.goodwill = 0; G.population = 1;
    G.lastEventDay = G.days + 9;
    G.forecast = 'clear';
    G.sickUntil = -1;
    const n = document.querySelectorAll('.log-line').length;
    onNewDay();
    const log = Array.from(document.querySelectorAll('.log-line')).slice(n).map(d => d.textContent).join('\n');
    return { food: G.food, gw: G.goodwill, cooked: /Cook prepared meals/.test(log) };
  });
  ok(well.cooked && well.gw === 2,
    `a well Cook still plates (+${well.gw} goodwill)`);

  const bug = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'sickness');
    const real = Math.random;
    Math.random = () => 0.5;
    G.food = 20; G.goodwill = 0; G.health = 80;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return {
      title: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      until: G.sickUntil, day: G.days,
    };
  });
  ok(bug.title === 'Illness Spreading' && /feels terrible/i.test(bug.body),
    `the card still titles itself Illness Spreading (${bug.title})`);
  ok(bug.until === bug.day + 1,
    `the bug keeps the Cook down through tomorrow (sickUntil ${bug.until}, day ${bug.day})`);

  const down = await t(() => {
    G.workers.cook = true;
    G.workers.scrapper = false;
    G.food = 20; G.goodwill = 0; G.population = 1;
    G.lastEventDay = G.days + 9;
    G.forecast = 'clear';
    const n = document.querySelectorAll('.log-line').length;
    onNewDay();
    const log = Array.from(document.querySelectorAll('.log-line')).slice(n).map(d => d.textContent).join('\n');
    return { food: G.food, gw: G.goodwill, cooked: /Cook prepared meals/.test(log), down: /down with the bug/.test(log), day: G.days };
  });
  ok(!down.cooked && down.down && down.gw === 0,
    `tomorrow's breakfast stays cold (goodwill ${down.gw}, down=${down.down})`);

  const back = await t(() => {
    G.workers.cook = true;
    G.workers.scrapper = false;
    G.food = 20; G.goodwill = 0; G.population = 1;
    G.lastEventDay = G.days + 9;
    G.forecast = 'clear';
    const n = document.querySelectorAll('.log-line').length;
    onNewDay();
    const log = Array.from(document.querySelectorAll('.log-line')).slice(n).map(d => d.textContent).join('\n');
    return { gw: G.goodwill, cooked: /Cook prepared meals/.test(log) };
  });
  ok(back.cooked && back.gw === 2,
    'the dawn after, the Cook is back');

  const rest = await t(() => {
    G.health = 50; G.morale = 50;
    finishAction({ id: 'rest', time: 3000, cooldown: 20000 });
    return { health: G.health, morale: G.morale };
  });
  ok(rest.health > 50 && rest.morale > 50,
    `Rest still recovers (health ${rest.health}, morale ${rest.morale})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

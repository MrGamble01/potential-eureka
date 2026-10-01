/*
 * HV-210 — Illness Spreading said everyone feels terrible, then Rest
 * still recovered a healthy sleep.
 *
 * The card body is "A bug is going through the camp. Everyone feels
 * terrible." The effect drops health and food, then walks away. Rest's
 * tooltip still promises a slight recovery. A 3-second rest on the
 * same day rolls the same 5–15 health and 3–8 morale a well day pays.
 * The bug is gone the moment you lie down.
 *
 *  A. Source: the sickness effect stamps G.sickDay = G.days. Rest
 *     halves both rolls while that equals today. The card still says
 *     everyone feels terrible. ui.js is not this ticket.
 *  B. A pinned well-day rest still pays the full roll.
 *  C. The same roll after Illness Spreading pays half.
 *  D. Injury does not steal the sick-day latch. A new dawn restores
 *     the full rest. Sickness still drops health and food.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() + finishAction() on the production
 * path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const sickAt = loop.indexOf("id:'sickness'");
const sick = sickAt >= 0 ? loop.slice(sickAt, sickAt + 700) : '';
const restAt = player.indexOf("a.id==='rest'");
const restEnd = player.indexOf("} else if(a.id==='trade')", restAt);
const rest = restAt >= 0 && restEnd > restAt ? player.slice(restAt, restEnd) : '';

ok(sickAt >= 0 && /Everyone feels terrible/.test(sick),
  'the card still says everyone feels terrible');
ok(/G\.sickDay\s*=\s*G\.days/.test(sick),
  'HV-210: Illness Spreading stamps sickDay to today');
ok(/sickDay/.test(rest) && /\/\s*2|Math\.floor/.test(rest),
  'HV-210: Rest halves the recovery while sickDay is today');
ok(!/function buildActionUI/.test(player) && !/sickDay/.test(ui),
  'the sick-day latch lives in gameloop/player — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvsickrest-init')) {
      sessionStorage.setItem('hvsickrest-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // rand(5,15) / rand(3,8) with Math.random=0.99 → 15 / 8
  const well = await t(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.health = 50; G.morale = 50; G.days = 4; G.sickDay = -1;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.goalIndex = GOALS.length;
    finishAction({ id: 'rest', time: 3000, cooldown: 20000 });
    Math.random = real;
    return {
      health: G.health, morale: G.morale, ray: G.regulars.ray,
      tip: ACTIONS.find(a => a.id === 'rest').tooltip,
    };
  });
  ok(/health and morale/i.test(well.tip),
    `Rest still promises health and morale (${well.tip})`);
  ok(well.health === 65 && well.morale === 58,
    `a well-day rest still pays the full roll (50 → ${well.health} / ${well.morale})`);
  ok(well.ray === 1, `Ray still likes the company (${well.ray})`);

  const sickRest = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'sickness');
    const real = Math.random;
    Math.random = () => 0.99;
    G.health = 80; G.food = 10; G.morale = 50; G.days = 5;
    G.sickDay = -1;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.goalIndex = GOALS.length;
    triggerEvent(ev, false);
    const afterEvent = { health: G.health, food: G.food, sickDay: G.sickDay };
    G.health = 50; G.morale = 50;
    finishAction({ id: 'rest', time: 3000, cooldown: 20000 });
    Math.random = real;
    return {
      afterEvent,
      health: G.health, morale: G.morale, sickDay: G.sickDay,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(sickRest.banner === 'Illness Spreading',
    `the card is still Illness Spreading (${sickRest.banner})`);
  ok(/everyone feels terrible/i.test(sickRest.body),
    'the body still says everyone feels terrible');
  ok(sickRest.afterEvent.health < 80 && sickRest.afterEvent.food < 10,
    `sickness still drops health and food (health=${sickRest.afterEvent.health}, food=${sickRest.afterEvent.food})`);
  ok(sickRest.sickDay === 5,
    `HV-210: the bug stamps today (sickDay=${sickRest.sickDay})`);
  ok(sickRest.health === 57 && sickRest.morale === 54,
    `HV-210: a sick rest pays half, not a healthy sleep (50 → ${sickRest.health} / ${sickRest.morale})`);
  ok(/You rest.*bug|bug is still going around/i.test(sickRest.log),
    `the rest log names the bug (${sickRest.log.slice(-100)})`);

  const injury = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'injury');
    const real = Math.random;
    Math.random = () => 0.99;
    G.health = 80; G.morale = 50; G.days = 6; G.sickDay = -1;
    triggerEvent(ev, false);
    const stamped = G.sickDay;
    G.health = 50; G.morale = 50;
    finishAction({ id: 'rest', time: 3000, cooldown: 20000 });
    Math.random = real;
    return { stamped, health: G.health, morale: G.morale };
  });
  ok(injury.stamped !== 6 && injury.health === 65 && injury.morale === 58,
    `Injury does not steal the sick-day latch (sickDay=${injury.stamped}, rest ${injury.health}/${injury.morale})`);

  const nextDawn = await t(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.health = 50; G.morale = 50; G.days = 7; G.sickDay = 6;
    finishAction({ id: 'rest', time: 3000, cooldown: 20000 });
    Math.random = real;
    return { health: G.health, morale: G.morale };
  });
  ok(nextDawn.health === 65 && nextDawn.morale === 58,
    `a new dawn restores the full rest (50 → ${nextDawn.health} / ${nextDawn.morale})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

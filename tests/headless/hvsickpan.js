/*
 * HV-273 — Illness Spreading said everyone feels terrible, then
 * Panhandle still paid a well-day take.
 *
 * The card body is "A bug is going through the camp. Everyone feels
 * terrible." The effect drops health and food, then walks away.
 * Panhandle's tooltip is still "Ask strangers for change." A pinned
 * 0.4 roll that lands on a well day (the 0.55 stranger bar) still
 * lands after the card. The bug never reached the corner.
 *
 *  A. Source: the sickness effect stamps G.sickDay = G.days.
 *     Panhandle halves the success bar while that equals today.
 *     The card still says everyone feels terrible. ui.js is not
 *     this ticket.
 *  B. A pinned well-day 0.4 roll still pays.
 *  C. The same roll after Illness Spreading fails — ignored, morale
 *     dips, no goodwill.
 *  D. Theft / City Sweep do not steal the sick-day latch. A new
 *     dawn restores the well-day take. Sickness still drops health
 *     and food.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() + finishAction() on the
 * production path.
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
const panAt = player.indexOf("a.id==='panhandle'");
const panEnd = player.indexOf("} else if(a.id==='rest')", panAt);
const pan = panAt >= 0 && panEnd > panAt ? player.slice(panAt, panEnd) : '';

ok(sickAt >= 0 && /Everyone feels terrible/.test(sick),
  'the card still says everyone feels terrible');
ok(/G\.sickDay\s*=\s*G\.days/.test(sick),
  'HV-273: Illness Spreading stamps sickDay to today');
ok(/sickDay/.test(pan) && /0\.5|\/\s*2/.test(pan),
  'HV-273: Panhandle halves the corner odds while sickDay is today');
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
    if (!sessionStorage.getItem('hvsickpan-init')) {
      sessionStorage.setItem('hvsickpan-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const well = await t(() => {
    const real = Math.random;
    Math.random = () => 0.4;
    G.weather = 'clear'; G.dog = 0; G.rep = 0; G.mural = 0;
    G.snapUntil = null; G.structures.awning = false;
    G.sickDay = -1; G.days = 4;
    G.goodwill = 10; G.morale = 50;
    G.goalIndex = GOALS.length;
    finishAction({ id: 'panhandle' });
    Math.random = real;
    return { gw: G.goodwill, morale: G.morale };
  });
  ok(well.gw > 10 && well.morale === 50,
    `a well-day 0.4 roll still pays (gw ${well.gw}, morale ${well.morale})`);

  const sickDay = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'sickness');
    const real = Math.random;
    Math.random = () => 0.4;
    G.weather = 'clear'; G.dog = 0; G.rep = 0; G.mural = 0;
    G.snapUntil = null; G.structures.awning = false;
    G.days = 4; G.health = 80; G.food = 10;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    const afterCard = { health: G.health, food: G.food, sickDay: G.sickDay,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent };
    G.goodwill = 10; G.morale = 50;
    finishAction({ id: 'panhandle' });
    Math.random = real;
    return {
      afterCard,
      gw: G.goodwill,
      morale: G.morale,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(sickDay.afterCard.banner === 'Illness Spreading',
    `the card still titles itself Illness Spreading (${sickDay.afterCard.banner})`);
  ok(/Everyone feels terrible/.test(sickDay.afterCard.body),
    'the body still says everyone feels terrible');
  ok(sickDay.afterCard.health < 80 && sickDay.afterCard.food < 10,
    `sickness still drops health and food (${sickDay.afterCard.health}, ${sickDay.afterCard.food})`);
  ok(sickDay.afterCard.sickDay === 4,
    `the card stamps sickDay to today (${sickDay.afterCard.sickDay})`);
  ok(sickDay.gw === 10 && sickDay.morale < 50 && /Ignored again/.test(sickDay.log),
    `the same 0.4 roll fails while the bug is going around (gw ${sickDay.gw}, morale ${sickDay.morale})`);

  const other = await t(() => {
    const fire = (id) => {
      const ev = EVENTS_BAD.find(e => e.id === id);
      G.sickDay = -1; G.days = 4;
      G.rep = 40; G.morale = 80; G.goodwill = 20; G.health = 80;
      G.food = 10; G.cans = 10; G.scraps = 10;
      G.structures.tent = false; G.structures.garden = false;
      G.structures.soup_kitchen = false; G.structures.workbench = false;
      G.garageCover = false; G.packedUp = false; G.dog = 0;
      G.lastEventDay = G.days;
      triggerEvent(ev, false);
      return G.sickDay;
    };
    return { theft: fire('theft'), sweep: fire('sweep') };
  });
  ok(other.theft === -1 && other.sweep === -1,
    `Theft / City Sweep leave the sick-day latch alone (${other.theft}, ${other.sweep})`);

  const dawn = await t(() => {
    const real = Math.random;
    Math.random = () => 0.4;
    G.weather = 'clear'; G.dog = 0; G.rep = 0; G.mural = 0;
    G.snapUntil = null; G.structures.awning = false;
    G.days = 5; G.sickDay = 4;
    G.goodwill = 10; G.morale = 50;
    finishAction({ id: 'panhandle' });
    Math.random = real;
    return { gw: G.goodwill };
  });
  ok(dawn.gw > 10, `the next dawn restores the well-day take (gw ${dawn.gw})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

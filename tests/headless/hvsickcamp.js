/*
 * HV-164 — Illness Spreading said a bug is going through the camp,
 * then a village of five took one person's dose.
 *
 * The card says "A bug is going through the camp. Everyone feels
 * terrible." The effect shaved one rand(12,22) off the communal
 * health bar and one rand(2,5) off the pot — the same numbers a
 * solo camp takes. Sanitation already treats G.population as every
 * mouth (+1 each). Illness never asked how many people were in
 * the village. A pinned low roll dropped a camp of five exactly
 * as hard as a camp of one.
 *
 * Not #732 (morale never moved — this ticket does not touch the
 * 😞 pill). Not #762 (sanitation everyone +1). Not a Cook / Scrapper
 * skip. The bug is the camp size the card named.
 *
 *  A. Source: the card still names the camp; the effect reads
 *     G.population; ui.js is untouched.
 *  B. Solo: a pinned low roll still drops 12 health and 2 food.
 *  C. Five residents: the same roll drops more of both.
 *  D. Injury is still one person's limp — population does not
 *     multiply it. Sanitation is not this ticket.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production sickness card.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const block = /id:'sickness'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'sickness event is still in gameloop.js');
ok(/A bug is going through the camp/.test(src) && /Everyone feels terrible/.test(src),
  'the card still says a bug is going through the camp');
ok(block && /population/.test(block[1]),
  'HV-164: the sickness effect reads the camp size');
ok(block && /heads\s*-?\s*1/.test(block[1]),
  'HV-164: extra residents take an extra dose');
ok(!/sickness/.test(ui),
  'ui.js is untouched — the camp-size hit is not a HUD rewrite');

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
    if (!sessionStorage.getItem('hvsickcamp-init')) {
      sessionStorage.setItem('hvsickcamp-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const hit = (pop, roll) => page.evaluate(({ pop, roll }) => {
    const ev = EVENTS_BAD.find(e => e.id === 'sickness');
    const real = Math.random;
    Math.random = () => roll;
    G.population = pop;
    G.health = 100;
    G.food = 40;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return {
      health: G.health,
      food: G.food,
      morale: G.morale,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, { pop, roll });

  const solo = await hit(1, 0);
  ok(solo.banner === 'Illness Spreading',
    `the card still titles itself Illness Spreading (${solo.banner})`);
  ok(/bug is going through the camp/i.test(solo.body),
    'the body still names the camp');
  ok(solo.health === 88 && solo.food === 38,
    `a solo camp still takes the original low roll (100→${solo.health} health, 40→${solo.food} food)`);

  const village = await hit(5, 0);
  ok(village.health < solo.health && village.food < solo.food,
    `HV-164: a camp of five takes a harder hit than a solo camp (${village.health} health / ${village.food} food vs ${solo.health} / ${solo.food})`);
  ok(village.health === 72 && village.food === 34,
    `HV-164: five heads add four extra doses (100→${village.health} health, 40→${village.food} food)`);
  ok(/5|five|all/i.test(village.log),
    `the log names the camp that caught it (${village.log.slice(-90)})`);

  const inj = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'injury');
    const real = Math.random;
    Math.random = () => 0;
    G.population = 5;
    G.health = 100;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return G.health;
  });
  ok(inj === 85,
    `Injury is still one person's limp — five residents do not multiply it (${inj})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

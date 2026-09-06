/*
 * HV-139 — Throw the Reunion said everyone who ever slept here
 * comes back through with something for the pot, then only counted
 * the chalk star and Marisol.
 *
 * The tooltip and the log both say it: everyone who ever slept here
 * comes back through, and everyone brings something for the pot.
 * The ones who can come back are the ones who left — G.ticketsSent,
 * the bus-ticket homecomings. hvReunionDish() was 2 + holds + visits
 * and never looked at that counter. A camp that sent three people
 * home paid the same pot as a camp that never bought a fare.
 *
 * Distinct from HV-42 (hvreunion — the story gate and the 2+1 dish)
 * and HV-17 (hvticket — the fare itself).
 *
 *  A. Source: the reunion still says everyone comes back; the dish
 *     adds +1 food per ticket home, cap 5.
 *  B. A camp that sent nobody home still pays the story dish only.
 *  C. Three fares home add +3 to the pot. The live throw moves food.
 *  D. ui.js is not this ticket.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives hvReunionDish() and finishAction({id:'reunion'}).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const dishFn = /function hvReunionDish\(\)\{([\s\S]*?)\n\}/.exec(cfg);
ok(!!dishFn, 'hvReunionDish is still in config.js');
ok(/everyone who ever slept here comes back/.test(cfg)
  && /everyone who ever slept here comes back/.test(player),
  'the tooltip and the log still say everyone who ever slept here comes back');
ok(dishFn && /ticketsSent/.test(dishFn[1]),
  'HV-139: the reunion dish adds the people who went home (ticketsSent)');
ok(!/ticketsSent/.test(ui) && !/hvReunionDish/.test(ui),
  'ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvback-init')) {
      sessionStorage.setItem('hvback-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-plaque');
      localStorage.removeItem('hv-visitor');
      localStorage.removeItem('hv-reunion');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // B — nobody went home: the story dish is unchanged (2+3+3 = 8)
  const alone = await t(() => {
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 3 });
    saveHvReunion({ held: 0 });
    G.ticketsSent = 0;
    G.peakPopulation = 1;
    G.population = 1;
    return { dish: hvReunionDish(), stands: hvReunionStands() };
  });
  ok(alone.stands && alone.dish === 8,
    `a camp that sent nobody home still pays the story dish only (${alone.dish})`);

  // C — three fares home add three plates
  const home = await t(() => {
    G.ticketsSent = 3;
    const dish = hvReunionDish();
    bridgeReunionHeld = false;
    G.food = 10;
    G.goalIndex = GOALS.length;
    finishAction({ id: 'reunion' });
    const logs = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      dish,
      food: G.food,
      held: loadHvReunion().held,
      log: logs.some(m => /everyone who ever slept here comes back/.test(m)
        && /\+11/.test(m)),
    };
  });
  ok(home.dish === 11,
    `three people who went home add +3 to the pot (dish ${home.dish})`);
  ok(home.food === 21 && home.held === 1 && home.log,
    `the live throw pays 11 and says they came back (food ${home.food}, held ${home.held})`);

  // Cap 5 — six fares do not make a sixth plate
  const cap = await t(() => {
    G.ticketsSent = 6;
    return hvReunionDish();
  });
  ok(cap === 13,
    `six fares home still cap at +5 (dish ${cap})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

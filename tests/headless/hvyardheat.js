/*
 * HV-245 — Sort at the scrapyard said dirty work, then a
 * heat-wave day still paid a cool-day haul.
 *
 * The posting is "Dirty work, decent haul. +5 scraps, +2 cans."
 * Heat Wave already gifts the corner (pan 1.5) and doubles a
 * busk. The yard is outdoor dirty work in that same scorcher.
 * finishAction still paid the posted +5 / +2 as if the sky
 * were clear.
 *
 * Distinct from HV-237 / #932 (rain vs the yard — that ticket
 * left heat on the posted take), HV-167 / #857 (winter vs the
 * yard), HV-189 / #879 (cold vs the yard), HV-243 / #938
 * (Deposit vs heat), HV-169 / #861 (Walk the dogs vs a
 * scorcher). This ticket is the heat vs the yard. ui.js is
 * not this ticket.
 *
 *  A. Source: the odd-job finisher still pays the scrapyard
 *     posting. Heat Wave is still named. The finisher reads
 *     scrapyd + weather==='heat' and applies 0.75. Rain and
 *     cold are not this ticket. ui.js is not this ticket.
 *  B. Live: a clear scrapyard shift still pays +5 / +2.
 *  C. Live: the same shift on heat paid the cool-day haul
 *     (the bug). After the fix it pays 0.75, and the log
 *     names the scorcher.
 *  D. Rain and cold do not steal the cut. Depot and flyers
 *     still pay their posted take in the heat.
 *  E. One run a day still holds.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction(oddJobAction()).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const oddBlock = /else if\(a\.id==='oddjob'\)\{[\s\S]*?else if\(a\.id==='mural'\)/.exec(player);
const body = oddBlock ? oddBlock[0] : '';

ok(/Dirty work, decent haul/.test(cfg) && /id:'scrapyd'/.test(cfg),
  'the scrapyard still promises a dirty +5 / +2 haul');
ok(/name:'Heat Wave'/.test(cfg) && /pan:\s*1\.5/.test(cfg),
  'Heat Wave still gifts the panhandle corner');
ok(/a\.id==='oddjob'/.test(player) && /todaysJob\(\)/.test(body),
  'the odd-job finisher still pays today’s posting');
ok(/scrapyd/.test(body) && /G\.weather==='heat'/.test(body) && /0\.75/.test(body),
  'HV-245: the scrapyard finisher cuts the haul on a heat-wave sky');
ok(!/G\.weather==='rain'/.test(body),
  'rain is not this ticket — the wet yard is #932');
ok(!/G\.weather==='cold'/.test(body),
  'cold is not this ticket — the cold yard is #879');
ok(!/scrapyd/.test(ui) || !/G\.weather==='heat'/.test(ui),
  'ui.js untouched — the heat cut lives on the odd-job haul');

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
    if (!sessionStorage.getItem('hvyardheat-init')) {
      sessionStorage.setItem('hvyardheat-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const shift = (weather, day) => t(new Function(`
    G.days = ${day};
    G.oddJobDay = -9;
    G.weather = '${weather}';
    G.structures.toolbox = false;
    G.scraps = 0; G.cans = 0; G.goodwill = 0; G.food = 0; G.morale = 50; G.rep = 0;
    const job = todaysJob();
    finishAction(oddJobAction());
    return {
      id: job.id,
      scraps: G.scraps,
      cans: G.cans,
      goodwill: G.goodwill,
      food: G.food,
      morale: G.morale,
      done: G.oddJobDay === G.days,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  `));

  const boot = await t(() => {
    G.days = 3;
    return {
      job: todaysJob().id,
      desc: ODD_JOBS.find(j => j.id === 'scrapyd') && ODD_JOBS.find(j => j.id === 'scrapyd').desc,
      heat: WEATHERS.heat && WEATHERS.heat.name,
    };
  });
  ok(boot.job === 'scrapyd' && /Dirty work/.test(boot.desc) && boot.heat === 'Heat Wave',
    `day 3 is still the scrapyard under a Heat Wave sky (${boot.job}, ${boot.heat})`);

  const clear = await shift('clear', 3);
  ok(clear.id === 'scrapyd' && clear.scraps === 5 && clear.cans === 2 && clear.done,
    `a clear-sky yard still pays +5 scraps +2 cans (${clear.scraps} / ${clear.cans})`);

  const heat = await shift('heat', 3);
  ok(heat.id === 'scrapyd' && heat.scraps === 3 && heat.cans === 1 && heat.done,
    `HV-245: a scorcher yard is +3 / +1, not the cool-day +5 / +2 (${heat.scraps} / ${heat.cans})`);
  ok(/scorcher|heat/i.test(heat.log),
    `the log names the scorcher — not a silent cut (${heat.log.slice(-90)})`);

  const rain = await shift('rain', 3);
  ok(rain.scraps === 5 && rain.cans === 2,
    `rain without heat still pays the posted haul — wet yard is #932 (${rain.scraps} / ${rain.cans})`);

  const cold = await shift('cold', 3);
  ok(cold.scraps === 5 && cold.cans === 2,
    `cold without heat still pays the posted haul — cold yard is #879 (${cold.scraps} / ${cold.cans})`);

  const depot = await shift('heat', 0);
  ok(depot.id === 'depot' && depot.goodwill === 5,
    `Unload at the depot still pays +5 goodwill in the heat (${depot.goodwill})`);

  const flyers = await shift('heat', 1);
  ok(flyers.id === 'flyers' && flyers.goodwill === 3 && flyers.morale === 54,
    `Hand out flyers still pays the posted take in the heat (${flyers.goodwill} / ${flyers.morale})`);

  const twice = await t(() => {
    G.days = 3;
    G.oddJobDay = -9;
    G.weather = 'heat';
    G.structures.toolbox = false;
    G.scraps = 0; G.cans = 0;
    finishAction(oddJobAction());
    const first = { scraps: G.scraps, cans: G.cans, day: G.oddJobDay };
    doAction(oddJobAction());
    return { first, scraps2: G.scraps, cans2: G.cans };
  });
  ok(twice.first.scraps === 3 && twice.scraps2 === 3 && twice.cans2 === 1,
    'one run a day still holds — a second yard shift is refused');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

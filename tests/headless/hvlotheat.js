/*
 * HV-252 — Weed the community lot said the garden co-op
 * shares the harvest, then a heat-wave day still paid a
 * cool-day take.
 *
 * The posting is "The garden co-op shares the harvest.
 * +4 food." Heat Wave already gifts the corner (pan 1.5)
 * and doubles a busk. Weeding is outdoor stoop work in
 * that same scorcher. finishAction still paid the posted
 * +4 as if the sky were clear.
 *
 * Distinct from HV-249 / #945 (flyers vs heat), HV-246 /
 * #942 (depot vs heat), HV-245 / #941 (scrapyard vs heat),
 * HV-243 / #938 (deposit vs heat), HV-196 / #886 (Good
 * Weather vs the Community Garden frost). This ticket is
 * the heat vs the lot. ui.js is not this ticket.
 *
 *  A. Source: the odd-job finisher still pays the gardenh
 *     posting. Heat Wave is still named. The finisher reads
 *     gardenh + weather==='heat' and applies 0.75. Depot,
 *     scrapyard, flyers, and rain are not this ticket.
 *     ui.js is not this ticket.
 *  B. Live: a clear lot still pays +4 food.
 *  C. Live: the same shift on heat paid the cool-day take
 *     (the bug). After the fix it pays 0.75, and the log
 *     names the scorcher.
 *  D. Rain and cold do not steal the cut. Depot, flyers,
 *     and the scrapyard still pay their posted take in
 *     the heat.
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

ok(/The garden co-op shares the harvest/.test(cfg) && /id:'gardenh'/.test(cfg),
  'the lot still promises the garden co-op and +4 food');
ok(/name:'Heat Wave'/.test(cfg) && /pan:\s*1\.5/.test(cfg),
  'Heat Wave still gifts the panhandle corner');
ok(/a\.id==='oddjob'/.test(player) && /todaysJob\(\)/.test(body),
  'the odd-job finisher still pays today’s posting');
ok(/gardenh/.test(body) && /G\.weather==='heat'/.test(body) && /0\.75/.test(body),
  'HV-252: the lot finisher cuts the take on a heat-wave sky');
ok(!/j\.id==='depot'/.test(body) && !/j\.id==='scrapyd'/.test(body) && !/j\.id==='flyers'/.test(body),
  'depot, scrapyard, and flyers are not this ticket — those heat cuts are #942 / #941 / #945');
ok(!/G\.weather==='rain'/.test(body) && !/G\.weather==='cold'/.test(body),
  'rain and cold are not this ticket');
ok(!/G\.weather==='heat'/.test(ui),
  'ui.js untouched — the heat cut lives on the odd-job lot');

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
    if (!sessionStorage.getItem('hvlotheat-init')) {
      sessionStorage.setItem('hvlotheat-init', '1');
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
    G.days = 2;
    return {
      job: todaysJob().id,
      desc: ODD_JOBS.find(j => j.id === 'gardenh') && ODD_JOBS.find(j => j.id === 'gardenh').desc,
      heat: WEATHERS.heat && WEATHERS.heat.name,
    };
  });
  ok(boot.job === 'gardenh' && /garden co-op shares/.test(boot.desc) && boot.heat === 'Heat Wave',
    `day 2 is still the lot under a Heat Wave sky (${boot.job}, ${boot.heat})`);

  const clear = await shift('clear', 2);
  ok(clear.id === 'gardenh' && clear.food === 4 && clear.done,
    `a clear-sky lot still pays +4 food (${clear.food})`);

  const heat = await shift('heat', 2);
  ok(heat.id === 'gardenh' && heat.food === 3 && heat.done,
    `HV-252: a scorcher lot is +3 food, not the cool-day +4 (${heat.food})`);
  ok(/scorcher|heat/i.test(heat.log),
    `the log names the scorcher — not a silent cut (${heat.log.slice(-90)})`);

  const rain = await shift('rain', 2);
  ok(rain.food === 4,
    `rain without heat still pays the posted take (${rain.food})`);

  const cold = await shift('cold', 2);
  ok(cold.food === 4,
    `cold without heat still pays the posted take (${cold.food})`);

  const depot = await shift('heat', 0);
  ok(depot.id === 'depot' && depot.goodwill === 5,
    `the depot still pays +5 goodwill in the heat — that cut is #942 (${depot.goodwill})`);

  const flyers = await shift('heat', 1);
  ok(flyers.id === 'flyers' && flyers.goodwill === 3 && flyers.morale === 54,
    `flyers still pay +3 / +4 in the heat — that cut is #945 (${flyers.goodwill} / ${flyers.morale})`);

  const yard = await shift('heat', 3);
  ok(yard.id === 'scrapyd' && yard.scraps === 5 && yard.cans === 2,
    `the scrapyard still pays +5 / +2 in the heat — that cut is #941 (${yard.scraps} / ${yard.cans})`);

  const twice = await t(() => {
    G.days = 2;
    G.oddJobDay = -9;
    G.weather = 'heat';
    G.structures.toolbox = false;
    G.food = 0;
    finishAction(oddJobAction());
    const first = G.food;
    doAction(oddJobAction());
    return { first: first, food2: G.food };
  });
  ok(twice.first === 3 && twice.food2 === 3,
    'one run a day still holds — a second lot is refused');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

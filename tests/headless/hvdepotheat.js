/*
 * HV-247 — Unload at the depot said honest lifting, then a
 * heat-wave day still paid a cool-day lift.
 *
 * The posting is "A morning of honest lifting. +5 goodwill."
 * Heat Wave already gifts the corner (pan 1.5) and doubles a
 * busk. The depot is outdoor lifting in that same scorcher.
 * finishAction still paid the posted +5 as if the sky were
 * clear.
 *
 * Distinct from HV-246 / #941 (scrapyard vs heat — that
 * ticket left the depot on the posted take), HV-243 / #938
 * (Deposit vs heat), HV-172 / #872 (depot vs cold), HV-152 /
 * #844 (depot vs night), HV-231 / #925 (depot vs Word).
 * Main already sat HV-246 as the yard vs heat, so ROADMAP
 * takes HV-247. This ticket is the heat vs the dock. ui.js
 * is not this ticket.
 *
 *  A. Source: the odd-job finisher still pays the depot
 *     posting. Heat Wave is still named. The finisher reads
 *     depot + weather==='heat' and applies 0.75. The yard's
 *     scorcher cut is HV-246 / #941. ui.js is not this ticket.
 *  B. Live: a clear depot shift still pays +5 goodwill.
 *  C. Live: the same shift on heat paid the cool-day lift
 *     (the bug). After the fix it pays 0.75, and the log
 *     names the scorcher.
 *  D. Rain and cold do not steal the cut. The scrapyard
 *     still pays its #941 scorcher cut. Flyers pay their
 *     HV-250 scorcher walk.
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

ok(/A morning of honest lifting/.test(cfg) && /id:'depot'/.test(cfg),
  'the depot still promises a morning of honest lifting for +5 goodwill');
ok(/name:'Heat Wave'/.test(cfg) && /pan:\s*1\.5/.test(cfg),
  'Heat Wave still gifts the panhandle corner');
ok(/a\.id==='oddjob'/.test(player) && /todaysJob\(\)/.test(body),
  'the odd-job finisher still pays today’s posting');
ok(/j\.id==='depot' && G\.weather==='heat'/.test(body) && /0\.75/.test(body),
  'HV-247: the depot finisher cuts the lift on a heat-wave sky');
ok(/j\.id==='scrapyd' && G\.weather==='heat'/.test(body),
  'the scrapyard still has its HV-246 / #941 scorcher cut — not this ticket');
ok(!/j\.id==='depot' && G\.weather==='rain'/.test(body) && !/j\.id==='depot' && G\.weather==='cold'/.test(body),
  'rain and cold are not this ticket — depot-vs-cold is #872');
ok(!/G\.weather==='heat'/.test(ui),
  'ui.js untouched — the heat cut lives on the odd-job lift');

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
    if (!sessionStorage.getItem('hvdepotheat-init')) {
      sessionStorage.setItem('hvdepotheat-init', '1');
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
    G.days = 0;
    return {
      job: todaysJob().id,
      desc: ODD_JOBS.find(j => j.id === 'depot') && ODD_JOBS.find(j => j.id === 'depot').desc,
      heat: WEATHERS.heat && WEATHERS.heat.name,
    };
  });
  ok(boot.job === 'depot' && /honest lifting/.test(boot.desc) && boot.heat === 'Heat Wave',
    `day 0 is still the depot under a Heat Wave sky (${boot.job}, ${boot.heat})`);

  const clear = await shift('clear', 0);
  ok(clear.id === 'depot' && clear.goodwill === 5 && clear.done,
    `a clear-sky lift still pays +5 goodwill (${clear.goodwill})`);

  const heat = await shift('heat', 0);
  ok(heat.id === 'depot' && heat.goodwill === 3 && heat.done,
    `HV-247: a scorcher lift is +3 goodwill, not the cool-day +5 (${heat.goodwill})`);
  ok(/scorcher|heat/i.test(heat.log),
    `the log names the scorcher — not a silent cut (${heat.log.slice(-90)})`);

  const rain = await shift('rain', 0);
  ok(rain.goodwill === 5,
    `rain without heat still pays the posted lift (${rain.goodwill})`);

  const cold = await shift('cold', 0);
  ok(cold.goodwill === 5,
    `cold without heat still pays the posted lift — depot-vs-cold is #872 (${cold.goodwill})`);

  const yard = await shift('heat', 3);
  ok(yard.id === 'scrapyd' && yard.scraps === 3 && yard.cans === 1,
    `the scrapyard still pays its HV-246 / #941 scorcher cut (+3 / +1) (${yard.scraps} / ${yard.cans})`);

  const flyers = await shift('heat', 1);
  ok(flyers.id === 'flyers' && flyers.goodwill === 2 && flyers.morale === 53,
    `Hand out flyers pays the HV-250 scorcher walk (+2 / +3) (${flyers.goodwill} / ${flyers.morale})`);

  const twice = await t(() => {
    G.days = 0;
    G.oddJobDay = -9;
    G.weather = 'heat';
    G.structures.toolbox = false;
    G.goodwill = 0;
    finishAction(oddJobAction());
    const first = { gw: G.goodwill, day: G.oddJobDay };
    doAction(oddJobAction());
    return { first, gw2: G.goodwill };
  });
  ok(twice.first.gw === 3 && twice.gw2 === 3,
    'one run a day still holds — a second lift is refused');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

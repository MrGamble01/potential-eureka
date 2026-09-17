/*
 * HV-250 — Hand out flyers said a local shop pays, then a
 * heat-wave day still paid a cool-day take.
 *
 * The posting is "A local shop pays a little, and the owner
 * is kind. +3 goodwill, +4 morale." Heat Wave already gifts
 * the corner (pan 1.5) and doubles a busk. Flyers are outdoor
 * walking in that same scorcher. finishAction still paid the
 * posted +3 / +4 as if the sky were clear.
 *
 * Distinct from HV-177 / #867 (rain vs flyers), HV-186 /
 * #876 (gentrify vs flyers), HV-279 / #922 (flyers vs Word),
 * HV-247 / #942 (depot vs heat), HV-246 / #941 (scrapyard vs
 * heat). Main already sat HV-249 as the fire story already
 * told (#944), so ROADMAP takes HV-250. This ticket is the
 * heat vs the shop walk. ui.js is not this ticket.
 *
 *  A. Source: the odd-job finisher still pays the flyers
 *     posting. Heat Wave is still named. The finisher reads
 *     flyers + weather==='heat' and applies 0.75. Depot and
 *     scrapyard already have their scorcher cuts. Rain is
 *     not this ticket. ui.js is not this ticket.
 *  B. Live: a clear flyers shift still pays +3 goodwill / +4
 *     morale.
 *  C. Live: the same shift on heat paid the cool-day take
 *     (the bug). After the fix it pays 0.75, and the log
 *     names the scorcher.
 *  D. Rain and cold do not steal the cut. Depot and the
 *     scrapyard still pay their #942 / #941 scorcher cuts.
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

ok(/A local shop pays a little/.test(cfg) && /id:'flyers'/.test(cfg),
  'flyers still promise a kind shop and +3 goodwill / +4 morale');
ok(/name:'Heat Wave'/.test(cfg) && /pan:\s*1\.5/.test(cfg),
  'Heat Wave still gifts the panhandle corner');
ok(/a\.id==='oddjob'/.test(player) && /todaysJob\(\)/.test(body),
  'the odd-job finisher still pays today’s posting');
ok(/j\.id==='flyers' && G\.weather==='heat'/.test(body) && /0\.75/.test(body),
  'HV-250: the flyers finisher cuts the take on a heat-wave sky');
ok(/j\.id==='depot' && G\.weather==='heat'/.test(body),
  'the depot still has its HV-247 / #942 scorcher cut — not this ticket');
ok(/j\.id==='scrapyd' && G\.weather==='heat'/.test(body),
  'the scrapyard still has its HV-246 / #941 scorcher cut — not this ticket');
ok(!/j\.id==='flyers' && G\.weather==='rain'/.test(body) && !/j\.id==='flyers' && G\.weather==='cold'/.test(body),
  'rain and cold are not this ticket — flyers-vs-rain is #867');
ok(!/G\.weather==='heat'/.test(ui),
  'ui.js untouched — the heat cut lives on the odd-job walk');

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
    if (!sessionStorage.getItem('hvflyerheat-init')) {
      sessionStorage.setItem('hvflyerheat-init', '1');
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
    G.days = 1;
    return {
      job: todaysJob().id,
      desc: ODD_JOBS.find(j => j.id === 'flyers') && ODD_JOBS.find(j => j.id === 'flyers').desc,
      heat: WEATHERS.heat && WEATHERS.heat.name,
    };
  });
  ok(boot.job === 'flyers' && /local shop pays/.test(boot.desc) && boot.heat === 'Heat Wave',
    `day 1 is still flyers under a Heat Wave sky (${boot.job}, ${boot.heat})`);

  const clear = await shift('clear', 1);
  ok(clear.id === 'flyers' && clear.goodwill === 3 && clear.morale === 54 && clear.done,
    `a clear-sky walk still pays +3 goodwill / +4 morale (${clear.goodwill} / ${clear.morale})`);

  const heat = await shift('heat', 1);
  ok(heat.id === 'flyers' && heat.goodwill === 2 && heat.morale === 53 && heat.done,
    `HV-250: a scorcher walk is +2 / +3, not the cool-day +3 / +4 (${heat.goodwill} / ${heat.morale})`);
  ok(/scorcher|heat/i.test(heat.log),
    `the log names the scorcher — not a silent cut (${heat.log.slice(-90)})`);

  const rain = await shift('rain', 1);
  ok(rain.goodwill === 3 && rain.morale === 54,
    `rain without heat still pays the posted take — flyers-vs-rain is #867 (${rain.goodwill} / ${rain.morale})`);

  const cold = await shift('cold', 1);
  ok(cold.goodwill === 3 && cold.morale === 54,
    `cold without heat still pays the posted take (${cold.goodwill} / ${cold.morale})`);

  const depot = await shift('heat', 0);
  ok(depot.id === 'depot' && depot.goodwill === 3,
    `the depot still pays its HV-247 / #942 scorcher lift (+3) (${depot.goodwill})`);

  const yard = await shift('heat', 3);
  ok(yard.id === 'scrapyd' && yard.scraps === 3 && yard.cans === 1,
    `the scrapyard still pays its HV-246 / #941 scorcher cut (+3 / +1) (${yard.scraps} / ${yard.cans})`);

  const twice = await t(() => {
    G.days = 1;
    G.oddJobDay = -9;
    G.weather = 'heat';
    G.structures.toolbox = false;
    G.goodwill = 0; G.morale = 50;
    finishAction(oddJobAction());
    const first = { gw: G.goodwill, morale: G.morale };
    doAction(oddJobAction());
    return { first, gw2: G.goodwill, morale2: G.morale };
  });
  ok(twice.first.gw === 2 && twice.gw2 === 2 && twice.morale2 === 53,
    'one run a day still holds — a second walk is refused');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

/*
 * HV-177 — Hand out flyers said a local shop pays, then a rainy day
 * still paid the full take.
 *
 * The posting is "A local shop pays a little, and the owner is kind.
 * +3 goodwill, +4 morale." Kind is a different ticket (Marisol).
 * The shop pays for paper on the sidewalk. Rain already halves the
 * panhandle corner. The flyers job never reads the sky. A wet dawn
 * still paid +3 / +4.
 *
 *  A. Source: the odd-job finish refuses flyers in the rain; ui.js
 *     is untouched.
 *  B. The posting still promises the shop pays. The crash course
 *     still says rain matters.
 *  C. A pinned rainy flyers day pays nothing. The log names the rain.
 *  D. Clear / cold / heat still pay +3 goodwill and +4 morale.
 *  E. Sort at the scrapyard still pays its haul in the rain
 *     (control — different job).
 *  F. Marisol affinity still sits (control — different ticket).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(oddJobAction()) on the production job.
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
const html = fs.readFileSync(path.join(ROOT, 'homeless-village.html'), 'utf8');
const block = /else if\(a\.id==='oddjob'\)\{([\s\S]*?)\n  \} else if\(a\.id==='mural'\)/.exec(player);
ok(!!block, 'odd-job finish is still in player.js');
ok(block && /flyers/.test(block[1]) && /weather\s*===\s*'rain'/.test(block[1]),
  'HV-177: flyers finish reads a rainy sky');
ok(/id:'flyers'[\s\S]{0,180}?A local shop pays a little/.test(cfg),
  'the posting still promises the shop pays');
ok(/rain closes the panhandling corner/.test(html),
  'the crash course still says rain matters');
ok(!/pulped the flyers/.test(ui),
  'ui.js untouched — the rain gate lives on the job');

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
    if (!sessionStorage.getItem('hvflyrain-init')) {
      sessionStorage.setItem('hvflyrain-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const runJob = (days, weather, extra) => page.evaluate(({ days, weather, extra }) => {
    G.days = days;
    G.oddJobDay = -1;
    G.weather = weather;
    G.goodwill = 10;
    G.morale = 50;
    G.scraps = 0;
    G.cans = 0;
    G.rep = 0;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.structures.toolbox = false;
    Object.assign(G, extra || {});
    const job = todaysJob();
    finishAction(oddJobAction());
    return {
      job: job.id,
      label: job.label,
      desc: job.desc,
      goodwill: G.goodwill,
      morale: G.morale,
      scraps: G.scraps,
      cans: G.cans,
      day: G.oddJobDay,
      marisol: G.regulars.marisol,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, { days, weather, extra });

  const rain = await runJob(1, 'rain');
  ok(rain.job === 'flyers' && /shop pays/i.test(rain.desc),
    `day 1 still posts flyers (${rain.job})`);
  ok(rain.goodwill === 10 && rain.morale === 50,
    `HV-177: rain pays nothing (10/50 → ${rain.goodwill}/${rain.morale})`);
  ok(rain.day === 1, 'the rainy posting still closes for the day');
  ok(/rain|pulp/i.test(rain.log),
    `the log names the rain (${rain.log.slice(-90)})`);

  const clear = await runJob(1, 'clear');
  ok(clear.goodwill === 13 && clear.morale === 54,
    `a clear day still pays +3 / +4 (${clear.goodwill}/${clear.morale})`);

  const cold = await runJob(1, 'cold');
  const heat = await runJob(1, 'heat');
  ok(cold.goodwill === 13 && cold.morale === 54 && heat.goodwill === 13 && heat.morale === 54,
    `cold and heat still pay the shop (${cold.goodwill}/${heat.goodwill})`);

  const scrap = await runJob(3, 'rain');
  ok(scrap.job === 'scrapyd' && scrap.scraps === 5 && scrap.cans === 2,
    `the scrapyard still pays its haul in the rain (${scrap.scraps}/${scrap.cans})`);

  const kind = await runJob(1, 'clear');
  ok(kind.marisol === 0,
    'Marisol affinity still sits (control — different ticket)');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

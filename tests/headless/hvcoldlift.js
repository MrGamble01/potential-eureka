/* HV-182 — a cold morning said the cold gets into everything,
 * then Unload at the depot still paid a summer lift.
 *
 * Dawn writes "The cold gets into everything — keep the fire fed."
 * Scavenge already rides weatherDef().scav (0.75 on a cold snap sky).
 * The deposit run is a different ticket. This one is the bulletin
 * posting that promises a morning of honest lifting (+5 goodwill)
 * and never reads the sky. finishAction still paid the summer lift
 * as if the dock were clear.
 *
 * A cold snap sky now halves the lift. Heat and rain are untouched.
 * Flyers, the scrapyard and the dog walk still pay in the cold.
 * The toolbox bonus still stacks. ui.js untouched.
 *
 *  A. Source: the odd-job finisher reads weather==='cold' on depot;
 *     ui.js does not.
 *  B. Source: the dawn log and the depot posting still exist.
 *  C. Live: a pinned cold depot day pays +2, and the log names the cold.
 *  D. Clear / heat / rain still pay the posted +5.
 *  E. Flyers still pay in the cold; the scrapyard still hauls.
 *  F. A toolbox still adds +2 on top of a cold lift.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const block = /else if\(a\.id==='oddjob'\)\{([\s\S]*?)\n  \} else if\(a\.id==='mural'\)/.exec(player);
const body = block ? block[1] : '';

ok(/The cold gets into everything/.test(loop),
  'dawn still writes that the cold gets into everything');
ok(/id:'depot'[\s\S]{0,180}?A morning of honest lifting/.test(cfg)
  && /gives:\{goodwill:5\}/.test(cfg),
  'the depot posting still promises a morning of honest lifting +5');
ok(body && /depot/.test(body) && /weather\s*===\s*'cold'/.test(body) && /Math\.floor/.test(body),
  'HV-182: the odd-job finisher cuts the depot lift on a cold snap sky');
ok(!/depot/.test(ui) || !/weather==='cold'/.test(ui),
  'ui.js untouched — the cold cut lives on the job');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvcoldlift-init')) {
      sessionStorage.setItem('hvcoldlift-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const runJob = (days, weather, opts) => page.evaluate(({ days, weather, opts }) => {
    G.days = days;
    G.weather = weather;
    G.oddJobDay = -1;
    G.goodwill = 10;
    G.morale = 50;
    G.scraps = 0;
    G.cans = 0;
    G.structures.toolbox = !!(opts && opts.toolbox);
    const j = todaysJob();
    finishAction(oddJobAction());
    return {
      job: j.id,
      desc: j.desc,
      goodwill: G.goodwill,
      morale: G.morale,
      scraps: G.scraps,
      cans: G.cans,
      day: G.oddJobDay,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, { days, weather, opts: opts || {} });

  // C — the cold snap sky on day 0 (depot)
  const cold = await runJob(0, 'cold');
  ok(cold.job === 'depot' && /honest lifting/i.test(cold.desc),
    `day 0 still posts the depot (${cold.job})`);
  ok(cold.goodwill === 12 && cold.day === 0,
    `HV-182: a cold lift pays half — +2🩶 (10 → ${cold.goodwill})`);
  ok(/cold got into the lift|cold got into everything/i.test(cold.log),
    `the log names the cold on the lift (${cold.log.slice(-90)})`);

  // D — other skies still pay the posted +5
  const clear = await runJob(0, 'clear');
  ok(clear.goodwill === 15,
    `a clear lift still pays +5 (10 → ${clear.goodwill})`);
  const heat = await runJob(0, 'heat');
  ok(heat.goodwill === 15,
    `a scorcher lift still pays +5 (10 → ${heat.goodwill})`);
  const rain = await runJob(0, 'rain');
  ok(rain.goodwill === 15,
    `a rainy lift still pays +5 (10 → ${rain.goodwill})`);

  // E — other postings still pay in the cold
  const flyers = await runJob(1, 'cold');
  ok(flyers.job === 'flyers' && flyers.goodwill === 13 && flyers.morale === 54,
    `flyers still pay in the cold (${flyers.goodwill}/${flyers.morale})`);
  const scrap = await runJob(3, 'cold');
  ok(scrap.job === 'scrapyd' && scrap.scraps === 5 && scrap.cans === 2,
    `the scrapyard still hauls in the cold (${scrap.scraps}/${scrap.cans})`);

  // F — toolbox bonus still stacks on a cold lift
  const tools = await runJob(0, 'cold', { toolbox: true });
  ok(tools.goodwill === 14,
    `a toolbox still adds +2 on a cold lift (10 → ${tools.goodwill})`);

  await page.screenshot({ path: '/tmp/hvcoldlift.png', fullPage: true });

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/*
 * HV-198 — Forage Area said cardboard and wood, then a rainy
 * day still paid a dry-day haul.
 *
 * The forage tooltip says "Search the surroundings for cardboard
 * and wood." finishAction rolls wood 1–4 and cardboard 2–6 with
 * no weather. Rain soaks cardboard — the same search on a wet
 * morning paid the clear-day sheet count. Scavenge already rides
 * weatherDef().scav. Forage never did.
 *
 * Distinct from #806 (cold forage), #850 (winter forage),
 * HV-63 / hvlock (Dumpsters Locked also gates forage), #869
 * (Busk vs rain), and the rain-on-delivery tickets (#881
 * tamales, #884 Kind Stranger). This ticket is wet cardboard.
 * ui.js is not this ticket.
 *
 *  A. Source: finishAction's forage branch cuts cardboard on rain.
 *     The tooltip still promises cardboard and wood.
 *  B. Pinned rolls: a clear day pays the full sheet count; the
 *     same rolls in rain pay half cardboard (floor, at least 1).
 *     Wood is unchanged.
 *  C. Heat and cold keep the dry-day cardboard — the cut is rain.
 *  D. Dumpsters Locked still refuses forage. A clear day still
 *     pays wood + cardboard.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction + doAction on the production path.
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
const finishAt = player.indexOf('function finishAction(a){');
const nextFn = player.indexOf('\nfunction doCraft(', finishAt);
const finishBlock = finishAt >= 0 && nextFn > finishAt ? player.slice(finishAt, nextFn) : '';
const forageAt = finishBlock.indexOf("a.id==='forage'");
const forageEnd = finishBlock.indexOf('} else if', forageAt);
const forageBlock = forageAt >= 0 ? finishBlock.slice(forageAt, forageEnd > forageAt ? forageEnd : forageAt + 400) : '';

ok(/Search the surroundings for cardboard and wood/.test(cfg),
  'Forage Area still promises cardboard and wood');
ok(forageAt >= 0, 'finishAction still has a forage branch');
ok(/weather\s*===\s*'rain'|G\.weather==='rain'/.test(forageBlock) && /cardboard/.test(forageBlock),
  'HV-198: forage cuts cardboard when the sky is rain');
ok(/homeless-village\/js\/ui\.js/.test(player) === false,
  'the rain cut lives in finishAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvforagerain-init')) {
      sessionStorage.setItem('hvforagerain-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    const tip = (ACTIONS.find(a => a.id === 'forage') || {}).tooltip || '';
    return { tip: tip, row: ACTIONS.some(a => a.id === 'forage') };
  });
  ok(/cardboard and wood/.test(boot.tip) && boot.row,
    `the tooltip still searches for cardboard and wood (${boot.tip.slice(0, 48)})`);

  const haul = (weather, roll) => page.evaluate(({ weather, roll }) => {
    const real = Math.random;
    let n = 0;
    Math.random = () => { n += 1; return roll; };
    G.weather = weather;
    G.season = 0;
    G.wood = 0;
    G.cardboard = 0;
    G.cooldowns = {};
    if (activeJobs.forage) delete activeJobs.forage;
    finishAction({ id: 'forage', cooldown: 0, time: 0 });
    Math.random = real;
    return { wood: G.wood, card: G.cardboard, rolls: n };
  }, { weather, roll });

  // rand(1,4) and rand(2,6) both max when random → 0.99
  const clearMax = await haul('clear', 0.99);
  const rainMax = await haul('rain', 0.99);
  ok(clearMax.wood === 4 && clearMax.card === 6,
    `a clear day still pays the full haul (wood ${clearMax.wood}, card ${clearMax.card})`);
  ok(rainMax.wood === 4 && rainMax.card === 3,
    `HV-198: the same rolls in rain pay half cardboard (wood ${rainMax.wood}, card ${rainMax.card})`);

  // mins: random → 0 → wood 1, card 2 → rain card max(1, floor(2/2)) = 1
  const clearMin = await haul('clear', 0);
  const rainMin = await haul('rain', 0);
  ok(clearMin.wood === 1 && clearMin.card === 2,
    `a clear-day floor still pays 1 wood and 2 cardboard (${clearMin.wood}, ${clearMin.card})`);
  ok(rainMin.wood === 1 && rainMin.card === 1,
    `rain never zeroes the sheets (wood ${rainMin.wood}, card ${rainMin.card})`);

  const otherSky = await page.evaluate(() => {
    const real = Math.random;
    const run = (w) => {
      Math.random = () => 0.99;
      G.weather = w; G.season = 0; G.wood = 0; G.cardboard = 0;
      finishAction({ id: 'forage', cooldown: 0, time: 0 });
      return { wood: G.wood, card: G.cardboard };
    };
    const heat = run('heat');
    const cold = run('cold');
    Math.random = real;
    return { heat, cold };
  });
  ok(otherSky.heat.wood === 4 && otherSky.heat.card === 6,
    `heat keeps the dry-day cardboard (${otherSky.heat.card}) — the cut is rain`);
  ok(otherSky.cold.wood === 4 && otherSky.cold.card === 6,
    `cold keeps the dry-day cardboard (${otherSky.cold.card}) — that sky is another ticket`);

  const lock = await page.evaluate(() => {
    G.dumpsterLockDay = G.days;
    G.cooldowns = {};
    if (activeJobs.forage) delete activeJobs.forage;
    doAction(ACTIONS.find(a => a.id === 'forage'));
    const started = !!activeJobs.forage;
    if (activeJobs.forage) delete activeJobs.forage;
    G.dumpsterLockDay = -1;
    return { started: started };
  });
  ok(!lock.started, 'Dumpsters Locked still refuses forage');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

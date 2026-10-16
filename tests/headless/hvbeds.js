/*
 * HV-190 — the Community Garden said each day, then an empty
 * larder bit before the beds paid.
 *
 * The garden's card is food each day. An empty pot costs health
 * at dawn. onNewDay runs the empty-larder bite, then the harvest.
 * A garden on a pot the night just emptied arrives after the bite
 * is already taken. The beds pay. The camp already suffered.
 *
 * Distinct from HV-64 (#716: soup after the drain), HV-67 (#721:
 * cook after hunger), HV-184 (#874: Marisol leftovers vs Biscuit),
 * HV-102 (the bite itself missing), and the garden weather tour
 * (#855 heat, #858 winter). This is the beds × the empty pot.
 *
 *  A. Source: the garden harvest runs before the empty-larder bite.
 *  B. The garden still promises food each day.
 *  C. An empty pot still costs health when the beds are gone.
 *  D. Empty pot, garden, pinned yield: he wakes fed, not bitten.
 *  E. A stocked pot still pays the harvest on top.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay on the production dawn path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const onNew = /function onNewDay\(\)\{([\s\S]*?)\nfunction /.exec(loop);
const body = onNew ? onNew[1] : '';
const larderAt = body.indexOf('if(G.food<=0)');
const bedsAt = body.indexOf('G.structures.garden');
ok(!!onNew && larderAt >= 0 && bedsAt >= 0,
  'onNewDay still harvests the garden and bites an empty pot');
ok(bedsAt >= 0 && larderAt >= 0 && bedsAt < larderAt,
  'HV-190: the garden harvest lands before the empty-larder bite');
ok(/Slowly generates food each day/.test(cfg),
  'the Community Garden still promises food each day');

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
    if (!sessionStorage.getItem('hvbeds-init')) {
      sessionStorage.setItem('hvbeds-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (opts) => page.evaluate((o) => {
    const lines = [];
    const realLog = log;
    log = function (s) { lines.push(String(s)); realLog(s); };
    const real = Math.random;
    Math.random = () => o.roll;
    G.dog = 0;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.food = o.food;
    G.population = 1;
    G.health = 90; G.warmth = 90; G.morale = 50;
    G.workers = { scrapper: false, builder: false, cook: false, lookout: false };
    G.structures.garden = !!o.garden;
    G.structures.compost = false;
    G.structures.soup_kitchen = false;
    G.structures.pantry = false;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.barrel = false;
    G.forecast = 'clear'; G.weather = 'clear'; G.season = 0;
    G.lastEventDay = G.days + 5;
    G.goalIndex = GOALS.length;
    G.snapUntil = null; G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false;
    onNewDay();
    Math.random = real;
    log = realLog;
    return {
      food: G.food,
      health: G.health,
      log: lines.join(' '),
    };
  }, opts);

  // roll 0.5: rand(1,3) → 2; rand(4,10) → 7
  const late = await dawn({ garden: true, food: 0, roll: 0.5 });
  ok(/Garden yielded 2 food/.test(late.log),
    'the beds still pay on an empty pot');
  ok(late.health === 90 && late.food === 2,
    `the harvest feeds the pot first (health=${late.health}, food=${late.food})`);
  ok(late.health === 90,
    'the empty-larder bite does not fire when the beds made breakfast');

  const bare = await dawn({ garden: false, food: 0, roll: 0.5 });
  ok(bare.health === 83 && bare.food === 0 && !/Garden yielded/.test(bare.log),
    `no garden still bites (health=${bare.health}, food=${bare.food})`);

  const stocked = await dawn({ garden: true, food: 10, roll: 0.5 });
  ok(stocked.health === 90 && stocked.food === 10.5 && /Garden yielded 2 food/.test(stocked.log),
    `a stocked pot still pays 10 − 1.5 + 2 = 10.5 (${stocked.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

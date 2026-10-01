/*
 * HV-274 — the Free Pantry said someone left a little something
 * overnight, then an empty larder bit before the box filled.
 *
 * The pantry's card is an overnight gift: a neighbor left food in
 * the box while the camp slept. An empty pot costs health at dawn.
 * onNewDay runs the empty-larder bite, then pantryAtDawn, so a box
 * that already held breakfast arrives after the camp has taken the
 * hit. The box pays. The camp already suffered.
 *
 * Distinct from HV-190 (#880: the garden harvest × the empty pot —
 * your beds, "each day"). Cook and soup stay after the bite (HV-67
 * / HV-64). Rain on the same box is #956. A named snap is #893.
 * This is their overnight gift × the empty pot.
 *
 *  A. Source: the pantry still promises an overnight leave.
 *  B. Source: pantryAtDawn currently lands after the empty-larder bite.
 *  C. ui.js is not this ticket.
 *  D. Empty pot, pantry, pinned fill: the box still pays +2.
 *  E. The same dawn still bites health — the gift arrived late.
 *  F. No pantry still bites; a stocked pot still gets +2 on top.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const onNew = /function onNewDay\(\)\{([\s\S]*?)\nfunction /.exec(loop);
const body = onNew ? onNew[1] : '';
const larderAt = body.indexOf('if(G.food<=0)');
const boxAt = body.indexOf('pantryAtDawn()');

ok(/someone left a little something/i.test(loop)
  && /overnight/i.test(loop)
  && /Some dawns the neighborhood leaves something/.test(cfg),
  'the Free Pantry still promises an overnight leave');
ok(!!onNew && larderAt >= 0 && boxAt >= 0,
  'onNewDay still fills the pantry and bites an empty pot');
ok(boxAt >= 0 && larderAt >= 0 && boxAt < larderAt,
  'HV-274: the overnight box lands before the empty-larder bite');
ok(!/pantryAtDawn/.test(ui) && !/if\(G\.food<=0\)/.test(ui),
  'ui.js untouched — the cut lives on the dawn path');

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
    if (!sessionStorage.getItem('hvovernight-init')) {
      sessionStorage.setItem('hvovernight-init', '1');
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
    G.structures.garden = false;
    G.structures.compost = false;
    G.structures.soup_kitchen = false;
    G.structures.pantry = !!o.pantry;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.barrel = false;
    G.pantryFills = 0;
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
      fills: G.pantryFills,
      log: lines.join(' '),
    };
  }, opts);

  // roll 0.4: pantry chance 0.5 fills; rand(4,10) → 6 if the bite fires
  const late = await dawn({ pantry: true, food: 0, roll: 0.4 });
  ok(/left a little something/.test(late.log) && late.fills === 1 && late.food === 2,
    `the overnight box still pays +2 (food=${late.food}, fills=${late.fills})`);
  ok(late.health === 90,
    `HV-274: the gift feeds the pot first (health=${late.health})`);
  ok(late.health === 90 && late.food === 2,
    'the empty-larder bite does not fire when the box already held breakfast');

  const bare = await dawn({ pantry: false, food: 0, roll: 0.4 });
  ok(bare.health === 84 && bare.food === 0 && !/left a little something/.test(bare.log),
    `no pantry still bites (health=${bare.health}, food=${bare.food})`);

  const stocked = await dawn({ pantry: true, food: 10, roll: 0.4 });
  ok(stocked.health === 90 && stocked.food === 10.5 && /left a little something/.test(stocked.log),
    `a stocked pot still pays 10 − 1.5 + 2 = 10.5 (${stocked.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

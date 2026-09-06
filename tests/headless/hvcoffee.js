/*
 * HV-114 — Pass the Thermos said the coffee goes further, then
 * never moved warmth.
 *
 * The gate is named thermosHasWarmth(). The refuse says the
 * thermos is cold — this bridge has no story to warm it yet.
 * The tooltip says the deeper the memory, the further the coffee
 * goes. finishAction only lifted morale. Coffee going around the
 * fire is warmth. G.warmth never moved.
 *
 * Distinct from HV-35 (hvthermos): that suite only pins morale
 * and the tally. Distinct from HV-93 (#761): that is the dawn
 * rearm of thermosUsed. Distinct from HV-113 (#797): that is the
 * bench's "something warm."
 *
 *  A. Source: the thermos pay branch lifts warmth
 *     (THERMOS_WARMTH / G.warmth).
 *  B. The tooltip still promises coffee. The refuse still talks
 *     about warming it. ui.js is untouched.
 *  C. A cold thermos and Read the Wall do not lift warmth.
 *  D. A paid pass lifts morale AND warmth; the log names warmth.
 *  E. A second pass the same session does not pay again.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'thermos'}) on the production path.
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

const branch = /else if\(a\.id==='thermos'\)\{([\s\S]*?)else if\(a\.id==='marisol'\)/.exec(player);
ok(!!branch, 'the thermos branch is still in player.js');
const pay = branch && /else \{\s*thermosUsed=true;([\s\S]*?)saveGame\(\);/.exec(branch[1]);
ok(pay && /G\.warmth/.test(pay[1]) && /THERMOS_WARMTH/.test(pay[1]),
  'HV-114: a pass lifts warmth — coffee going around the fire is supposed to warm someone');
ok(/THERMOS_WARMTH\s*=\s*3/.test(cfg),
  'THERMOS_WARMTH is 3 beside the heirloom constants');
ok(/id:'thermos'[\s\S]{0,500}?coffee goes/.test(cfg) &&
   /no story to warm it yet/.test(player),
  'the tooltip still promises coffee; the refuse still talks about warming it');
ok(!/THERMOS_WARMTH/.test(ui), 'ui.js is untouched');

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
    if (!sessionStorage.getItem('hvcoffee-init')) {
      sessionStorage.setItem('hvcoffee-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-thermos');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-visitor');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const cold = await t(() => {
    thermosUsed = false;
    G.goalIndex = GOALS.length;
    G.morale = 50;
    G.warmth = 50;
    finishAction({ id: 'thermos' });
    return {
      tip: ACTIONS.find(a => a.id === 'thermos').tooltip,
      warmth: G.warmth,
      morale: G.morale,
      uses: loadThermos().uses,
    };
  });
  ok(/coffee/.test(cold.tip), 'the live tooltip still says the coffee goes further');
  ok(cold.warmth === 50 && cold.morale === 50 && cold.uses === 0,
    `a cold thermos refuses — warmth stays put (${cold.warmth})`);

  const wall = await t(() => {
    saveHvRec({ days: 1, beats: 0 });
    saveHvNote({ read: 0 });
    G.warmth = 50;
    G.morale = 50;
    finishAction({ id: 'wall' });
    return { warmth: G.warmth, morale: G.morale };
  });
  ok(wall.warmth === 50,
    `Read the Wall is still numbers, not coffee (warmth ${wall.warmth})`);

  const seam = await t(() => {
    thermosUsed = false;
    saveHvRec({ days: 1, beats: 0 });
    saveHvNote({ read: 0 });
    saveThermos({ uses: 0 });
    G.goalIndex = GOALS.length;
    G.morale = 50;
    G.warmth = 50;
    const power = thermosPower();
    const lift = typeof THERMOS_WARMTH === 'number' ? THERMOS_WARMTH : 3;
    finishAction({ id: 'thermos' });
    const logs = Array.from(document.querySelectorAll('#log-feed .log-line')).map(el => el.textContent);
    return {
      morale: G.morale,
      warmth: G.warmth,
      power,
      lift,
      uses: loadThermos().uses,
      log: logs[logs.length - 1] || '',
    };
  });
  ok(seam.morale === 50 + seam.power && seam.uses === 1,
    `the pass still lifts morale by the power (${seam.morale}, uses ${seam.uses})`);
  ok(seam.warmth === 50 + seam.lift,
    `HV-114: a pass lifts warmth by ${seam.lift} (50 → ${seam.warmth})`);
  ok(new RegExp('\\+' + seam.lift).test(seam.log) && /warm/.test(seam.log),
    `the log names the warmth (${seam.log.slice(-90)})`);

  const again = await t(() => {
    const morale = G.morale, warmth = G.warmth, uses = loadThermos().uses;
    finishAction({ id: 'thermos' });
    return { morale: G.morale, warmth: G.warmth, uses: loadThermos().uses, before: { morale, warmth, uses } };
  });
  ok(again.morale === again.before.morale && again.warmth === again.before.warmth && again.uses === again.before.uses,
    'a second pass the same session does not pay again');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

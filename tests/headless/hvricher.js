/*
 * HV-250 — Rain said richer dumpster yield, then a wet day
 * emptied a dry-day bin.
 *
 * Weather scav is a multiplier on dumpster yield. Rain is 1.25 —
 * a wet alley runs richer, not emptier. The empty gate multiplied
 * that same 1.25, so a 0.22 roll that paid on a clear day came up
 * Nothing today in the rain (threshold .20 → .25).
 *
 * Named-snap yield is not this card. Forage in the rain is not
 * this card. Ray still halves empties. Winter still halves the
 * haul. ui.js is not this ticket.
 *
 *  A. Source: scav is still a yield multiplier; rain is 1.25.
 *  B. Source: the empty gate keeps winter and Ray, not rain's scav.
 *  C. The same 0.22 roll pays on a clear day and on a rainy day.
 *  D. A rainy paying dig still fattens the haul (4 scraps → 5).
 *  E. A 0.15 roll is still empty on rain and on clear.
 *  F. Ray's friend still halves empties on a wet day.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction('scavenge') on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const finishAt = player.indexOf('function finishAction');
const finish = finishAt >= 0 ? player.slice(finishAt) : '';
const scavAt = finish.indexOf("if(a.id==='scavenge')");
const forageAt = finish.indexOf("if(a.id==='forage')");
const scavBlock = scavAt >= 0 && forageAt > scavAt ? finish.slice(scavAt, forageAt) : '';

ok(/scav: multiplier on dumpster yield/.test(config),
  'weather scav is still a multiplier on dumpster yield');
ok(/rain:[\s\S]{0,80}scav:1\.25/.test(config),
  'rain still fattens dumpster yield by 1.25');
ok(/weatherDef\(\)\.scav/.test(scavBlock) && /\*wm/.test(scavBlock),
  'a paying dig still scales the haul by wm');
ok(/Math\.random\(\)<\.2\*\(G\.season===3\?\.5:1\)\*\(regularStage\('ray'\)===2\?\.5:1\)/.test(scavBlock),
  'HV-250: the empty gate keeps winter and Ray, not rain\'s scav');
ok(!/\.2\*wm/.test(scavBlock),
  'the empty roll does not multiply wm');
ok(!/homeless-village\/js\/ui\.js/.test(player) && !/homeless-village\/js\/ui\.js/.test(config),
  'the empty gate lives on scavenge — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvricher-init')) {
      sessionStorage.setItem('hvricher-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dig = (weather, emptyRoll, ray) => page.evaluate(({ weather, emptyRoll, ray }) => {
    let i = 0;
    const seq = [emptyRoll, 0.99, 0.99, 0.9];
    const real = Math.random;
    Math.random = () => seq[Math.min(i++, seq.length - 1)];
    G.weather = weather;
    G.season = 0;
    G.regulars = G.regulars || { marisol: 0, ray: 0, dee: 0 };
    G.regulars.ray = ray;
    G.cooldowns = {};
    G.cans = 0; G.scraps = 0; G.food = 0;
    G.dumpsterLockDay = -1;
    finishAction(ACTIONS.find(a => a.id === 'scavenge'));
    Math.random = real;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      scraps: G.scraps,
      cans: G.cans,
      food: G.food,
      empty: lines.some(l => l.includes('Nothing today')),
      last: lines[lines.length - 1] || '',
    };
  }, { weather, emptyRoll, ray });

  const clearPay = await dig('clear', 0.22, 0);
  ok(!clearPay.empty && clearPay.scraps === 4,
    `clear 0.22 still pays a dry-day haul (empty=${clearPay.empty}, scraps=${clearPay.scraps})`);

  const rainPay = await dig('rain', 0.22, 0);
  ok(!rainPay.empty,
    `HV-250: rain 0.22 pays — it does not empty a dry-day bin (${rainPay.last})`);
  ok(rainPay.scraps === 5,
    `a rainy paying dig still fattens the haul (4 → ${rainPay.scraps})`);

  const rainMiss = await dig('rain', 0.15, 0);
  const clearMiss = await dig('clear', 0.15, 0);
  ok(rainMiss.empty && rainMiss.scraps === 0,
    `rain 0.15 is still empty (empty=${rainMiss.empty})`);
  ok(clearMiss.empty && clearMiss.scraps === 0,
    `clear 0.15 is still empty (empty=${clearMiss.empty})`);

  const rayWet = await dig('rain', 0.12, 5);
  ok(!rayWet.empty && rayWet.scraps > 0,
    `Ray's friend still halves empties on a wet day (0.12 pays, scraps=${rayWet.scraps})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

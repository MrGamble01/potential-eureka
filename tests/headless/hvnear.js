/*
 * HV-131 — Old Ray said Rest nearby, then a rest across the lot
 * still counted as company.
 *
 * Ray's roster line is "Rest nearby — he likes the company." Rest
 * recovered health and morale anywhere, then always called
 * bumpRegular('ray'). Standing by the barrel and standing at the
 * far dumpster were the same friendship. Scavenge already knows how
 * to be a walk-up. Rest did not.
 *
 *  A. Source: the rest branch asks restNearRay (or a fire-distance
 *     gate) before it bumps Ray.
 *  B. The two barrel spots and the range are the camp's fires.
 *  C. A rest next to the fire still bumps Ray and still heals.
 *  D. A rest across the lot heals and does not bump Ray.
 *  E. Isolation: Trade still names Marisol; Ray's empty-haul perk
 *     is untouched; Dee's dawn latch is still <30.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'rest'}) on the production path.
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
const rest = /else if\(a\.id==='rest'\)\{[\s\S]*?else if\(a\.id==='trade'\)/.exec(player);
ok(!!rest, 'the rest branch is still in finishAction');
ok(rest && /restNearRay\s*\(/.test(rest[0]) && /bumpRegular\s*\(\s*'ray'\s*\)/.test(rest[0]),
  'HV-131: rest asks restNearRay before it bumps Ray');
ok(/FIRE_SPOTS/.test(cfg) && /REST_NEAR/.test(cfg) && /function restNearRay/.test(cfg),
  'the fire spots and the nearby gate live in config.js');

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
    if (!sessionStorage.getItem('hvnear-init')) {
      sessionStorage.setItem('hvnear-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const spots = await t(() => {
    if (typeof FIRE_SPOTS === 'undefined' || typeof restNearRay !== 'function') {
      return { n: 0, first: null, range: 0, spawn: false };
    }
    return {
      n: FIRE_SPOTS.length,
      first: FIRE_SPOTS[0],
      range: REST_NEAR,
      spawn: restNearRay(),
    };
  });
  ok(spots.n === 2 && spots.first && spots.first.x === -3 && spots.first.z === 0 && spots.range === 3.2,
    `two fires, first at the west barrel, range 3.2 (${spots.n}, ${spots.range})`);
  ok(spots.spawn, 'spawn next to the west barrel still counts as nearby');

  // C — rest by the fire
  const near = await t(() => {
    player.position.x = -3; player.position.z = 0;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.health = 50; G.morale = 40; G.goalIndex = GOALS.length;
    finishAction({ id: 'rest' });
    return { ray: G.regulars.ray, health: G.health, morale: G.morale };
  });
  ok(near.ray === 1 && near.health > 50 && near.morale > 40,
    `a rest by the fire bumps Ray and heals (ray ${near.ray}, hp ${near.health})`);

  // D — rest across the lot
  const far = await t(() => {
    player.position.x = 10; player.position.z = 6;
    G.regulars = { marisol: 0, ray: 4, dee: 0 };
    G.health = 50; G.morale = 40;
    finishAction({ id: 'rest' });
    return {
      ray: G.regulars.ray, health: G.health, morale: G.morale,
      near: typeof restNearRay === 'function' ? restNearRay() : true,
    };
  });
  ok(!far.near, 'the far dumpster corner is not nearby');
  ok(far.health > 50 && far.morale > 40,
    `a rest across the lot still heals (hp ${far.health})`);
  ok(far.ray === 4,
    `a rest across the lot does not count as Ray's company (ray ${far.ray})`);

  // E — isolation
  const iso = await t(() => {
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.cans = 30;
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    return {
      named: G.regulars.marisol,
      deeLatch: /G\.health\s*<\s*30/.test(String(regularFavorsAtDawn)),
      how: regularDef('ray').how,
      perk: /regularStage\('ray'\)===2\s*\?\.5:1/.test(String(finishAction)),
    };
  });
  ok(iso.named === 1, `Trade still names Marisol (affinity ${iso.named})`);
  ok(iso.perk && /nearby/i.test(iso.how),
    'Ray still points out dumpsters; the roster still says Rest nearby');
  ok(iso.deeLatch, 'Dee\'s dawn latch is still health < 30 — HV-115 owns the shape');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

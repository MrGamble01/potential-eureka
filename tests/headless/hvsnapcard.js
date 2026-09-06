/*
 * HV-72 — the Cold Snap card never started a cold snap.
 *
 * The event is titled "Cold Snap." The goal is "Weather 2 cold snaps"
 * (G.snapsSurvived, written only when snapAtDawn breaks G.snapUntil).
 * The card's effect was an instant warmth/health/morale hit that left
 * snapUntil untouched. hvsnap only drives snapAtDawn(), so the seam
 * was invisible. The card said tonight — the snap should grip for the
 * rest of this day and count when it breaks.
 *
 *  A. Source: the cold_snap effect assigns G.snapUntil.
 *  B. The card is still titled Cold Snap.
 *  C. Firing it starts snapActive(); the tally does not jump yet.
 *  D. The next break counts as weathering a snap.
 *  E. Theft does not start a snap. An already-gripping snap is not
 *     overwritten.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production event.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const block = /id:'cold_snap'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'cold_snap event is still in gameloop.js');
ok(block && /G\.snapUntil\s*=/.test(block[1]),
  'HV-72: cold_snap effect assigns G.snapUntil');
ok(/title:'Cold Snap'/.test(src), 'the card is still titled Cold Snap');

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
    if (!sessionStorage.getItem('hvsnapcard-init')) {
      sessionStorage.setItem('hvsnapcard-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const fired = await t(() => {
    SNAP_CHANCE = 0;
    G.snapUntil = null;
    G.snapsSurvived = 0;
    G.warmth = 80; G.health = 80; G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    const days = G.days;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'cold_snap'), false);
    return {
      active: snapActive(),
      until: G.snapUntil,
      days,
      survived: G.snapsSurvived,
      warmth: G.warmth,
      health: G.health,
      morale: G.morale,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
    };
  });
  ok(fired.banner === 'Cold Snap', `the card still titles itself Cold Snap (${fired.banner})`);
  ok(/tonight/i.test(fired.body), 'the body still says tonight');
  ok(fired.active && fired.until === fired.days + 1,
    `the card starts tonight's snap (active=${fired.active}, until=${fired.until}, days=${fired.days})`);
  ok(fired.survived === 0, `the tally does not jump on the card (${fired.survived})`);
  ok(fired.warmth < 80 && fired.health < 80 && fired.morale < 50,
    `the instant hit still lands (${fired.warmth}/${fired.health}/${fired.morale})`);

  const broke = await t(() => {
    SNAP_CHANCE = 0;
    G.season = 0;
    G.days = G.snapUntil;
    G.morale = 50;
    const survivedBefore = G.snapsSurvived;
    snapAtDawn();
    return {
      active: snapActive(),
      until: G.snapUntil,
      survived: G.snapsSurvived,
      morale: G.morale,
      survivedBefore,
    };
  });
  ok(!broke.active && broke.until === null && broke.survived === broke.survivedBefore + 1 && broke.morale === 54,
    `the next break weathers it: tally ${broke.survivedBefore} → ${broke.survived}, morale ${broke.morale}`);

  const theft = await t(() => {
    G.snapUntil = null;
    G.cans = 0; G.food = 0; G.scraps = 0;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'theft'), false);
    return { active: snapActive(), until: G.snapUntil };
  });
  ok(!theft.active && (theft.until === null || theft.until === undefined),
    'Theft does not start a snap');

  const held = await t(() => {
    G.days = 10;
    G.snapUntil = 12;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'cold_snap'), false);
    return { until: G.snapUntil, active: snapActive() };
  });
  ok(held.until === 12 && held.active,
    `an already-gripping snap is not overwritten (until=${held.until})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

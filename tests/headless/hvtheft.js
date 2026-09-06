/*
 * HV-148 — Theft said they raided your stash, then left the wood.
 *
 * The card title is "Theft." The body says someone raided your stash
 * in the night. The effect takes cans, food and scraps. Crash course
 * names firewood as the cold-kill counter; the woodpile sits next to
 * the stash. Thieves never touched it. Complementary to #742 (sweep
 * left cans) and #834 (church gift left wood): this is a raid, and
 * it already has a cans lane.
 *
 *  A. Source: theft effect assigns G.wood-=.
 *  B. The card is still titled Theft / raided your stash.
 *  C. A pinned roll cuts the woodpile (and still cuts cans / food).
 *  D. A City Sweep still does not take wood. Kind Stranger is still
 *     a food drop and does not steal wood.
 *  E. ui.js is untouched.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'theft'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'theft event is still in gameloop.js');
ok(block && /G\.wood\s*=/.test(block[1]),
  'HV-148: Theft said they raided your stash, then left the wood');
ok(/title:'Theft'/.test(src) && /raided your stash/i.test(src),
  'the card is still titled Theft and still names the stash');
ok(!/id:'theft'/.test(ui) && !/G\.wood\s*=/.test(ui),
  'ui.js is untouched — theft wood is not drawn there');

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
    if (!sessionStorage.getItem('hvtheft-init')) {
      sessionStorage.setItem('hvtheft-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // Math.random=0.99 → scraps/food/cans/wood all lose a visible slice.
  const raid = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    const real = Math.random;
    Math.random = () => 0.99;
    G.cans = 20; G.food = 20; G.scraps = 20; G.wood = 20;
    G.dog = 0; G.structures.stash = false;
    if (G.petitions) G.petitions.streetlight = false;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return {
      cans: G.cans,
      food: G.food,
      scraps: G.scraps,
      wood: G.wood,
      morale: G.morale,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
    };
  });

  ok(raid.banner === 'Theft', `the card still titles itself Theft (${raid.banner})`);
  ok(/stash/i.test(raid.body),
    `the body still names the stash (${raid.body.slice(0, 80)})`);
  ok(raid.cans < 20, `cans still leave (20 → ${raid.cans})`);
  ok(raid.food < 20, `food still leaves (20 → ${raid.food})`);
  ok(raid.scraps < 20, `scraps still leave (20 → ${raid.scraps})`);
  ok(raid.morale < 50, `morale still falls (${raid.morale})`);
  ok(raid.wood < 20,
    `HV-148: a high roll cuts the woodpile, not a silent stack (20 → ${raid.wood})`);

  const sweep = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    const real = Math.random;
    Math.random = () => 0.99;
    G.wood = 20; G.scraps = 20; G.food = 20;
    G.structures.tent = false; G.structures.soup_kitchen = false;
    G.structures.workbench = false; G.structures.garden = false;
    G.structures.stash = false; G.garageCover = false; G.packedUp = false;
    G.mural = 0; G.morale = 50;
    triggerEvent(ev, false);
    Math.random = real;
    return { wood: G.wood, scraps: G.scraps };
  });
  ok(sweep.wood === 20 && sweep.scraps < 20,
    `a City Sweep still does not take wood (wood=${sweep.wood} scraps=${sweep.scraps})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.wood = 10; G.food = 0;
    triggerEvent(ev, true);
    Math.random = real;
    return { wood: G.wood, food: G.food };
  });
  ok(stranger.wood === 10 && stranger.food > 0,
    `Kind Stranger is still a food drop, not a wood thief (wood=${stranger.wood} food=${stranger.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

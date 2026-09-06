/* HV-78 — City Sweep said confiscate supplies and left the cans.
 *
 * The card promises: "They destroy shelters and confiscate supplies."
 * The effect took scraps and food. Cans — the dumpster haul, the
 * Trade Goods pile, the thing Theft already steals — sat in the open
 * while the police cleared the camp.
 *
 * Same family as HV-70 (Found $5 paid a random handful): the card
 * named the goods and the code skipped the obvious one.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the sweep effect subtracts G.cans with the same keep
 *    (Pack Up / stash / garage) as food. ui.js is not touched.
 * B. Behaviour: an uncovered sweep with random=0.5 takes 7 of 20
 *    cans (food's coefficient). A garage cover still saves them.
 *    Isolation: scraps and food still move.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const sweepAt = loop.indexOf("id:'sweep'");
const nextEv = loop.indexOf("id:'cold_snap'");
const sweep = sweepAt >= 0 && nextEv > sweepAt ? loop.slice(sweepAt, nextEv) : '';

ok(sweepAt >= 0 && /confiscate supplies/.test(sweep),
   'the City Sweep card still promises they confiscate supplies — guards the guard');

ok(/G\.scraps/.test(sweep) && /G\.food/.test(sweep),
   'the sweep still takes scraps and food — we did not drop the old haul');

ok(/G\.cans/.test(sweep) && /lostCans/.test(sweep),
   'HV-78: that same effect subtracts G.cans');

ok(/packedUp/.test(sweep) && /stash/.test(sweep) && /garageCover/.test(sweep),
   'Pack Up, the stash and the garage still own the keep — cans ride the same cover');

ok(!/sweep/.test(ui) || !/lostCans/.test(ui),
   'ui.js is not this ticket — it still only shows the warning and the card');

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
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    ev: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'sweep')),
    desc: (EVENTS_BAD.find(e => e.id === 'sweep') || {}).desc || '',
  }));
  ok(!boot.intro && boot.ev,
     'a returning camp can fire a sweep — not behind the crash course');
  ok(/confiscate supplies/.test(boot.desc),
     'the live card still says confiscate supplies');

  const quiet = () => {
    G.packedUp = false;
    G.garageCover = false;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.morale = 50;
  };

  // random=0.5, keep=1: scraps lose 50% (10 of 20), food and cans
  // lose 35% (7 of 20). Before the fix cans stay 20.
  const raw = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.packedUp = false;
    G.garageCover = false;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.morale = 50;
    G.scraps = 20; G.food = 20; G.cans = 20;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { scraps: G.scraps, food: G.food, cans: G.cans };
  });
  ok(raw.scraps === 10 && raw.food === 13,
     `isolation: scraps and food still move (scraps ${raw.scraps}, food ${raw.food})`);
  ok(raw.cans === 13,
     `HV-78: an uncovered sweep confiscates cans too (cans ${raw.cans})`);

  const covered = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = true; G.garageSaves = 0; G.packedUp = false;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.scraps = 20; G.food = 20; G.cans = 20; G.morale = 80;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { scraps: G.scraps, food: G.food, cans: G.cans, cover: G.garageCover };
  });
  ok(covered.scraps === 20 && covered.food === 20 && covered.cans === 20 && covered.cover === false,
     `a garage cover still saves the cans (cans ${covered.cans})`);

  const stashed = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = false; G.packedUp = false;
    G.structures.stash = true;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.scraps = 20; G.food = 20; G.cans = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { scraps: G.scraps, food: G.food, cans: G.cans };
  });
  ok(stashed.cans === 17 && stashed.food === 17,
     `the stash halves the can take the same as food (cans ${stashed.cans}, food ${stashed.food})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

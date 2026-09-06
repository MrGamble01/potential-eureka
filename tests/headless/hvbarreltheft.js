/*
 * HV-240 — Theft said they raided your stash, then left
 * the stored rainfall in the drum.
 *
 * The Rain Barrel recipe stores a day of water on rainy
 * dawns (up to 3) — that store is G.barrelWater. The theft
 * card says they raided your stash in the night. The water
 * sitting in an open drum is a camp supply. The effect
 * halved cans, food, and scraps and never touched
 * G.barrelWater, so the next dry garden dawn still spent
 * a stolen rainfall.
 *
 * Distinct from HV-201 / #891 (sweep already dumps the
 * water), #836 (wood), #859 (cardboard), #878 (coats),
 * #843 (guitar), and HV-236 / #930 (Word). The drum
 * itself is infrastructure — this ticket is the water,
 * not the stand. ui.js is not this ticket.
 *
 *  A. Source: theft still raids the stash. The recipe still
 *     stores a rainfall. The theft effect zeros barrelWater.
 *     ui.js does not. Sweep still dumps the water (HV-201).
 *     Word still fades (HV-236).
 *  B. Live: a theft with water in the drum dumps it, names
 *     the rainfall, and leaves the drum standing. Goods
 *     still leave.
 *  C. An empty drum stays empty and does not log a dump.
 *  D. The hole is still never found. Goods still halve. The
 *     water still dumps — it was in the open drum, not the
 *     hole.
 *  E. A sweep still dumps the water (HV-201). The tent
 *     still falls. The drum still stands.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production theft effect().
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
const theft = /id:'theft'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
const sweep = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);

ok(/raided your stash in the night/.test(loop)
   && /stored rainfall waters the beds/.test(cfg),
  'theft still raids the stash; the drum still stores a rainfall');
ok(theft && /barrelWater/.test(theft[1]) && /barrelWater\s*=\s*0/.test(theft[1]),
  'HV-240: the theft effect dumps the stored rainfall');
ok(!/barrelWater\s*=\s*0/.test(ui),
  'ui.js untouched — the take lives on the theft effect');
ok(theft && /addRep\s*\(\s*-3\s*\)/.test(theft[1]),
  'Word still frays — that fade is HV-236 / #930');
ok(sweep && /barrelWater\s*=\s*0/.test(sweep[1]),
  'a sweep still dumps the water — that verb is HV-201 / #891');

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
    if (!sessionStorage.getItem('hvbarreltheft-init')) {
      sessionStorage.setItem('hvbarreltheft-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    banner: EVENTS_BAD.find(e => e.id === 'theft') && EVENTS_BAD.find(e => e.id === 'theft').title,
    name: RECIPES.find(r => r.id === 'barrel') && RECIPES.find(r => r.id === 'barrel').name,
    cap: BARREL_CAP,
  }));
  ok(boot.banner === 'Theft' && boot.name === 'Rain Barrel' && boot.cap === 3,
    `the card is still Theft and the recipe is still the Rain Barrel (${boot.banner}, ${boot.name})`);

  const lifted = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.barrel = true;
    G.structures.stash = false;
    G.dog = 0;
    G.petitions = {};
    G.barrelWater = 3;
    G.food = 20; G.cans = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      barrel: !!G.structures.barrel,
      water: G.barrelWater || 0,
      named: /stored rainfall|rain barrel|dumped|emptied/i.test(log),
      cans: G.cans,
    };
  });
  ok(lifted.barrel && lifted.water === 0 && lifted.named,
    `HV-240: a live theft dumps the water and leaves the drum (water ${lifted.water}, barrel ${lifted.barrel})`);
  ok(lifted.cans < 20, `goods still leave with them (cans 20 → ${lifted.cans})`);

  const empty = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.barrel = true;
    G.structures.stash = false;
    G.dog = 0;
    G.petitions = {};
    G.barrelWater = 0;
    G.food = 20; G.cans = 20; G.scraps = 20; G.morale = 50;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    Math.random = real;
    return {
      water: G.barrelWater || 0,
      dumped: /stored rainfall|dumped|emptied/i.test(added),
    };
  });
  ok(empty.water === 0 && !empty.dumped,
    'an empty drum stays empty and does not log a dump');

  const hole = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.barrel = true;
    G.structures.stash = true;
    G.dog = 0;
    G.petitions = {};
    G.barrelWater = 2;
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return {
      barrel: !!G.structures.barrel,
      stash: !!G.structures.stash,
      water: G.barrelWater || 0,
      cans: G.cans, food: G.food, scraps: G.scraps,
    };
  });
  ok(hole.stash && hole.barrel && hole.water === 0,
    'the hole is still never found; the water still dumps (it was in the drum)');
  ok(hole.cans === 17 && hole.food === 17 && hole.scraps === 18,
    `stash still halves the take (cans ${hole.cans}, food ${hole.food}, scraps ${hole.scraps})`);

  const sweepLeft = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.barrel = true;
    G.structures.tent = true;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.stash = false;
    G.packedUp = false;
    G.garageCover = false;
    G.barrelWater = 3;
    G.scraps = 20; G.food = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return {
      water: G.barrelWater || 0,
      barrel: !!G.structures.barrel,
      tent: !!G.structures.tent,
    };
  });
  ok(sweepLeft.water === 0 && sweepLeft.barrel && !sweepLeft.tent,
    `a sweep still dumps the water (HV-201 / #891); the tent still falls (water ${sweepLeft.water})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

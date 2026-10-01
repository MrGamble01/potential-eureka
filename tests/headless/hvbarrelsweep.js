/*
 * HV-201 — City Sweep said confiscate supplies, then left the stored rainfall.
 *
 * The card says they destroy shelters and confiscate supplies. The Rain
 * Barrel stores a day of water on rainy dawns (up to 3) — that store is
 * G.barrelWater, a camp supply sitting in the drum. Sweep took scraps
 * and food. The rainfall stayed. The drum itself is infrastructure
 * (like the pantry / radio / cart); this ticket is the water, not the
 * stand.
 *
 *  A. Source: City Sweep still confiscates supplies; the effect dumps
 *     G.barrelWater when the garage is not covering.
 *  B. The card is still titled City Sweep.
 *  C. An uncovered sweep dumps 3 stored days; the drum stays.
 *  D. The log names the dumped rainfall.
 *  E. Marisol's garage still keeps the water and spends the cover.
 *  F. An empty drum does not log a dump.
 *  G. Pack-up and the stash still dump all of it — water is not halved.
 *  H. Garden still tramples; tent still falls; scraps/food still take
 *     the pinned cut. Theft dumping the water is HV-241.
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
const rec = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
ok(/desc:'Police are clearing the camp\. They destroy shelters and confiscate supplies\.'/.test(src),
  'City Sweep still says they destroy shelters and confiscate supplies');
ok(/every rainy dawn stores a day of water/.test(rec),
  'the Rain Barrel still stores a day of water on rainy dawns');
const block = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'sweep event is still in gameloop.js');
ok(block && /G\.barrelWater\s*=\s*0/.test(block[1]),
  'HV-201: an uncovered sweep dumps the stored rainfall');
ok(block && !/G\.structures\.barrel\s*=\s*false/.test(block[1]),
  'the sweep still does not tear the drum itself down');

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
    if (!sessionStorage.getItem('hvbarrelsweep-init')) {
      sessionStorage.setItem('hvbarrelsweep-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const sweep = (opts) => page.evaluate((o) => {
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = !!o.cover;
    G.packedUp = !!o.packed;
    G.structures.stash = !!o.stash;
    G.structures.barrel = o.barrel !== false;
    G.barrelWater = o.water;
    G.scraps = o.scraps != null ? o.scraps : 10;
    G.food = o.food != null ? o.food : 10;
    G.morale = 80;
    G.structures.tent = !!o.tent;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = !!o.garden;
    G.lastEventDay = G.days;
    if (typeof logFeed !== 'undefined') { logFeed.innerHTML = ''; }
    if (typeof logLines !== 'undefined') { logLines.length = 0; }
    triggerEvent(ev, false);
    Math.random = real;
    return {
      water: G.barrelWater || 0,
      barrel: !!G.structures.barrel,
      scraps: G.scraps,
      food: G.food,
      cover: !!G.garageCover,
      tent: !!G.structures.tent,
      garden: !!G.structures.garden,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, opts);

  const dumped = await sweep({
    cover: false, packed: false, stash: false,
    barrel: true, water: 3, tent: false, garden: false,
  });
  ok(dumped.banner === 'City Sweep',
    `the card still titles itself City Sweep (${dumped.banner})`);
  ok(/confiscate supplies/i.test(dumped.body),
    'the body still confiscates supplies');
  ok(dumped.water === 0,
    `HV-201: an uncovered sweep dumps 3 stored days (water=${dumped.water})`);
  ok(dumped.barrel,
    'the drum itself still stands — they took the water, not the stand');
  ok(/dumped the stored rainfall/i.test(dumped.log),
    `HV-201: the log names the dumped rainfall (${dumped.log.slice(-120)})`);
  ok(dumped.scraps === 5 && dumped.food === 7,
    `scraps/food still take the pinned cut (scraps=${dumped.scraps}, food=${dumped.food})`);

  const covered = await sweep({
    cover: true, packed: false, stash: false,
    barrel: true, water: 3, tent: true, garden: false,
  });
  ok(covered.water === 3 && !covered.cover && covered.barrel,
    `Marisol's garage keeps the rainfall and spends the cover (water=${covered.water})`);
  ok(!covered.tent, 'the tent still falls — the garage holds goods, not shelter');

  const empty = await sweep({
    cover: false, packed: false, stash: false,
    barrel: true, water: 0, tent: false, garden: false,
  });
  ok(empty.water === 0 && empty.barrel && !/dumped the stored rainfall/i.test(empty.log),
    'an empty drum does not log a dump');

  const packed = await sweep({
    cover: false, packed: true, stash: true,
    barrel: true, water: 3, tent: false, garden: false,
  });
  ok(packed.water === 0 && packed.barrel,
    `pack-up and the stash still dump all the rainfall (water=${packed.water})`);

  const trample = await sweep({
    cover: false, packed: false, stash: false,
    barrel: true, water: 1, tent: true, garden: true,
  });
  ok(!trample.garden && !trample.tent && trample.barrel && trample.water === 0,
    'garden still tramples, tent still falls, drum stays, water goes');

  const theft = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.barrel = true; G.barrelWater = 3;
    G.dog = 0; G.structures.stash = false;
    G.cans = 10; G.food = 10; G.scraps = 10; G.morale = 80;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return { water: G.barrelWater || 0, barrel: !!G.structures.barrel };
  });
  ok(theft.water === 0 && theft.barrel,
    `theft dumping the stored rainfall is HV-241 (water=${theft.water}); the drum still stands`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

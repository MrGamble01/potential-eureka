/* HV-188 — Theft said they raided your stash,
 * then left the coats hanging on the rail.
 *
 * The Coat Rack recipe is donated coats on a rail by the fire —
 * on bitter dawns the cold cuts half as deep. The theft card
 * says they raided your stash in the night. Wearable coats on
 * an open rail are the first thing they take. The effect halved
 * cans and scraps and never touched G.structures.coats, so the
 * next cold dawn still borrowed the rack.
 *
 * #836 is wood (a pile). #843 is the guitar on the corner.
 * #859 is cardboard. #783 is rain still borrowing the coats.
 * Sweep-structure tickets tear down a post, not a night raid.
 * This is the rail by the fire.
 *
 *  A. Source: theft still raids the stash. The recipe still
 *     hangs donated coats on a rail by the fire.
 *  B. Source: the theft effect reads G.structures.coats and
 *     clears it. ui.js does not.
 *  C. Live: a theft with the rack standing strips it and names
 *     the rail. Goods still leave.
 *  D. A cold dawn after the raid drains the full bite — no
 *     coat log, no half cut.
 *  E. The hole is still never found. Goods still halve. The
 *     coats still fall — they were on the rail, not in the hole.
 *  F. A sweep still leaves the rack (control — different event).
 *     The tent still falls.
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
ok(/raided your stash in the night/.test(loop)
  && /Donated coats on a rail by the fire/.test(cfg),
  'theft still raids the stash; the rack still hangs donated coats by the fire');
ok(theft && /G\.structures\.coats/.test(theft[1]) && /coats=false/.test(theft[1]),
  'HV-188: the theft effect strips the coat rack');
ok(!/G\.structures\.coats\s*=\s*false/.test(ui),
  'ui.js untouched — the take lives on the theft effect');

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
    if (!sessionStorage.getItem('hvcoatraid-init')) {
      sessionStorage.setItem('hvcoatraid-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const t = fn => page.evaluate(fn);

  // C — pinned theft with the rack standing
  const lifted = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = true;
    G.structures.stash = false;
    G.dog = 0;
    G.petitions = {};
    G.food = 20; G.cans = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      coats: !!G.structures.coats,
      named: /coat rack|rail/i.test(log),
      cans: G.cans,
    };
  });
  ok(!lifted.coats && lifted.named,
    `HV-188: a live theft strips the rack and names the rail (coats ${lifted.coats})`);
  ok(lifted.cans < 20, `goods still leave with them (cans 20 → ${lifted.cans})`);

  // D — the next cold dawn feels the full bite
  const dawn = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = true;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.garden = false;
    G.workers.scrapper = null;
    G.workers.cook = null;
    G.dog = 0;
    G.petitions = {};
    G.rep = 0;
    G.population = 1;
    G.food = 50;
    G.snapUntil = null;
    G.coldCut = 0;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    const coatsAfterRaid = !!G.structures.coats;
    G.days = 1;
    G.warmth = 90;
    G.forecast = 'cold';
    G.snapUntil = null;
    onNewDay();
    const lossRaid = 90 - G.warmth;
    const ticksRaid = G.coldCut;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    const borrowed = /Coats off the rack/.test(log) && coatsAfterRaid;
    G.structures.coats = false;
    G.coldCut = 0;
    G.days = 1;
    G.warmth = 90;
    G.forecast = 'cold';
    G.snapUntil = null;
    onNewDay();
    const lossBare = 90 - G.warmth;
    Math.random = real;
    return { coatsAfterRaid, lossRaid, lossBare, ticksRaid, borrowed };
  });
  ok(!dawn.coatsAfterRaid && dawn.lossRaid === dawn.lossBare && dawn.ticksRaid === 0 && !dawn.borrowed,
    `a cold dawn after the raid drains the full bite (${dawn.lossRaid} vs bare ${dawn.lossBare})`);

  // E — the hole still hides; the rail still falls
  const hole = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = true;
    G.structures.stash = true;
    G.dog = 0;
    G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return {
      coats: !!G.structures.coats,
      stash: !!G.structures.stash,
      cans: G.cans, food: G.food, scraps: G.scraps,
    };
  });
  ok(hole.stash && !hole.coats,
    'the hole is still never found; the coats still fall (they were on the rail)');
  ok(hole.cans === 17 && hole.food === 17 && hole.scraps === 18,
    `stash still halves the take (cans ${hole.cans}, food ${hole.food}, scraps ${hole.scraps})`);

  // F — sweep still leaves the rack
  const sweep = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = true;
    G.structures.tent = true;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.stash = false;
    G.packedUp = false;
    G.garageCover = false;
    G.scraps = 20; G.food = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { coats: !!G.structures.coats, tent: !!G.structures.tent };
  });
  ok(sweep.coats && !sweep.tent,
    'a sweep still leaves the rack (control); the tent still falls');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

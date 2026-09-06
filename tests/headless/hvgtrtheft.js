/*
 * HV-154 — the Scrap Guitar said one set a day on the corner,
 * then the thieves left it standing.
 *
 * The guitar recipe is "One set a day on the corner." The theft
 * card says they raided in the night. A guitar left on the
 * corner is the first thing they take. The effect halved cans
 * and scraps and never touched G.structures.guitar, so Busk a
 * set still rolled after they ran.
 *
 * #836 is wood (a pile). #840 is the sweep taking the cart.
 * #823 is the snap cutting the take. This is the guitar itself.
 *
 *  A. Source: the theft effect reads G.structures.guitar and
 *     clears it. The recipe still says on the corner.
 *  B. A live theft with a guitar standing takes it and names it.
 *     The busk button is gone the same night.
 *  C. The hole is still never found. Goods still halve. The
 *     guitar still falls — it was on the corner, not in the hole.
 *  D. Biscuit still halves the take. The guitar still falls
 *     (he sleeps by the fire, not on the corner).
 *  E. Busk still pays when the guitar stands.
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
const theft = /id:'theft'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
ok(/on the corner/.test(cfg) && /raided your stash in the night/.test(loop),
  'the guitar is still on the corner; theft still raids in the night');
ok(theft && /G\.structures\.guitar/.test(theft[1]) && /guitar=false/.test(theft[1]),
  'HV-154: the theft effect takes the scrap guitar off the corner');

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
    if (!sessionStorage.getItem('hvgtrtheft-init')) {
      sessionStorage.setItem('hvgtrtheft-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const lifted = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.guitar = true;
    G.structures.stash = false;
    G.dog = 0;
    G.petitions = {};
    G.goalIndex = GOALS.length;
    G.food = 20; G.cans = 20; G.scraps = 20; G.morale = 50;
    buildActionUI();
    const buskBefore = !!document.getElementById('action-busk');
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    if (typeof buildActionUI === 'function') buildActionUI();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      guitar: !!G.structures.guitar,
      buskBefore,
      buskAfter: !!document.getElementById('action-busk'),
      named: /guitar/i.test(log),
      cans: G.cans,
    };
  });
  ok(lifted.buskBefore, 'with the guitar standing the busk button is on the bar');
  ok(!lifted.guitar && lifted.named,
    `HV-154: a live theft takes the guitar and names it (guitar ${lifted.guitar})`);
  ok(!lifted.buskAfter, 'the busk button is gone the same night');
  ok(lifted.cans < 20, `goods still leave with them (cans 20 → ${lifted.cans})`);

  const hole = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.guitar = true;
    G.structures.stash = true;
    G.dog = 0;
    G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return {
      guitar: !!G.structures.guitar,
      stash: !!G.structures.stash,
      cans: G.cans, food: G.food, scraps: G.scraps,
    };
  });
  ok(hole.stash && !hole.guitar,
    'the hole is still never found; the guitar still falls (it was on the corner)');
  ok(hole.cans === 17 && hole.food === 17 && hole.scraps === 18,
    `stash still halves the take (cans ${hole.cans}, food ${hole.food}, scraps ${hole.scraps})`);

  const bark = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.guitar = true;
    G.structures.stash = false;
    G.dog = 2;
    G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return { guitar: !!G.structures.guitar, cans: G.cans };
  });
  ok(!bark.guitar && bark.cans === 17,
    `Biscuit still halves the take (cans ${bark.cans}); the guitar still falls`);

  const standing = await page.evaluate(() => {
    G.structures.guitar = true;
    G.buskDay = -9;
    G.morale = 50; G.weather = 'clear';
    G.goodwill = 0;
    G.goalIndex = GOALS.length;
    const rep0 = G.rep || 0;
    finishAction(buskAction());
    return {
      gw: G.goodwill,
      rep: (G.rep || 0) - rep0,
      guitar: !!G.structures.guitar,
    };
  });
  ok(standing.guitar && standing.gw === 3 && standing.rep === 1,
    `busk still pays when the guitar stands (+${standing.gw}🩶, +${standing.rep} rep)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

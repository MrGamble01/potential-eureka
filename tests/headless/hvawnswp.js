/*
 * HV-156 — City Sweep said they destroy shelters, then the
 * awning still kept the corner dry.
 *
 * The sweep card says police destroy shelters and confiscate
 * supplies. The awning recipe is a salvaged shop awning rigged
 * over the corner — a roof. The effect demolished tents and
 * never touched G.structures.awning, so a rainy panhandle still
 * used the dry-corner ×2 after the trucks left.
 *
 * #840 is the cart (a liberated vehicle). #831 is the garden
 * plot and its bin. #839 is cardboard (a pile). This is a
 * shelter the card already named.
 *
 *  A. Source: the sweep effect reads G.structures.awning and
 *     clears it. The card still says destroy shelters.
 *  B. A live sweep with an awning standing takes it and names it.
 *  C. The hole is still never found. The tent still falls.
 *  D. A garage cover still zeroes loose goods; the awning still
 *     falls (a roof, not a crate).
 *  E. A rainy panhandle still lands under an awning that stands.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production sweep effect().
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
const sweep = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
ok(/destroy shelters/.test(loop) && /shop awning/.test(cfg),
  'the sweep still destroys shelters; the awning is still a shop awning over the corner');
ok(sweep && /G\.structures\.awning/.test(sweep[1]) && /awning=false/.test(sweep[1]),
  'HV-156: the sweep effect tears the awning off the corner');

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
    if (!sessionStorage.getItem('hvawnswp-init')) {
      sessionStorage.setItem('hvawnswp-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const lifted = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.awning = true;
    G.structures.tent = true;
    G.structures.stash = true;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.garageCover = false;
    G.packedUp = false;
    G.goalIndex = GOALS.length;
    G.food = 10; G.scraps = 10;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      awning: !!G.structures.awning,
      tent: !!G.structures.tent,
      stash: !!G.structures.stash,
      named: /awning/i.test(log),
    };
  });
  ok(!lifted.awning && lifted.named,
    `HV-156: a live sweep takes the awning and names it (awning ${lifted.awning})`);
  ok(!lifted.tent && lifted.stash,
    'the tent still falls; the hole is still never found');

  const garage = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.awning = true;
    G.structures.tent = true;
    G.structures.stash = false;
    G.garageCover = true;
    G.packedUp = false;
    G.food = 20; G.scraps = 20;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return {
      awning: !!G.structures.awning,
      tent: !!G.structures.tent,
      food: G.food,
      scraps: G.scraps,
      cover: !!G.garageCover,
    };
  });
  ok(!garage.awning && !garage.tent && garage.food === 20 && garage.scraps === 20 && !garage.cover,
    `garage still zeroes loose goods (food ${garage.food}); the awning still falls`);

  const dry = await page.evaluate(() => {
    const real = Math.random;
    let first = true;
    Math.random = () => { if (first) { first = false; return 0.4; } return 0.5; };
    G.structures.awning = true;
    G.weather = 'rain';
    G.dog = 0; G.rep = 0; G.mural = 0; G.snapUntil = null;
    G.goodwill = 0; G.awningSaves = 0;
    finishAction({ id: 'panhandle' });
    Math.random = real;
    return { gave: G.goodwill > 0, saves: G.awningSaves || 0, awning: !!G.structures.awning };
  });
  ok(dry.awning && dry.gave && dry.saves === 1,
    'a rainy panhandle still lands under an awning that stands');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

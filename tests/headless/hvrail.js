/*
 * HV-215 — City Sweep said confiscate supplies, then left the coats
 * hanging on the rail.
 *
 * The card: "They destroy shelters and confiscate supplies." The Coat
 * Rack is donated coats on a rail by the fire — a shelter of warmth
 * and a pile of supplies. Sweep already takes the tent and the garden.
 * It never touched G.structures.coats.
 *
 * Theft taking the coats is a different verb (#878). Soup, the barrel,
 * and the workbench are not this card.
 *
 *  A. Source: the sweep effect clears the rack.
 *  B. The card still promises confiscate supplies.
 *  C. A standing rack comes off the rail, and the log names it.
 *  D. The tent still falls when both stand.
 *  E. Theft is not this card — the coats stay on the rail.
 *  F. A coatless sweep does not log the rail.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production sweep / theft effects.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const sweepBlock = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
const theftBlock = /id:'theft'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!sweepBlock, 'sweep event is still in gameloop.js');
ok(sweepBlock && /G\.structures\.coats\s*=\s*false/.test(sweepBlock[1]),
  'HV-215: sweep effect takes the donated coats off the rail');
ok(/destroy shelters and confiscate supplies/.test(src),
  'the card still promises confiscate supplies');
ok(theftBlock && !/G\.structures\.coats/.test(theftBlock[1]),
  'Theft is not this card — it does not touch the rack');

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
    if (!sessionStorage.getItem('hvrail-init')) {
      sessionStorage.setItem('hvrail-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const sweep = await t(() => {
    const lines = [];
    const realLog = log;
    log = function (m) { lines.push(String(m)); realLog.apply(this, arguments); };
    const realRand = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = true;
    G.structures.tent = true;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.barrel = true;
    G.garageCover = false;
    G.packedUp = false;
    G.structures.stash = false;
    G.scraps = 20; G.food = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    log = realLog;
    Math.random = realRand;
    return {
      coats: !!G.structures.coats,
      tent: !!G.structures.tent,
      barrel: !!G.structures.barrel,
      soup: !!G.structures.soup_kitchen,
      log: lines.join(' | '),
      banner: document.getElementById('ev-title') ? document.getElementById('ev-title').textContent : '',
    };
  });
  ok(!sweep.coats, `the sweep takes the donated coats off the rail (coats=${sweep.coats})`);
  ok(!sweep.tent, 'the tent still falls when the rack stood');
  ok(sweep.barrel, 'the rain barrel is not this card');
  ok(/rail|coat/i.test(sweep.log), `the log names the coats coming off the rail (${sweep.log})`);

  const theft = await t(() => {
    const realRand = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = true;
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50; G.dog = 0;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = realRand;
    return !!G.structures.coats;
  });
  ok(theft, 'Theft is not this card — the coats stay hanging on the rail');

  const bare = await t(() => {
    const lines = [];
    const realLog = log;
    log = function (m) { lines.push(String(m)); realLog.apply(this, arguments); };
    const realRand = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = false;
    G.structures.tent = false;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.garageCover = false;
    G.packedUp = false;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    log = realLog;
    Math.random = realRand;
    return lines.join(' | ');
  });
  ok(!/rail|coat/i.test(bare), `a coatless sweep does not log the rail (${bare})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

/*
 * HV-266 — Theft said Biscuit chased them off, then he had
 * curled up hungry.
 *
 * A fed Biscuit halves the night raid. Panhandle already knows
 * a hungry dog does not help. Theft never read dogHungry, so a
 * dawn that logged him curled up still credited the chase.
 *
 * A fed dog still halves the take and still names the chase.
 * Sweep warning is not this card. Dogwalk is not this card.
 * ui.js is not this ticket.
 *
 *  A. Source: theft's dog cut reads dogHungry.
 *  B. A hungry Biscuit does not halve the raid or name the chase.
 *  C. A fed Biscuit still halves it and still names the chase.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production EVENTS_BAD theft.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const at = loop.indexOf("{id:'theft'");
const end = loop.indexOf("{id:'injury'");
const body = at >= 0 && end > at ? loop.slice(at, end) : '';

ok(/Biscuit chased them off/.test(loop),
  'a fed chase still says Biscuit chased them off');
ok(/dogHungry/.test(body) && /curled up hungry/.test(body),
  'HV-266: theft reads a hungry Biscuit before it credits the chase');
ok(!/sweepWarned/.test(body),
  'the sweep bark is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(loop),
  'the cut lives on the night raid — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvchase-init')) {
      sessionStorage.setItem('hvchase-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const raid = hungry => t(h => {
    const real = Math.random; Math.random = () => 0.5;
    G.dog = 2;
    G.dogHungry = h;
    G.structures.stash = false;
    G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    window.log = prev;
    Math.random = real;
    return {
      cans: G.cans, food: G.food, scraps: G.scraps,
      last: captured[captured.length - 1] || '',
    };
  }, hungry);

  const fed = await raid(false);
  ok(fed.cans === 17 && fed.food === 17 && fed.scraps === 18,
    `a fed Biscuit still halves the raid (cans=${fed.cans}, food=${fed.food}, scraps=${fed.scraps})`);
  ok(/Biscuit chased/.test(fed.last),
    `the fed log still names the chase (${fed.last})`);

  const hung = await raid(true);
  ok(hung.cans === 13 && hung.food === 14 && hung.scraps === 16,
    `HV-266: a hungry Biscuit does not halve it (cans=${hung.cans}, food=${hung.food}, scraps=${hung.scraps})`);
  ok(/curled up hungry/.test(hung.last) && !/Biscuit chased/.test(hung.last),
    `the last line names the empty bowl (${hung.last})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

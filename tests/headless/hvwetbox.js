/*
 * HV-259 — the Free Pantry said someone left a little something
 * overnight, then a rainy dawn still filled the box.
 *
 * The card is a little box on a post. Some dawns the neighborhood
 * leaves something. Rain is already the weather that keeps people
 * off the sidewalk. The fill never read the sky.
 *
 * A named snap is not this card (#893). Sweep is not this card
 * (#875). A clear generous dawn still leaves +2. ui.js is not
 * this ticket.
 *
 *  A. Source: pantryAtDawn returns on rain before the fill.
 *  B. A rainy generous dawn leaves the pot and the tally alone
 *     and the log names the soaked box.
 *  C. A clear generous dawn still leaves +2.
 *  D. A named snap under a clear sky is not this card.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production pantryAtDawn.
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
const pantryAt = loop.indexOf('function pantryAtDawn()');
const pantry = pantryAt >= 0 ? loop.slice(pantryAt, pantryAt + 650) : '';

ok(/little box on a post/.test(cfg) && /leaves something/.test(cfg),
  'the Free Pantry still says a little box on a post — some dawns the neighborhood leaves something');
ok(/weather==='rain'/.test(pantry) && /kept the pantry box empty/.test(pantry),
  'HV-259: pantryAtDawn keeps the open box empty in the rain');
ok(!/snapActive/.test(pantry),
  'a named snap is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(loop) && !/homeless-village\/js\/ui\.js/.test(cfg),
  'the cut lives on the dawn fill — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvwetbox-init')) {
      sessionStorage.setItem('hvwetbox-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const dry = await t(() => {
    const mr = Math.random;
    Math.random = () => 0;
    G.structures.pantry = true;
    G.weather = 'clear';
    G.snapUntil = null;
    G.food = 10;
    G.pantryFills = 0;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    pantryAtDawn();
    window.log = prev;
    Math.random = mr;
    return { food: G.food, fills: G.pantryFills, last: captured[captured.length - 1] || '' };
  });
  ok(dry.food === 12 && dry.fills === 1,
    `a clear generous dawn still leaves +2 (food=${dry.food}, fills=${dry.fills})`);
  ok(/left a little something/.test(dry.last),
    `the dry log still names the overnight leave (${dry.last})`);

  const wet = await t(() => {
    const mr = Math.random;
    Math.random = () => 0;
    G.structures.pantry = true;
    G.weather = 'rain';
    G.snapUntil = null;
    G.food = 10;
    G.pantryFills = 0;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    pantryAtDawn();
    window.log = prev;
    Math.random = mr;
    return { food: G.food, fills: G.pantryFills, last: captured[captured.length - 1] || '' };
  });
  ok(wet.food === 10 && wet.fills === 0,
    `HV-259: a rainy generous dawn leaves the pot (food=${wet.food}, fills=${wet.fills})`);
  ok(/Rain kept the pantry box empty/.test(wet.last),
    `the last line names the soaked box (${wet.last})`);

  const snap = await t(() => {
    const mr = Math.random;
    Math.random = () => 0;
    G.structures.pantry = true;
    G.weather = 'clear';
    G.days = 8;
    G.snapUntil = 10;
    G.food = 10;
    G.pantryFills = 0;
    pantryAtDawn();
    Math.random = mr;
    return { food: G.food, fills: G.pantryFills, snap: snapActive() };
  });
  ok(snap.snap && snap.food === 12 && snap.fills === 1,
    `a named snap under a clear sky is not this card (food=${snap.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

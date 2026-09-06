/* HV-76 — Hungry Biscuit still chased thieves and still barked.
 *
 * Dawn with no scraps: "He curls up hungry." The HUD shows 🐕💢.
 * Panhandle already drops the dog boost when G.dogHungry. Theft still
 * used `G.dog===2` alone — half the take, and the log still said
 * "Biscuit chased them off." The sweep branch did the same: a curled-up
 * dog still barked the 15s warning.
 *
 * Not #731 (join-order breakfast). Not #727 (Lookout vs Biscuit).
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: theft and the no-Lookout bark both read dogHungry, the
 *    same way panhandle already does. ui.js is not touched.
 * B. Behaviour: a fed dog still halves theft and still barks. A hungry
 *    dog does neither. Reverting the hunger check fails the named
 *    hungry haul.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const theftAt = loop.indexOf("id:'theft'");
const injAt = loop.indexOf("id:'injury'");
const theft = theftAt >= 0 ? loop.slice(theftAt, injAt > theftAt ? injAt : theftAt + 700) : '';
const barkAt = loop.indexOf('else if(G.dog===2');
const bark = barkAt >= 0 ? loop.slice(barkAt, barkAt + 420) : '';

ok(/He curls up hungry/.test(loop),
   'a broke dawn still curls Biscuit up hungry — guards the guard');
ok(/G\.dog===2&&!G\.dogHungry/.test(player),
   'panhandle already drops the dog boost when he is hungry — the pattern this ticket copies');
ok(/dogHungry/.test(theft) && /G\.dog===2/.test(theft),
   'HV-76: theft only halves the take when Biscuit is fed');
ok(/dogHungry/.test(bark),
   'HV-76: the no-Lookout bark only fires when Biscuit is fed');
ok(/🐕💢/.test(ui) && !/id:'theft'/.test(ui),
   'ui.js is not this ticket — it still only paints the hungry badge');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
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
    theft: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'theft')),
  }));
  ok(!boot.intro && boot.theft,
     'a returning camp still has the Theft card');

  const raid = (hungry) => page.evaluate((hungry) => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.dog = 2; G.dogHungry = hungry;
    G.structures.stash = false; G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    if (typeof logFeed !== 'undefined') logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { cans: G.cans, food: G.food, scraps: G.scraps, feed };
  }, hungry);

  const fed = await raid(false);
  ok(fed.cans === 17 && fed.food === 17 && fed.scraps === 18,
     `a fed dog still halves the take (cans ${fed.cans}, food ${fed.food}, scraps ${fed.scraps})`);
  ok(/Biscuit chased them off/.test(fed.feed),
     'a fed dog still gets the chased-them-off line');

  const hung = await raid(true);
  ok(hung.cans === 13 && hung.food === 14 && hung.scraps === 16,
     `HV-76: a hungry dog does not halve the take (cans ${hung.cans}, food ${hung.food}, scraps ${hung.scraps})`);
  ok(/Stash raided in the night/.test(hung.feed) && !/chased them off/.test(hung.feed),
     'a hungry dog does not get credit for a chase he slept through');

  const warn = (hungry) => page.evaluate((hungry) => {
    const real = Math.random;
    Math.random = () => 0.1;
    G.days = 4; G.dog = 2; G.dogHungry = hungry;
    G.workers.lookout = false; G.sweepWarned = false; G.packedUp = false;
    const swept0 = G.timesSwept;
    maybeEvent();
    Math.random = real;
    const out = {
      warned: G.sweepWarned,
      swept: G.timesSwept - swept0,
      bark: Array.from(document.querySelectorAll('.log-line')).some(el => /Biscuit will not stop barking/.test(el.textContent)),
    };
    G.sweepWarned = false;
    if (typeof showSweepWarning === 'function') showSweepWarning(false);
    return out;
  }, hungry);

  const fedBark = await warn(false);
  ok(fedBark.warned && fedBark.swept === 0 && fedBark.bark,
     'a fed dog still barks the 15s warning');

  const hungBark = await warn(true);
  ok(!hungBark.warned && hungBark.swept === 1 && !hungBark.bark,
     `HV-76: a hungry dog does not bark — the sweep lands (${hungBark.swept} sweep, warned=${hungBark.warned})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

/*
 * HV-169 — Theft said they raided your stash, then left the cardboard.
 *
 * The card body is "Someone raided your stash in the night. Trust no
 * one." The Hidden Stash is built with cardboard. The effect takes
 * cans, food, and scraps (Biscuit / stash / streetlight already cut
 * those). Cardboard never moved. Wood is a different ticket. Sweep
 * taking cardboard is a different event.
 *
 *  A. Source: the theft effect assigns G.cardboard; ui.js is untouched.
 *  B. The card still promises they raided your stash.
 *  C. A pinned theft with 20 cardboard takes some of it.
 *  D. Cans, food, and scraps still go. Wood still sits (not this ticket).
 *  E. City Sweep still leaves the cardboard (control — different event).
 *  F. Church Donated Supplies still leaves the cardboard.
 *  G. Biscuit still halves the cardboard take.
 *  H. The buried stash still halves the cardboard take.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production theft.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'theft'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'theft event is still in gameloop.js');
ok(block && /G\.cardboard\s*=\s*Math\.max\s*\(\s*0\s*,\s*G\.cardboard/.test(block[1]),
  'HV-169: theft effect confiscates cardboard');
ok(/raided your stash/.test(src),
  'the card still promises they raided your stash');
ok(!/G\.cardboard\s*=/.test(ui),
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
    if (!sessionStorage.getItem('hvtheftcard-init')) {
      sessionStorage.setItem('hvtheftcard-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const pinTheft = (extra) => page.evaluate((extra) => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.dog = 0;
    G.dogHungry = false;
    G.structures.stash = false;
    if (G.petitions) G.petitions.streetlight = false;
    G.cans = 20; G.food = 20; G.scraps = 20; G.wood = 20; G.cardboard = 20;
    G.morale = 50;
    Object.assign(G, extra || {});
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    triggerEvent(ev, false);
    Math.random = real;
    return {
      scraps: G.scraps,
      food: G.food,
      cans: G.cans,
      wood: G.wood,
      cardboard: G.cardboard,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, extra);

  const theft = await pinTheft();
  ok(theft.banner === 'Theft',
    `the card still titles itself Theft (${theft.banner})`);
  ok(/raided your stash/i.test(theft.body),
    'the body still names the raided stash');
  ok(theft.cardboard < 20,
    `HV-169: a pinned theft takes some of the cardboard (20 → ${theft.cardboard})`);
  ok(theft.cardboard === 16,
    `HV-169: the 0.5 roll takes 20% of the cardboard like scraps (20 → ${theft.cardboard})`);
  ok(theft.cans < 20 && theft.food < 20 && theft.scraps < 20,
    `cans, food, and scraps still go (${theft.cans}/${theft.food}/${theft.scraps})`);
  ok(theft.wood === 20,
    `wood still sits — not this ticket (${theft.wood})`);
  ok(/cardboard/i.test(theft.log),
    `the log names the cardboard (${theft.log.slice(-80)})`);

  const sweep = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.cardboard = 20; G.wood = 20; G.scraps = 20; G.food = 20; G.cans = 20;
    G.packedUp = false;
    G.garageCover = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.stash = false;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'sweep'), false);
    Math.random = real;
    return G.cardboard;
  });
  ok(sweep === 20,
    `City Sweep still leaves the cardboard — different event (${sweep})`);

  const church = await page.evaluate(() => {
    G.cardboard = 20;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(EVENTS_GOOD.find(e => e.id === 'church_donation'), true);
    return G.cardboard;
  });
  ok(church === 20,
    `Church Donated Supplies still leaves the cardboard (${church})`);

  const biscuit = await pinTheft({ dog: 2, cardboard: 20 });
  ok(biscuit.cardboard === 18,
    `Biscuit still halves the cardboard take (${biscuit.cardboard})`);

  const stash = await pinTheft({ cardboard: 20, structures: { stash: true } });
  ok(stash.cardboard === 18,
    `the buried stash still halves the cardboard take (${stash.cardboard})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

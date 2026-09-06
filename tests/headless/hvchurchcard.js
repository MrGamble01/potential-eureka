/*
 * HV-175 — Church Donated Supplies said essentials, then left the cardboard.
 *
 * The card body is "A volunteer group dropped off some essentials."
 * The effect gives food and scraps. Cans are a different ticket. Wood
 * is a different ticket. Cardboard is tent canvas, blankets, the
 * stash — and it never moved.
 *
 *  A. Source: the church effect assigns G.cardboard; ui.js is untouched.
 *  B. The card still promises essentials.
 *  C. A pinned donation with 20 cardboard adds some.
 *  D. Food and scraps still rise. Cans and wood still sit (other tickets).
 *  E. Kind Stranger still leaves the cardboard (control — different event).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production donation.
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
const block = /id:'church_donation'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'church donation is still in gameloop.js');
ok(block && /G\.cardboard/.test(block[1]),
  'HV-175: church effect donates cardboard');
ok(/dropped off some essentials/.test(src),
  'the card still promises essentials');
ok(!/G\.cardboard\s*=/.test(ui),
  'ui.js untouched — the gift lives on the church effect');

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
    if (!sessionStorage.getItem('hvchurchcard-init')) {
      sessionStorage.setItem('hvchurchcard-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const pinChurch = (extra) => page.evaluate((extra) => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.food = 20; G.scraps = 20; G.cans = 20; G.wood = 20; G.cardboard = 20;
    G.morale = 50;
    Object.assign(G, extra || {});
    const ev = EVENTS_GOOD.find(e => e.id === 'church_donation');
    triggerEvent(ev, true);
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

  const church = await pinChurch();
  ok(church.banner === 'Church Donated Supplies',
    `the card still titles itself Church Donated Supplies (${church.banner})`);
  ok(/essentials/i.test(church.body),
    'the body still names essentials');
  ok(church.cardboard > 20,
    `HV-175: a pinned donation adds cardboard (20 → ${church.cardboard})`);
  ok(church.cardboard === 24,
    `HV-175: the 0.5 roll adds 4 cardboard like scraps (20 → ${church.cardboard})`);
  ok(church.food > 20 && church.scraps > 20,
    `food and scraps still rise (${church.food}/${church.scraps})`);
  ok(church.cans === 20,
    `cans still sit — not this ticket (${church.cans})`);
  ok(church.wood === 20,
    `wood still sits — not this ticket (${church.wood})`);

  const kind = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.cardboard = 20;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(EVENTS_GOOD.find(e => e.id === 'kind_stranger'), true);
    Math.random = real;
    return G.cardboard;
  });
  ok(kind === 20,
    `Kind Stranger still leaves the cardboard — different event (${kind})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

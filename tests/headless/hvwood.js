/*
 * HV-147 — Church Donated Supplies said essentials, then left the wood.
 *
 * The card title is "Church Donated Supplies." The body says a
 * volunteer group dropped off some essentials. Crash course says
 * cold kills you and firewood holds it back. Wood is the forage
 * / fire staple. The effect added food, scraps and morale. The
 * woodpile never moved. HV-88 (#754) is the same card adding
 * cans (dumpster / trade staple). This ticket is wood.
 *
 *  A. Source: church_donation effect assigns G.wood+=.
 *  B. The card is still titled Church Donated Supplies.
 *  C. A pinned low roll adds wood (and still adds food / scraps).
 *  D. Kind Stranger is still a food drop and does not add wood.
 *  E. ui.js is untouched.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'church_donation'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'church_donation event is still in gameloop.js');
ok(block && /G\.wood\s*\+=/.test(block[1]),
  'HV-147: Church Donated Supplies said essentials, then left the wood');
ok(/title:'Church Donated Supplies'/.test(src),
  'the card is still titled Church Donated Supplies');
ok(!/church_donation/.test(ui) && !/G\.wood\s*\+=/.test(ui),
  'ui.js is untouched — church wood is not drawn there');

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
    if (!sessionStorage.getItem('hvwood-init')) {
      sessionStorage.setItem('hvwood-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // rand(a,b) with Math.random=0 → a. Sequence: food, scraps, morale, wood.
  const drop = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'church_donation');
    const real = Math.random;
    Math.random = () => 0;
    G.food = 0; G.scraps = 0; G.wood = 0; G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    Math.random = real;
    return {
      food: G.food,
      scraps: G.scraps,
      wood: G.wood,
      morale: G.morale,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });

  ok(drop.banner === 'Church Donated Supplies',
    `the card still titles itself Church Donated Supplies (${drop.banner})`);
  ok(/essentials/i.test(drop.body),
    `the body still names essentials (${drop.body.slice(0, 80)})`);
  ok(drop.food >= 4, `food still arrives (0 → ${drop.food})`);
  ok(drop.scraps >= 2, `scraps still arrive (0 → ${drop.scraps})`);
  ok(drop.morale > 50, `morale still rises (${drop.morale})`);
  ok(drop.wood >= 2,
    `HV-147: a low roll adds wood, not a silent pile (0 → ${drop.wood})`);
  ok(/wood/i.test(drop.log),
    `the log names the wood (${drop.log.slice(-90)})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.wood = 10; G.food = 0; G.goodwill = 10;
    triggerEvent(ev, true);
    Math.random = real;
    return { wood: G.wood, food: G.food, goodwill: G.goodwill };
  });
  ok(stranger.wood === 10 && stranger.food > 0 && stranger.goodwill === 10,
    `Kind Stranger is still a food drop, not wood (wood=${stranger.wood} food=${stranger.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

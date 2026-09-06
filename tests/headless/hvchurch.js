/* HV-88 — Church Donated Supplies said essentials and left the cans.
 *
 * The card promises: "A volunteer group dropped off some essentials."
 * The effect added food and scraps. Cans — the third dumpster staple,
 * the Trade Goods pile, the thing Theft already steals — were not
 * in the bag.
 *
 * Same family as HV-79 (City Sweep left the cans) and HV-70 (Found $5
 * paid a random handful): the card named the goods and the code
 * skipped the obvious one. Not #742: that is the sweep. Not #751:
 * that is Kind Stranger's morale log.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the church effect adds G.cans. The log names cans.
 *    ui.js is not touched.
 * B. Behaviour: random=0.5 pays 4 cans on a 10-can pile (10 → 14).
 *    Isolation: food and scraps still move.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const churchAt = loop.indexOf("id:'church_donation'");
const church = churchAt >= 0 ? loop.slice(churchAt, churchAt + 800) : '';

ok(churchAt >= 0 && /essentials/.test(church),
   'the Church Donated Supplies card still promises essentials — guards the guard');

ok(/G\.food/.test(church) && /G\.scraps/.test(church),
   'the drop still includes food and scraps — we did not drop the old haul');

ok(/G\.cans/.test(church),
   'HV-88: that same effect adds G.cans');

ok(/cans gained/.test(church) || /and cans/.test(church),
   'the log names the cans so the card and the feed agree');

ok(!/church/.test(ui) && !/church_donation/.test(ui),
   'ui.js is not this ticket — it still only shows the event banner');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
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
    ev: !!(typeof EVENTS_GOOD !== 'undefined' && EVENTS_GOOD.some(e => e.id === 'church_donation')),
    desc: (EVENTS_GOOD.find(e => e.id === 'church_donation') || {}).desc || '',
  }));
  ok(!boot.intro && boot.ev,
     'a returning camp can fire the church drop — not behind the crash course');
  ok(/essentials/.test(boot.desc),
     'the live card still says essentials');

  // random=0.5: food rand(4,9)=7, scraps rand(2,5)=4, morale rand(5,10)=8,
  // cans rand(2,5)=4. Before the fix cans stay 10.
  const drop = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.food = 10; G.scraps = 10; G.cans = 10; G.morale = 50;
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    EVENTS_GOOD.find(e => e.id === 'church_donation').effect();
    log = prev;
    Math.random = real;
    return { food: G.food, scraps: G.scraps, cans: G.cans, morale: G.morale, log: heard.join(' ') };
  });
  ok(drop.food === 17 && drop.scraps === 14,
     `isolation: food and scraps still move (food ${drop.food}, scraps ${drop.scraps})`);
  ok(drop.morale === 58,
     `isolation: the morale lift still lands (${drop.morale})`);
  ok(drop.cans === 14,
     `HV-88: the essentials include cans (cans ${drop.cans})`);
  ok(/can/i.test(drop.log),
     'the live log names the cans');

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

/* HV-203 — the Free Pantry said someone left a little something
 * overnight, then a cold snap still filled the box.
 *
 * The pantry is a little box on a post: take what you need, leave
 * what you can. Some dawns a neighbor leaves a leftover. A cold
 * snap is two brutal days — keep the fire fed and the pot full.
 * The cold gets into everything. The leftover still landed, edible,
 * like a quiet dawn. A box on a post does not keep food through
 * a snap.
 *
 * #756 is a stingy dawn (the roll missed). #875 is the sweep
 * leaving the box standing. #832 is the dawn bowl size. #889 is
 * groceries at the fence under the chalk star. This is the box.
 *
 *  A. Source: the pantry is still a box on a post. Overnight
 *     leftovers still fill it. The snap is still two brutal days.
 *  B. Source: pantryAtDawn reads snapActive(). ui.js does not.
 *  C. Live: the box is up, a generous snap dawn — the pot does
 *     not move. The log names the freeze. The fill tally does not
 *     tick.
 *  D. The same generous quiet dawn still pays +2 and ticks.
 *  E. A stingy snap dawn still leaves nothing. Rain without a
 *     snap still pays. The fifth fill still remembers, once the
 *     snap has broken.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production pantryAtDawn().
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const fn = /function pantryAtDawn\(\)\{([\s\S]*?)\n\}/.exec(loop);
const body = fn ? fn[1] : '';

ok(/A little box on a post/.test(cfg)
  && /leave what you can/.test(cfg)
  && /Someone left a little something in the pantry box overnight/.test(loop)
  && /two brutal days/.test(loop)
  && /Keep the fire fed and the pot full/.test(loop),
  'the pantry is still a box on a post; the snap is still two brutal days');
ok(body && /snapActive\s*\(\s*\)/.test(body),
  'HV-203: pantryAtDawn reads whether a snap is gripping the block');
ok(!/pantry box overnight/.test(ui) && !/snapActive/.test(ui) && !/froze what was left/.test(ui),
  'ui.js untouched — the freeze lives on the dawn drip');

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
    if (!sessionStorage.getItem('hvsnapbox-init')) {
      sessionStorage.setItem('hvsnapbox-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const drip = (snap, weather, roll, fills) => page.evaluate(({ snap, weather, roll, fills }) => {
    G.structures.pantry = true;
    G.snapUntil = snap ? G.days + 2 : null;
    G.weather = weather;
    G.food = 10;
    G.pantryFills = fills;
    G.rep = 0;
    const mr = Math.random;
    Math.random = () => roll;
    log('HV203-BOX');
    pantryAtDawn();
    Math.random = mr;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV203-BOX/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      food: G.food,
      fills: G.pantryFills,
      frozen: /froze what was left/.test(newest) && /pantry box/.test(newest),
      left: /Someone left a little something in the pantry box overnight/.test(newest),
      remembered: /the block knows who keeps it up/.test(newest),
    };
  }, { snap, weather, roll, fills });

  const snapFill = await drip(true, 'clear', 0, 0);
  ok(snapFill.food === 10 && snapFill.fills === 0 && snapFill.frozen && !snapFill.left,
    `HV-203: a generous snap dawn freezes the leftover (food ${snapFill.food}, fills ${snapFill.fills})`);

  const quiet = await drip(false, 'clear', 0, 0);
  ok(quiet.food === 12 && quiet.fills === 1 && quiet.left && !quiet.frozen,
    `a generous quiet dawn still pays +2 (food ${quiet.food}, fills ${quiet.fills})`);

  const stingy = await drip(true, 'clear', 0.9, 0);
  ok(stingy.food === 10 && stingy.fills === 0 && !stingy.frozen && !stingy.left,
    'a stingy snap dawn still leaves nothing — nobody left a leftover to freeze');

  const rain = await drip(false, 'rain', 0, 0);
  ok(rain.food === 12 && rain.fills === 1 && rain.left && !rain.frozen,
    `rain without a snap still pays the leftover (food ${rain.food})`);

  const fifth = await drip(false, 'clear', 0, 4);
  ok(fifth.food === 12 && fifth.fills === 5 && fifth.remembered && !fifth.frozen,
    'the fifth fill still remembers, once the snap has broken');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

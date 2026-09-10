/* HV-205 — the Rain Barrel said a stored rainfall waters the
 * beds, then a cold snap still poured the drum.
 *
 * A dry garden dawn spends one stored rainfall for +1 food.
 * A cold snap is two brutal days — the cold gets into everything.
 * Water sitting in a drum through a snap is ice. Ice does not
 * water the beds, and the drum stays full until a thaw.
 *
 * #819 is frost weather leaving the drum full (the beds already
 * gave nothing). #838 is live rain growing like a dry day.
 * #883 is the beds themselves under a named snap. #891 is the
 * sweep leaving stored rainfall. #893 is the pantry leftover.
 * This is the drum.
 *
 *  A. Source: the barrel still stores a rainfall. A dry garden
 *     dawn still waters the beds. The snap is still two brutal days.
 *  B. Source: the stored-rainfall spend reads snapActive().
 *     ui.js does not.
 *  C. Live: garden up, drum at 2, generous clear snap dawn —
 *     water stays 2, watering tally stays 0, the log names the ice.
 *  D. The same clear quiet dawn still spends one and pays +1
 *     over a bare garden.
 *  E. A rainy snap dawn still never spends (the sky is working).
 *     Frost still neither fills nor spends.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production onNewDay().
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

const spend = /if\(G\.weather!=='rain'&&\(G\.barrelWater\|\|0\)>0\)\{([^}]*)\}/.exec(loop);
const body = spend ? spend[1] : '';

ok(/every rainy dawn stores a day of water/.test(cfg)
  && /stored rainfall waters the beds/.test(cfg)
  && /A stored rainfall waters the beds/.test(loop)
  && /two brutal days/.test(loop)
  && /The cold gets into everything/.test(loop),
  'the barrel still stores a rainfall; the snap is still two brutal days');
ok(body && /snapActive\s*\(\s*\)/.test(body),
  'HV-205: the stored-rainfall spend reads whether a snap is gripping the block');
ok(!/froze the drum/.test(ui) && !/barrelWater/.test(ui) && !/snapActive/.test(ui),
  'ui.js untouched — the ice lives on the watering');

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
    if (!sessionStorage.getItem('hvsnapdrum-init')) {
      sessionStorage.setItem('hvsnapdrum-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (weather, snap, water) => page.evaluate(({ weather, snap, water }) => {
    const mr = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 0; G.structures.tent = false;
    G.workers.scrapper = null; G.workers.cook = null;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.structures.garden = true; G.structures.compost = false;
    G.structures.barrel = true; G.structures.pantry = false;
    G.rep = 0; G.days = 1; G.warmth = 90; G.food = 20;
    G.forecast = weather; G.lastEventDay = G.days + 5;
    G.snapUntil = snap ? G.days + 99 : null;
    G.barrelWater = water; G.barrelDays = 0;
    log('HV205-DRUM');
    onNewDay();
    Math.random = mr;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV205-DRUM/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-8)).join('\n');
    return {
      food: G.food,
      water: G.barrelWater || 0,
      days: G.barrelDays || 0,
      iced: /froze the drum/.test(newest) && /ice/i.test(newest),
      poured: /A stored rainfall waters the beds/.test(newest),
    };
  }, { weather, snap, water });

  const snapPour = await dawn('clear', true, 2);
  ok(snapPour.water === 2 && snapPour.days === 0 && snapPour.iced && !snapPour.poured,
    `HV-205: a clear snap dawn leaves the drum frozen (water ${snapPour.water}, days ${snapPour.days})`);

  const bare = await dawn('clear', false, 0);
  const quiet = await dawn('clear', false, 2);
  ok(quiet.food - bare.food === 1 && quiet.water === 1 && quiet.days === 1 && quiet.poured && !quiet.iced,
    `a clear quiet dawn still spends one (+${quiet.food - bare.food} over bare, water 2→${quiet.water})`);

  const rainSnap = await dawn('rain', true, 2);
  ok(rainSnap.water >= 2 && rainSnap.days === 0 && !rainSnap.poured,
    'a rainy snap dawn still never spends — the sky is doing the work');

  const frost = await dawn('cold', false, 2);
  ok(frost.water === 2 && frost.days === 0 && !frost.poured && !frost.iced,
    'frost still neither fills nor spends — that fight is the compost’s');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

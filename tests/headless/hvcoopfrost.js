/*
 * HV-159 — Weed the community lot said the co-op shares
 * the harvest, then frost still paid +4 food.
 *
 * The bulletin board posts "Weed the community lot" and
 * promises the garden co-op shares the harvest (+4 food).
 * The camp garden already knows frost: a cold sky yields
 * nothing. The co-op beds sit under the same sky, and the
 * job still handed over a full harvest.
 *
 * #791 is the camp garden's dawn yield. #819 is the rain
 * barrel staying full through frost. #838 is rain watering
 * the camp beds. This is the board's harvest share.
 *
 *  A. Source: the job still shares a harvest; the odd-job
 *     finish reads a cold sky for gardenh.
 *  B. A live frost weeding pays 0 food and names the frost.
 *  C. A clear day still pays +4. Rain still pays +4.
 *  D. The job still closes the day. Toolbox still adds +2.
 *  E. The camp garden's own frost yield is unchanged.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production finishAction(oddjob).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const odd = /\} else if\(a\.id==='oddjob'\)\{([\s\S]*?)\n  \} else if\(a\.id==='mural'\)/.exec(player);
ok(/id:'gardenh'[\s\S]{0,160}?shares the harvest/.test(cfg),
  'the community-lot job still shares the harvest');
ok(odd && /gardenh/.test(odd[1]) && /weather/.test(odd[1]) && /cold/.test(odd[1]),
  'HV-159: the odd-job finish reads a frost sky for the co-op harvest');

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
    if (!sessionStorage.getItem('hvcoopfrost-init')) {
      sessionStorage.setItem('hvcoopfrost-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const frost = await page.evaluate(() => {
    G.days = 2; // gardenh
    G.weather = 'cold';
    G.food = 10;
    G.oddJobDay = -9;
    G.structures.toolbox = false;
    G.goalIndex = GOALS.length;
    finishAction(oddJobAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: todaysJob().id,
      food: G.food,
      day: G.oddJobDay === G.days,
      named: /frost|nothing to share/i.test(log),
    };
  });
  ok(frost.job === 'gardenh' && frost.food === 10 && frost.named && frost.day,
    'HV-159: frost weeding pays 0 food, names the frost, and closes the day');

  const skies = await page.evaluate(() => {
    const run = (w) => {
      G.days = 2;
      G.weather = w;
      G.food = 10;
      G.oddJobDay = -9;
      G.structures.toolbox = false;
      finishAction(oddJobAction());
      return G.food - 10;
    };
    return { clear: run('clear'), rain: run('rain'), heat: run('heat') };
  });
  ok(skies.clear === 4 && skies.rain === 4 && skies.heat === 4,
    'clear, rain and heat still share +4');

  const tools = await page.evaluate(() => {
    G.days = 2;
    G.weather = 'cold';
    G.food = 10;
    G.goodwill = 0;
    G.oddJobDay = -9;
    G.structures.toolbox = true;
    finishAction(oddJobAction());
    return { food: G.food, gw: G.goodwill };
  });
  ok(tools.food === 10 && tools.gw === 2,
    'frost still pays no harvest; the tool box still adds +2 goodwill');

  const beds = await page.evaluate(() => {
    const real = Math.random; Math.random = () => 0.99;
    G.structures.garden = true;
    G.structures.compost = false;
    G.structures.barrel = false;
    G.weather = 'cold';
    G.forecast = 'cold';
    G.food = 20;
    G.population = 1;
    G.lastEventDay = G.days + 5;
    G.dog = 0;
    const before = G.food;
    onNewDay();
    Math.random = real;
    return { delta: G.food - before, weather: G.weather };
  });
  ok(beds.weather === 'cold' && beds.delta <= 0,
    'the camp garden still gives nothing on frost');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

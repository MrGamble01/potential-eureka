/* HV-277 — the Cook said meals from food automatically,
 * then a scorcher still fired the pot.
 *
 * Dawn names it: "A scorcher." The Cook hire line is
 * "Makes meals from food automatically." Soup night already
 * feels the heat (#961). The hired pot never did. A pinned
 * heat dawn still spent 3 food for +2 goodwill.
 *
 * #935 is illness at the same hire. #961 is soup night on
 * a scorcher. #862 is the kitchen vs the Cook. This is the
 * heat sky at the Cook.
 *
 *  A. Source: dawn still says a scorcher. The hire still
 *     promises meals automatically.
 *  B. Source: the Cook haul reads weather==='heat'.
 *     ui.js does not.
 *  C. Live: a heat dawn leaves the pot dark (food 8.5,
 *     gw 0) and names the scorcher.
 *  D. A clear dawn still cooks (food 5.5, gw 2).
 *  E. Cold and rain still cook. No hire still spends
 *     nothing. Soup night on a scorcher still fires
 *     (not this ticket).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production dawn cook.
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

const onNew = /function onNewDay\(\)\{([\s\S]*?)\nfunction /.exec(loop);
const body = onNew ? onNew[1] : '';
const cook = /if\(G\.workers\.cook&&G\.food>=3\)\{[\s\S]*?The Cook prepared meals[\s\S]*?\}/.exec(body);
const pot = cook ? cook[0] : '';

ok(/A scorcher\. Foot traffic is up/.test(loop)
  && /id:'cook'[\s\S]{0,120}?Makes meals from food automatically/.test(cfg),
  'dawn still says a scorcher; the Cook still makes meals automatically');
ok(pot && /weather\s*===\s*'heat'/.test(pot),
  'HV-277: the Cook haul reads a scorcher');
ok(!/workers\.cook/.test(ui) && !/weather\s*===\s*'heat'/.test(ui),
  'ui.js untouched — the pot stays dark on the dawn path');

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
    if (!sessionStorage.getItem('hvcookheat-init')) {
      sessionStorage.setItem('hvcookheat-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (opts) => page.evaluate((o) => {
    const lines = [];
    const realLog = log;
    log = function (s) { lines.push(String(s)); realLog(s); };
    const real = Math.random;
    Math.random = () => o.roll;
    G.days = 2;
    G.dog = 0;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.food = 10;
    G.population = 1;
    G.health = 90; G.warmth = 90; G.morale = 50;
    G.goodwill = 0; G.rep = 0;
    G.workers = { scrapper: false, builder: false, cook: !!o.hire, lookout: false };
    G.structures.garden = false;
    G.structures.compost = false;
    G.structures.soup_kitchen = !!o.soup;
    G.structures.pantry = false;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.barrel = false;
    G.forecast = o.weather;
    G.weather = 'clear';
    G.season = 0;
    G.lastEventDay = G.days + 5;
    G.goalIndex = GOALS.length;
    G.arcStage = 0; G.arcDone = true;
    G.snapUntil = null; G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false;
    G.ticketsSent = 0; G.ticketAsk = null; G.newcomerAsk = null;
    SNAP_CHANCE = 0;
    onNewDay();
    Math.random = real;
    log = realLog;
    const text = lines.join(' ');
    return {
      weather: G.weather,
      food: G.food,
      gw: G.goodwill,
      cooked: /The Cook prepared meals/.test(text),
      named: /left the pot|pot dark|nobody wanted a hot meal/i.test(text),
      soup: /Soup night/.test(text),
    };
  }, opts);

  // drain is 1.5; cook spends 3 for +2. roll 0.99 keeps extras quiet.
  const heat = await dawn({ hire: true, weather: 'heat', soup: false, roll: 0.99 });
  ok(heat.weather === 'heat' && heat.food === 8.5 && heat.gw === 0 && !heat.cooked,
    `HV-277: a scorcher leaves the pot dark (food ${heat.food}, gw ${heat.gw})`);
  ok(heat.named, 'the log names the scorcher at the Cook');

  const clear = await dawn({ hire: true, weather: 'clear', soup: false, roll: 0.99 });
  ok(clear.weather === 'clear' && clear.food === 5.5 && clear.gw === 2 && clear.cooked,
    `a clear dawn still cooks (food ${clear.food}, gw ${clear.gw})`);

  const cold = await dawn({ hire: true, weather: 'cold', soup: false, roll: 0.99 });
  ok(cold.food === 5.5 && cold.gw === 2 && cold.cooked,
    `a cold dawn still cooks (cold is not this ticket)`);

  const rain = await dawn({ hire: true, weather: 'rain', soup: false, roll: 0.99 });
  ok(rain.food === 5.5 && rain.gw === 2 && rain.cooked,
    `a rainy dawn still cooks (rain is not this ticket)`);

  const none = await dawn({ hire: false, weather: 'heat', soup: false, roll: 0.99 });
  ok(none.food === 8.5 && none.gw === 0 && !none.cooked,
    `no Cook still spends nothing on a scorcher`);

  const soup = await dawn({ hire: true, weather: 'heat', soup: true, roll: 0.99 });
  ok(soup.soup,
    'soup night on a scorcher still fires (the kitchen is not this ticket)');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

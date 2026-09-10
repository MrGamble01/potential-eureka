/* HV-274 — the Scrapper said auto-scavenges every day,
 * then a cold morning still paid a summer haul.
 *
 * Dawn names it: "The cold gets into everything." The Scrapper
 * hire line is "Auto-scavenges every day." Player dumpsters
 * already feel a cold sky (scav 0.75). The hired haul never
 * did. A pinned 0.99 roll that pays 3 scraps / 2 cans on a
 * clear dawn still paid summer after a cold sky landed.
 *
 * #788 / HV-108 is winter (the season) at the same hire.
 * #934 / HV-239 is a named snap on a clear dawn. #753 is
 * the lock card. This is the cold sky at the Scrapper.
 *
 *  A. Source: dawn still says the cold gets into everything.
 *     The hire still promises auto-scavenges every day.
 *  B. Source: the Scrapper haul reads weather==='cold'.
 *     ui.js does not.
 *  C. Live: a pinned cold dawn pays 2 scraps / 1 can
 *     and names the cold.
 *  D. The same roll on a clear dawn still pays 3 / 2.
 *  E. A clear winter morning still pays 3 / 2 — season
 *     is HV-108's fight, not this one.
 *  F. A named snap under a clear sky still pays 3 / 2
 *     — the snap is HV-239's fight, not this one.
 *  G. Rain and heat still pay 3 / 2. A camp with no
 *     Scrapper still pays nothing.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production dawn haul.
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
const scrap = /if\(G\.workers\.scrapper\)\{[\s\S]*?The Scrapper found some supplies\.[\s\S]*?\}/.exec(body);
const haul = scrap ? scrap[0] : '';

ok(/The cold gets into everything/.test(loop)
  && /id:'scrapper'[\s\S]{0,120}?Auto-scavenges every day/.test(cfg)
  && /scav:0\.75/.test(cfg),
  'dawn still says the cold gets into everything; the hire still auto-scavenges; cold scav is 0.75');
ok(haul && /weather\s*===\s*'cold'/.test(haul),
  'HV-274: the Scrapper haul reads a cold sky');
ok(!/workers\.scrapper/.test(ui) && !/weather\s*===\s*'cold'/.test(ui),
  'ui.js untouched — the cut lives on the dawn haul');

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
    if (!sessionStorage.getItem('hvscrapcold-init')) {
      sessionStorage.setItem('hvscrapcold-init', '1');
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
    G.days = o.days;
    G.dog = 0;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.food = 40;
    G.population = 1;
    G.health = 90; G.warmth = 90; G.morale = 50;
    G.goodwill = 0; G.rep = 0;
    G.scraps = 0; G.cans = 0;
    G.workers = { scrapper: !!o.hire, builder: false, cook: false, lookout: false };
    G.structures.garden = false;
    G.structures.compost = false;
    G.structures.soup_kitchen = false;
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
    G.snapUntil = o.snap ? G.days + 9 : null;
    G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false;
    G.ticketsSent = 0; G.ticketAsk = null; G.newcomerAsk = null;
    SNAP_CHANCE = 0;
    onNewDay();
    Math.random = real;
    log = realLog;
    return {
      weather: G.weather,
      scraps: G.scraps,
      cans: G.cans,
      hired: !!G.workers.scrapper,
      named: /cold/i.test(lines.join(' ')) && /thinner|haul/i.test(lines.join(' ')),
      log: lines.join(' '),
    };
  }, opts);

  // roll 0.99: rand(1,3) → 3; rand(0,2) → 2
  const cold = await dawn({ hire: true, weather: 'cold', days: 2, roll: 0.99, snap: false });
  ok(cold.weather === 'cold' && cold.scraps === 2 && cold.cans === 1,
    `HV-274: a cold Scrapper dawn pays a thinner haul (scraps ${cold.scraps}, cans ${cold.cans})`);
  ok(cold.named, 'the log names the cold at the haul');

  const clear = await dawn({ hire: true, weather: 'clear', days: 2, roll: 0.99, snap: false });
  ok(clear.weather === 'clear' && clear.scraps === 3 && clear.cans === 2,
    `a clear Scrapper dawn still pays 3 / 2 (scraps ${clear.scraps}, cans ${clear.cans})`);

  const winter = await dawn({ hire: true, weather: 'clear', days: 20, roll: 0.99, snap: false });
  ok(winter.weather === 'clear' && winter.scraps === 3 && winter.cans === 2,
    `a clear winter morning still pays 3 / 2 (season is not this ticket)`);

  const snap = await dawn({ hire: true, weather: 'clear', days: 2, roll: 0.99, snap: true });
  ok(snap.weather === 'clear' && snap.scraps === 3 && snap.cans === 2,
    `a named snap under a clear sky still pays 3 / 2 (the snap is not this ticket)`);

  const rain = await dawn({ hire: true, weather: 'rain', days: 2, roll: 0.99, snap: false });
  ok(rain.weather === 'rain' && rain.scraps === 3 && rain.cans === 2,
    `a rainy Scrapper dawn still pays 3 / 2 (rain is not this ticket)`);

  const heat = await dawn({ hire: true, weather: 'heat', days: 2, roll: 0.99, snap: false });
  ok(heat.weather === 'heat' && heat.scraps === 3 && heat.cans === 2,
    `a scorcher still pays 3 / 2 (heat is not this ticket)`);

  const none = await dawn({ hire: false, weather: 'cold', days: 2, roll: 0.99, snap: false });
  ok(none.hired === false && none.scraps === 0 && none.cans === 0,
    `no Scrapper still pays nothing on a cold dawn (scraps ${none.scraps})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

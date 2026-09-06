/* HV-73 — the Scrapper never scavenged.
 *
 * Hire tooltip: "Auto-scavenges every day." Walking a dumpster always
 * ticks G.totalScavenged (Keys in Hand reads it as "dumpsters dug
 * through") and finds food about 45% of the time. The dawn hook only
 * added scraps and cans. The Bridge never counted the work. The camp
 * never ate.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the hire still sells auto-scavenge; the dawn block ticks
 *    totalScavenged and can add food. ui.js is not touched.
 * B. Behaviour: a quiet dawn with a Scrapper hired increments
 *    totalScavenged by 1. The same dawn without a Scrapper does not.
 *    Reverting the tick fails the named count.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const scrapAt = loop.indexOf('if(G.workers.scrapper)');
const scrapEnd = loop.indexOf('if(G.workers.cook', scrapAt);
const scrap = scrapAt >= 0 ? loop.slice(scrapAt, scrapEnd > scrapAt ? scrapEnd : scrapAt + 800) : '';
const cookAt = loop.indexOf('if(G.workers.cook');

ok(/Auto-scavenges every day/.test(cfg),
   'the Scrapper still sells auto-scavenge on the hire row');
ok(/G\.totalScavenged\+\+/.test(player) && /dumpsters dug through/.test(ui),
   'walking a dumpster still ticks the Bridge count — guards the guard');
ok(scrapAt >= 0 && /G\.scraps\s*\+=/.test(scrap) && /G\.cans\s*\+=/.test(scrap),
   'dawn still pockets scraps and cans — that half already worked');
ok(/totalScavenged\+\+/.test(scrap),
   'HV-73: the dawn scavenge ticks totalScavenged like a dumpster walk');
ok(/G\.food\s*\+=/.test(scrap),
   'HV-73: the dawn scavenge can find food, like a dumpster walk');
ok(cookAt > scrapAt && cookAt > 0,
   'the Cook stays after the Scrapper — that pot is not this ticket');
ok(!/workers\.scrapper/.test(ui) && !/function onNewDay/.test(ui),
   'ui.js is not this ticket — it still only paints the Community row');

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
    row: !!(typeof WORKER_DEFS !== 'undefined' && WORKER_DEFS.some(w => w.id === 'scrapper' && /Auto-scavenges/.test(w.desc))),
  }));
  ok(!boot.intro && boot.row,
     'a returning camp can still hire a Scrapper');

  const dawn = (hire) => page.evaluate((hire) => {
    const real = Math.random;
    Math.random = () => 0.9;
    G.dog = 1; G.dogMetDay = 999;
    G.structures.tent = false; G.structures.workbench = false;
    G.structures.toolbox = false; G.structures.garden = false;
    G.structures.barrel = false; G.structures.soup_kitchen = false;
    G.structures.coats = false; G.structures.compost = false;
    G.workers.cook = false;
    G.workers.scrapper = hire;
    G.rep = 0; G.snapUntil = null; G.warmth = 40; G.forecast = 'clear';
    G.lastEventDay = 9999; G.rainBetOn = false; G.mural = 0;
    G.petitions = {}; G.arcStage = 3; G.arcDone = true;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.goalIndex = 9999;
    G.population = 1; G.food = 10; G.scraps = 0; G.cans = 0;
    if (typeof logFeed !== 'undefined') logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    const scav0 = G.totalScavenged;
    onNewDay();
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { scav: G.totalScavenged, scav0, scraps: G.scraps, cans: G.cans, feed };
  }, hire);

  const hired = await dawn(true);
  ok(/The Scrapper found some supplies/.test(hired.feed),
     'the Scrapper still logs the haul');
  ok(hired.scraps > 0 || hired.cans > 0,
     `scraps and cans still show up (scraps ${hired.scraps}, cans ${hired.cans})`);
  ok(hired.scav === hired.scav0 + 1,
     `HV-73: a dawn with a Scrapper counts as a dumpster dug (${hired.scav0} -> ${hired.scav})`);

  const none = await dawn(false);
  ok(!/The Scrapper found some supplies/.test(none.feed),
     'without a Scrapper there is no haul line');
  ok(none.scav === none.scav0,
     `without a Scrapper the Bridge count holds (stayed ${none.scav})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

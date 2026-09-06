/* HV-87 — Dumpsters Locked said nothing to scavenge today,
 * and the Scrapper still dug.
 *
 * The event card promises: "Nothing to scavenge today."
 * Player Scavenge and Forage honor G.dumpsterLockDay (HV-63).
 * The hired Scrapper's dawn haul does not. It also runs in
 * onNewDay BEFORE maybeEvent(), so the same morning the card
 * lands the log already says "The Scrapper found some supplies."
 *
 * #730 is the haul never ticking dumpsters / food. This ticket
 * is the lock. #714 was the player's minute timer.
 *
 * Write-first, hook-free, source-driven.
 *
 * A. The card still says today. The Scrapper still auto-scavenges
 *    every day — except a locked day. The haul sits after
 *    maybeEvent so the stamp exists before the dig. ui.js is
 *    not touched. player.js still refuses the walk.
 * B. Live: an open morning the Scrapper still hauls. The same
 *    dawn the lock card lands, scraps and cans do not move.
 *    A new dawn with the bins open, the Scrapper hauls again.
 *
 * Named assertion: HV-87: Dumpsters Locked keeps the Scrapper out of the bins
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

const evAt = loop.indexOf("id:'dumpster_locked'");
const ev = evAt >= 0 ? loop.slice(evAt, evAt + 700) : '';
const onAt = loop.indexOf('function onNewDay');
const onEnd = loop.indexOf('function bumpRegular');
const onFn = onAt >= 0 && onEnd > onAt ? loop.slice(onAt, onEnd) : '';
const scrapAt = onFn.indexOf('G.workers.scrapper');
const evCallAt = onFn.indexOf('maybeEvent()');
const scrapLine = scrapAt >= 0 ? onFn.slice(scrapAt, scrapAt + 280) : '';

(async () => {
  ok(/Nothing to scavenge today/i.test(ev),
     `the Dumpsters Locked card still promises today (got ${JSON.stringify((ev.match(/desc:'[^']+'/)||[''])[0])})`);

  ok(/id:'scrapper'/.test(cfg) && /Auto-scavenges every day/.test(cfg),
     'the Scrapper hire still promises a dawn haul every day');

  ok(scrapAt > evCallAt && evCallAt >= 0,
     'the Scrapper hauls after maybeEvent can stamp the lock');

  ok(/dumpsterLockDay/.test(scrapLine),
     'the dawn haul honors dumpsterLockDay — not a free dig on a locked day');

  ok(/dumpsterLockDay===G\.days/.test(player.replace(/\s/g,'')) && /scavenge/.test(player) && /forage/.test(player),
     'player.js still refuses Scavenge/Forage on a locked day — HV-63 stays');

  ok(!/dumpsterLockDay/.test(ui) && !/workers\.scrapper/.test(ui),
     'ui.js is not this ticket — it still only renders the hire and the banner');

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
    ev: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'dumpster_locked')),
    worker: !!(typeof WORKER_DEFS !== 'undefined' && WORKER_DEFS.some(w => w.id === 'scrapper')),
    lock: typeof G.dumpsterLockDay === 'number' ? G.dumpsterLockDay : null,
  }));
  ok(!boot.intro && boot.ev && boot.worker,
     'a returning camp can hire a Scrapper and draw Dumpsters Locked');
  ok(boot.lock === -1,
     `a fresh camp is not locked (dumpsterLockDay ${boot.lock})`);

  const open = await page.evaluate(() => {
    const real = maybeEvent;
    maybeEvent = function(){};
    G.workers.scrapper = true;
    G.workers.cook = false;
    G.workers.lookout = false;
    G.food = 80; G.warmth = 90; G.health = 90; G.morale = 80;
    G.population = 1; G.dog = 0;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.barrel = false;
    G.structures.coats = false;
    G.scraps = 10; G.cans = 10;
    G.days = 3; G.lastEventDay = G.days;
    G.dumpsterLockDay = -1;
    const scraps0 = G.scraps, cans0 = G.cans;
    onNewDay();
    maybeEvent = real;
    return {
      scraps0, cans0, scraps: G.scraps, cans: G.cans,
      days: G.days, lockDay: G.dumpsterLockDay,
    };
  });
  ok(open.scraps > open.scraps0 || open.cans > open.cans0,
     `an open morning the Scrapper still hauls (scraps ${open.scraps0}→${open.scraps}, cans ${open.cans0}→${open.cans})`);

  const locked = await page.evaluate(() => {
    const real = maybeEvent;
    maybeEvent = function(){
      EVENTS_BAD.find(e => e.id === 'dumpster_locked').effect();
    };
    G.workers.scrapper = true;
    G.workers.cook = false;
    G.workers.lookout = false;
    G.food = 80; G.warmth = 90; G.health = 90; G.morale = 80;
    G.population = 1; G.dog = 0;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.barrel = false;
    G.structures.coats = false;
    G.scraps = 10; G.cans = 10;
    G.days = 5; G.lastEventDay = 0;
    G.dumpsterLockDay = -1;
    const scraps0 = G.scraps, cans0 = G.cans;
    onNewDay();
    maybeEvent = real;
    const bin = (typeof dumpsters !== 'undefined' && dumpsters[0]) ? dumpsters[0] : null;
    if (bin && typeof player !== 'undefined') player.position.set(bin.position.x, 0, bin.position.z);
    G.cooldowns = {};
    delete activeJobs.scavenge;
    doAction(ACTIONS.find(a => a.id === 'scavenge'));
    const scavStarted = !!activeJobs.scavenge;
    delete activeJobs.scavenge;
    return {
      scraps0, cans0, scraps: G.scraps, cans: G.cans,
      days: G.days, lockDay: G.dumpsterLockDay, scavStarted,
    };
  });
  ok(locked.lockDay === locked.days,
     `the lock is stamped on today (lockDay ${locked.lockDay}, day ${locked.days})`);
  ok(locked.scraps === locked.scraps0 && locked.cans === locked.cans0,
     `HV-87: Dumpsters Locked keeps the Scrapper out of the bins (scraps ${locked.scraps0}→${locked.scraps}, cans ${locked.cans0}→${locked.cans})`);
  ok(!locked.scavStarted,
     `the player's walk is still refused on the lock day (started=${locked.scavStarted})`);

  const next = await page.evaluate(() => {
    const real = maybeEvent;
    maybeEvent = function(){};
    G.workers.scrapper = true;
    G.scraps = 10; G.cans = 10;
    G.food = 80; G.warmth = 90; G.health = 90; G.morale = 80;
    G.population = 1; G.dog = 0;
    const scraps0 = G.scraps, cans0 = G.cans;
    const lockWas = G.dumpsterLockDay;
    onNewDay();
    maybeEvent = real;
    return {
      scraps0, cans0, scraps: G.scraps, cans: G.cans,
      days: G.days, lockWas, lockDay: G.dumpsterLockDay,
    };
  });
  ok(next.days > next.lockWas && (next.scraps > next.scraps0 || next.cans > next.cans0),
     `a new dawn lifts it — the Scrapper hauls again (scraps ${next.scraps0}→${next.scraps}, day ${next.days})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

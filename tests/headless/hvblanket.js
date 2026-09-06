/* HV-75 — Blanket said "Keeps someone warm tonight" and only
 * added +15 warmth right now.
 *
 * The recipe promises a night: "Keeps someone warm tonight."
 * finishCraft applied gives.warmth (+15) and stopped. Dawn still
 * took the season's full base drain (8, or 18 in winter). Craft at
 * dusk, wake up colder than you wrapped them. Coat Rack and the
 * Empty Hook are the real overnight mechanics; this one was a
 * daytime hug wearing a night's name.
 *
 * Write-first, hook-free, source-driven.
 *
 * A. Source: the recipe still says tonight. finishCraft stamps
 *    G.blanketNight. onNewDay skips that night's seasonDrain.
 *    load migrates a missing stamp. ui.js is not touched.
 *    Firewood (also +warmth) does not steal the latch.
 * B. Live: craft a Blanket, warmth goes +15 and the day is stamped.
 *    A controlled winter dawn holds the warmth — the night the
 *    recipe named — instead of eating the +15. Firewood's +10
 *    still dies to the same dawn. A later dawn takes the full drain.
 *
 * Named assertion: HV-75: a dawn after a Blanket holds the night's
 * warmth, not just the standing +15.
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
const save   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const recAt = cfg.indexOf("id:'blanket'");
const rec = recAt >= 0 ? cfg.slice(recAt, recAt + 280) : '';
const finishAt = player.indexOf('function finishCraft');
const finish = finishAt >= 0 ? player.slice(finishAt, finishAt + 700) : '';
const dawnAt = loop.indexOf('function onNewDay(){');
const dawn = dawnAt >= 0 ? loop.slice(dawnAt, dawnAt + 2800) : '';

(async () => {
  // --- A. source --------------------------------------------------------
  ok(/tonight/i.test(rec),
     `the Blanket recipe still promises "tonight" (got ${JSON.stringify((rec.match(/desc:'[^']+'/)||[''])[0])})`);

  ok(/gives:\{warmth:15\}/.test(rec),
     'the standing +15 warmth is still on the recipe — that is not the night');

  ok(/r\.id===['"]blanket['"]/.test(finish) && /blanketNight\s*=\s*G\.days/.test(finish),
     'finishCraft stamps G.blanketNight on a Blanket — Firewood must not');

  ok(!/blanketNight/.test(finish.replace(/if\(r\.id===['"]blanket['"][\s\S]*?blanketNight[\s\S]*?\n/, '')),
     'only the Blanket branch writes the stamp — isolation from other +warmth crafts');

  ok(/blanketNight/.test(dawn) && /seasonDrain/.test(dawn) && /held through the night/.test(dawn),
     'onNewDay skips that night\'s seasonDrain and logs that the blanket held');

  ok(/blanketNight:\s*-1/.test(cfg),
     'G defaults blanketNight to -1 — no night pending on a fresh camp');

  ok(/typeof G\.blanketNight!=='number'/.test(save),
     'loadGame migrates a pre-HV-75 save that never wrote blanketNight');

  ok(!/blanketNight/.test(ui),
     'ui.js is not this ticket — it still only lists the recipe');

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
    rec: !!(typeof RECIPES !== 'undefined' && RECIPES.some(r => r.id === 'blanket')),
    night: typeof G.blanketNight === 'number' ? G.blanketNight : null,
  }));
  ok(!boot.intro && boot.rec,
     'a returning camp can craft a Blanket — not behind the crash course');
  ok(boot.night === -1,
     `a fresh camp has no night pending (blanketNight ${boot.night})`);

  // Craft at warmth 70 on day 20. After increment, day 21 is winter
  // (floor(21/7)%4 === 3), seasonDrain 18, forecast clear so no bite.
  const crafted = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'blanket');
    G.days = 20;
    G.warmth = 70;
    G.activeCrafts.blanket = { start: Date.now(), duration: 1 };
    finishCraft(r);
    saveGame();
    return { warmth: G.warmth, night: G.blanketNight, days: G.days };
  });
  ok(crafted.warmth === 85 && crafted.night === 20,
     `crafting a Blanket adds +15 and stamps the day (warmth ${crafted.warmth}, blanketNight ${crafted.night})`);

  const quietDawn = () => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 1; G.dogMetDay = 999;
    G.structures.tent = false; G.structures.coats = false;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.structures.garden = false; G.structures.barrel = false;
    G.structures.soup_kitchen = false; G.structures.compost = false;
    G.workers.scrapper = false; G.workers.cook = false;
    G.rep = 0; G.snapUntil = null; G.food = 20;
    G.forecast = 'clear'; G.lastEventDay = G.days + 5;
    G.rainBetOn = false; G.garageCover = false; G.mural = 0;
    G.petitions = {}; G.arcStage = 3; G.arcDone = true;
    G.friendDay = -1;
    onNewDay();
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { warmth: G.warmth, night: G.blanketNight, days: G.days, season: G.season, feed };
  };

  const afterDawn = await page.evaluate(quietDawn);
  ok(afterDawn.days === 21 && afterDawn.season === 3,
     `the controlled dawn is a winter morning (day ${afterDawn.days}, season ${afterDawn.season})`);
  ok(afterDawn.night === -1,
     `dawn spends the stamp (blanketNight ${afterDawn.night})`);
  ok(afterDawn.warmth === 85,
     `HV-75: a dawn after a Blanket holds the night's warmth, not just the standing +15 (warmth ${afterDawn.warmth})`);
  ok(/held through the night/.test(afterDawn.feed),
     'the log names the night the recipe promised');

  // Isolation: Firewood is also +warmth. Same winter dawn must still bite.
  const wood = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'fire_ration');
    G.days = 20;
    G.warmth = 70;
    G.blanketNight = -1;
    G.activeCrafts.fire_ration = { start: Date.now(), duration: 1 };
    finishCraft(r);
    const afterCraft = { warmth: G.warmth, night: G.blanketNight };
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 1; G.dogMetDay = 999;
    G.structures.tent = false; G.structures.coats = false;
    G.structures.workbench = false; G.structures.garden = false;
    G.structures.soup_kitchen = false; G.workers.scrapper = false;
    G.workers.cook = false; G.rep = 0; G.snapUntil = null; G.food = 20;
    G.forecast = 'clear'; G.lastEventDay = G.days + 5;
    G.rainBetOn = false; G.mural = 0; G.arcStage = 3; G.arcDone = true;
    G.friendDay = -1;
    onNewDay();
    Math.random = real;
    return { afterCraft, warmth: G.warmth, night: G.blanketNight, days: G.days };
  });
  ok(wood.afterCraft.warmth === 80 && wood.afterCraft.night === -1,
     `Firewood is still +10 and does not stamp the night (warmth ${wood.afterCraft.warmth}, blanketNight ${wood.afterCraft.night})`);
  ok(wood.warmth === 62,
     `Firewood's +10 still dies to the winter dawn (warmth ${wood.warmth}) — the latch is Blanket's`);

  // A later dawn, stamp already spent, takes the full winter drain.
  const second = await page.evaluate(() => {
    G.days = 20;
    G.warmth = 85;
    G.blanketNight = -1;
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 1; G.dogMetDay = 999;
    G.structures.tent = false; G.structures.coats = false;
    G.structures.workbench = false; G.structures.garden = false;
    G.structures.soup_kitchen = false; G.workers.scrapper = false;
    G.workers.cook = false; G.rep = 0; G.snapUntil = null; G.food = 20;
    G.forecast = 'clear'; G.lastEventDay = G.days + 5;
    G.rainBetOn = false; G.mural = 0; G.arcStage = 3; G.arcDone = true;
    G.friendDay = -1;
    onNewDay();
    Math.random = real;
    return { warmth: G.warmth, night: G.blanketNight };
  });
  ok(second.night === -1 && second.warmth === 67,
     `a dawn with no stamp takes the full winter 18 (warmth ${second.warmth})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

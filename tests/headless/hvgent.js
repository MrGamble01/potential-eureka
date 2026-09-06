/* HV-75 — Gentrification said harassment is increasing, and the
 * corner never got more hostile.
 *
 * The card promises: "New development nearby. Harassment from locals
 * is increasing." The effect was a one-shot morale/goodwill hit.
 * Panhandle — the action that talks to locals — kept the same 55%
 * clear-day odds. A player who read the card and walked to the
 * corner was not harassed any more than before.
 *
 * Same family as HV-63 (Dumpsters Locked said today, lasted a
 * minute) and HV-65 (Old Friend said briefly, lasted forever): the
 * card named a lasting condition and the code spent a wall-clock
 * instant. The lock is the day, not a timer.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the gentrify effect stamps G.gentrifyDay. Panhandle
 *    multiplies by GENTRIFY_PAN while gentrifyHostile() is true.
 *    No Date.now() on the effect. ui.js is not touched.
 * B. Behaviour: fire the card, a 0.40 roll that still succeeds on
 *    a clear day is ignored. A new day lifts it — the same roll
 *    pays. Isolation: without the stamp the 0.40 roll still pays.
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
const save   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const gentAt = loop.indexOf("id:'gentrify'");
const gent = gentAt >= 0 ? loop.slice(gentAt, gentAt + 700) : '';
const panAt = player.indexOf("a.id==='panhandle'");
const nextBranch = player.indexOf("} else if(a.id==='rest')");
const pan = panAt >= 0 && nextBranch > panAt ? player.slice(panAt, nextBranch) : '';

ok(gentAt >= 0 && /Harassment from locals is increasing/.test(gent),
   'the Gentrification card still promises harassment is increasing — guards the guard');

ok(/G\.gentrifyDay\s*=\s*G\.days/.test(gent),
   'the effect stamps G.gentrifyDay so dawn, not a wall-clock, owns the hostility');

ok(!/Date\.now\s*\(/.test(gent),
   'the gentrify effect does not use Date.now — HV-63 already retired that shape');

ok(/function gentrifyHostile\s*\(/.test(cfg) && /GENTRIFY_PAN/.test(cfg),
   'gentrifyHostile() and GENTRIFY_PAN live in config.js next to snapActive');

ok(/gentrifyHostile\s*\(/.test(pan) && /GENTRIFY_PAN/.test(pan),
   'HV-75: panhandle multiplies by GENTRIFY_PAN while the corner is hostile');

ok(/typeof G\.gentrifyDay!=='number'/.test(save),
   'loadGame migrates a pre-HV-75 save that never wrote gentrifyDay');

ok(!/gentrify/.test(ui) && !/gentrifyDay/.test(ui),
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
    ev: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'gentrify')),
    day: typeof G.gentrifyDay === 'number' ? G.gentrifyDay : null,
    helper: typeof gentrifyHostile === 'function' ? gentrifyHostile() : null,
    pan: typeof GENTRIFY_PAN === 'number' ? GENTRIFY_PAN : null,
  }));
  ok(!boot.intro && boot.ev,
     'a returning camp can fire Gentrification — not behind the crash course');
  ok(boot.day === -1 && boot.helper === false,
     `a fresh camp is not hostile (gentrifyDay ${boot.day}, hostile ${boot.helper})`);
  ok(boot.pan === 0.5,
     `GENTRIFY_PAN is a half-cut on the corner (${boot.pan})`);

  // A 0.40 roll still succeeds on a clear day (threshold 0.55) and
  // fails once the card halves the odds (threshold 0.275). That is
  // the named proof: the same locals, the same roll, more hostile.
  const isolation = await page.evaluate(() => {
    const quiet = () => {
      G.weather = 'clear';
      G.dog = 0; G.dogHungry = false;
      G.rep = 0; G.mural = 0; G.snapUntil = null;
      G.structures.awning = false;
      G.cooldowns = {};
      delete activeJobs.panhandle;
    };
    quiet();
    G.days = 4;
    G.gentrifyDay = -1;
    G.goodwill = 10;
    G.morale = 50;
    const real = Math.random;
    Math.random = () => 0.40;
    finishAction(ACTIONS.find(a => a.id === 'panhandle'));
    Math.random = real;
    return { gw: G.goodwill, morale: G.morale, hostile: gentrifyHostile() };
  });
  ok(isolation.gw > 10 && isolation.hostile === false,
     `isolation: a 0.40 roll still pays on a quiet corner (gw ${isolation.gw})`);

  const fired = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'gentrify');
    const real = Math.random;
    Math.random = () => 0;
    G.days = 4;
    G.morale = 50;
    G.goodwill = 20;
    triggerEvent(ev, false);
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return {
      day: G.gentrifyDay,
      days: G.days,
      hostile: gentrifyHostile(),
      morale: G.morale,
      gw: G.goodwill,
      feed,
    };
  });
  ok(fired.day === 4 && fired.hostile === true,
     `Gentrification stamps today and the corner goes hostile (gentrifyDay ${fired.day})`);
  ok(fired.morale < 50 && fired.gw < 20,
     `the one-shot hit still lands (morale ${fired.morale}, gw ${fired.gw})`);
  ok(/hostility/i.test(fired.feed),
     'the log still names the hostility');

  const during = await page.evaluate(() => {
    G.weather = 'clear';
    G.dog = 0; G.dogHungry = false;
    G.rep = 0; G.mural = 0; G.snapUntil = null;
    G.structures.awning = false;
    G.cooldowns = {};
    delete activeJobs.panhandle;
    G.goodwill = 10;
    G.morale = 40;
    const real = Math.random;
    Math.random = () => 0.40;
    finishAction(ACTIONS.find(a => a.id === 'panhandle'));
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { gw: G.goodwill, morale: G.morale, feed };
  });
  ok(during.gw === 10 && during.morale === 37,
     `HV-75: a 0.40 roll that still pays on a quiet corner is ignored while harassment is up (gw ${during.gw}, morale ${during.morale})`);
  ok(/Ignored again/.test(during.feed),
     'the ignored-again line is the player-visible harassment');

  // Dawn lifts it — same roll now pays. Advance the day without
  // onNewDay so the drain is not the thing under test.
  const dawn = await page.evaluate(() => {
    G.days = 5;
    G.weather = 'clear';
    G.dog = 0; G.dogHungry = false;
    G.rep = 0; G.mural = 0; G.snapUntil = null;
    G.structures.awning = false;
    G.cooldowns = {};
    delete activeJobs.panhandle;
    G.goodwill = 10;
    G.morale = 40;
    const hostile = gentrifyHostile();
    const real = Math.random;
    Math.random = () => 0.40;
    finishAction(ACTIONS.find(a => a.id === 'panhandle'));
    Math.random = real;
    return { gw: G.goodwill, hostile, day: G.gentrifyDay, days: G.days };
  });
  ok(dawn.hostile === false && dawn.gw > 10,
     `a new dawn lifts the hostility — the same 0.40 roll pays (gw ${dawn.gw}, gentrifyDay ${dawn.day})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

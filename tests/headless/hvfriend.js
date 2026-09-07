/* HV-65 — Old Friend's "briefly" survived a reload.
 *
 * The Old Friend event boosts morale and promises it fades: the card
 * says "The feeling fades quickly.", the log says "Morale surged —
 * briefly.", and two minutes later a setTimeout logs "The good feeling
 * from yesterday is gone."
 *
 * That timeout is the whole fade. It is not written to the save. A
 * reload, a crash, or a closed tab in those two minutes keeps the
 * surge and drops the fade. Autosave is every 30s, so a player who
 * got the event and refreshed — or just came back tomorrow — kept
 * the good feeling. "Yesterday" never arrived.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the old_friend effect has no setTimeout. The fade lives
 *    in onNewDay, gated on G.friendDay, the same dawn-latch idiom as
 *    muralDay / buskDay. ui.js is not touched.
 * B. Behaviour: fire the event, morale goes up and friendDay is
 *    stamped. Reload: the stamp and the surge survive. A controlled
 *    dawn applies the fade and the "yesterday" line. Reverting the
 *    dawn latch fails the named fade.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const save = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const friendAt = loop.indexOf("id:'old_friend'");
const friend = friendAt >= 0 ? loop.slice(friendAt, friendAt + 900) : '';
const dawnAt = loop.indexOf('function onNewDay(){');
const dawn = dawnAt >= 0 ? loop.slice(dawnAt, dawnAt + 2200) : '';

(async () => {
  // --- A. source --------------------------------------------------------
  ok(friendAt >= 0 && /id:'old_friend'/.test(friend),
     'Old Friend is still in the good-event pool — guards the guard');

  ok(!/setTimeout/.test(friend),
     'the old_friend effect has no setTimeout — that timer died on reload');

  ok(/G\.friendDay\s*=\s*G\.days/.test(friend),
     'the surge stamps G.friendDay so dawn, not a wall-clock, owns the fade');

  ok(/friendDay/.test(dawn) && /yesterday is gone/.test(dawn),
     'onNewDay applies the fade and the "yesterday" line');

  ok(/friendDay:\s*-1/.test(cfg) || /friendDay:\s*-1/.test(cfg.replace(/\s/g,'')),
     'G defaults friendDay to -1 — no fade pending on a fresh camp');

  ok(/typeof G\.friendDay!=='number'/.test(save),
     'loadGame migrates a pre-HV-65 save that never wrote friendDay');

  ok(!/friendDay/.test(ui) && !/old_friend/.test(ui),
     'ui.js is not this ticket — it still only shows the event banner');

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
    ev: !!(typeof EVENTS_GOOD !== 'undefined' && EVENTS_GOOD.some(e => e.id === 'old_friend')),
    day: typeof G.friendDay === 'number' ? G.friendDay : null,
    morale: G.morale,
  }));
  ok(!boot.intro && boot.ev,
     'a returning camp can fire Old Friend — not behind the crash course');
  ok(boot.day === -1,
     `a fresh camp has no fade pending (friendDay ${boot.day})`);

  // Deterministic boost: rand(12,20) with Math.random = 0 is 12.
  const fired = await page.evaluate(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'old_friend');
    const real = Math.random;
    Math.random = () => 0;
    G.morale = 50;
    G.days = 4;
    triggerEvent(ev, true);
    Math.random = real;
    saveGame();
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { morale: G.morale, day: G.friendDay, days: G.days, feed };
  });
  ok(fired.morale === 62 && fired.day === 4,
     `Old Friend boosts morale and stamps the day (morale ${fired.morale}, friendDay ${fired.day})`);
  ok(/briefly/.test(fired.feed),
     'the surge still logs as brief');

  // Reload: the timeout is gone. Without a dawn latch the surge would
  // sit there forever. With it, friendDay and morale both come back.
  await page.reload({ waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const reloaded = await page.evaluate(() => ({
    morale: G.morale, day: G.friendDay, days: G.days,
  }));
  ok(reloaded.morale === 62 && reloaded.day === 4 && reloaded.days === 4,
     `the surge and the stamp survive a reload (morale ${reloaded.morale}, friendDay ${reloaded.day})`);

  // Controlled dawn — same shape as hvborrow. random=0.5 keeps weather
  // and events quiet; random=0 on the fade roll makes rand(8,14) = 8.
  // Dawn also does the standing morale-3, so 62 → 51 if the fade landed.
  const afterDawn = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 1; G.dogMetDay = 999;
    G.structures.tent = false;
    G.workers.scrapper = false; G.workers.cook = false;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.structures.garden = false; G.structures.barrel = false;
    G.structures.soup_kitchen = false; G.structures.coats = false;
    G.rep = 0; G.snapUntil = null; G.warmth = 40; G.food = 20;
    G.forecast = 'clear'; G.lastEventDay = G.days + 5;
    G.rainBetOn = false; G.garageCover = false; G.mural = 0;
    G.petitions = {}; G.arcStage = 3; G.arcDone = true;
    Math.random = () => 0;
    onNewDay();
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { morale: G.morale, day: G.friendDay, days: G.days, feed };
  });
  ok(afterDawn.days === 5 && afterDawn.day === -1,
     `dawn clears the stamp (days ${afterDawn.days}, friendDay ${afterDawn.day})`);
  ok(afterDawn.morale === 51,
     `HV-65: a dawn after Old Friend applies the fade, not just the standing -3 (morale ${afterDawn.morale})`);
  ok(/yesterday is gone/.test(afterDawn.feed),
     'the "yesterday" line lands on the dawn, not on a two-minute timer');

  // A second dawn must not fade again.
  const second = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 1; G.dogMetDay = 999; G.structures.tent = false;
    G.workers.scrapper = false; G.workers.cook = false;
    G.structures.workbench = false; G.structures.garden = false;
    G.structures.soup_kitchen = false; G.rep = 0; G.snapUntil = null;
    G.warmth = 40; G.food = 20; G.forecast = 'clear';
    G.lastEventDay = G.days + 5; G.rainBetOn = false; G.mural = 0;
    G.arcStage = 3; G.arcDone = true;
    const before = G.morale;
    onNewDay();
    Math.random = real;
    return { before, morale: G.morale, day: G.friendDay };
  });
  ok(second.day === -1 && second.morale === second.before - 3,
     `a later dawn only takes the standing -3 (morale ${second.before} -> ${second.morale})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

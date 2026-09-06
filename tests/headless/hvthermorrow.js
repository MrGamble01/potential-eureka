/* HV-93 — the thermos said it refills tomorrow, and dawn never poured.
 *
 * After the first pass the log says: "it refills tomorrow."
 * thermosUsed is a session flag. onNewDay never clears it. Wait a
 * dawn, click again, and the same line fires. Tomorrow never arrives.
 *
 * Same family as HV-63 (Dumpsters Locked said today, lasted a minute):
 * the copy named a day, the code used a latch that does not see dawn.
 * Not HV-35 (the heirloom itself). Not the other memory-chain
 * "today"/"tonight" refuses — only this one promised tomorrow.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the refuse log still says tomorrow; onNewDay clears
 *    thermosUsed. ui.js is not touched.
 * B. Behaviour: a pass, then a dawn, then a second pass pays again.
 *    Isolation: two passes the same day, no dawn, still refuse.
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

const thermosAt = player.indexOf("a.id==='thermos'");
const nextAct = player.indexOf("a.id==='marisol'");
const thermos = thermosAt >= 0 && nextAct > thermosAt ? player.slice(thermosAt, nextAct) : '';
const dawnAt = loop.indexOf('function onNewDay(){');
const dawn = dawnAt >= 0 ? loop.slice(dawnAt, dawnAt + 2200) : '';

ok(thermosAt >= 0 && /refills tomorrow/.test(thermos),
   'the refuse log still promises tomorrow — that is the promise under test');

ok(/thermosUsed\s*=\s*false/.test(dawn),
   'HV-93: onNewDay clears thermosUsed so tomorrow actually pours');

const thermosTip = /id:'thermos'[\s\S]{0,360}?tooltip:'([^']+)'/.exec(cfg);
ok(thermosTip && /once a day/.test(thermosTip[1]),
   'the tooltip agrees with the log — once a day, not a sitting that never ends');

ok(!/thermosUsed/.test(ui) && !/refills tomorrow/.test(ui),
   'ui.js is not this ticket — it still only draws the action row');

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
    row: !!(typeof ACTIONS !== 'undefined' && ACTIONS.some(a => a.id === 'thermos')),
  }));
  ok(!boot.intro && boot.row,
     'a returning camp can pass the thermos — not behind the crash course');

  // Warm the bridge so the pass is allowed (same seed as hvthermos.js).
  const first = await page.evaluate(() => {
    saveHvRec({ days: 14, beats: 4 });
    saveHvNote({ read: 2 });
    G.morale = 50;
    thermosUsed = false;
    const before = { morale: G.morale, uses: loadThermos().uses };
    finishAction({ id: 'thermos' });
    return {
      paid: G.morale - before.morale,
      uses: loadThermos().uses,
      used: thermosUsed,
      power: thermosPower(),
    };
  });
  ok(first.paid === first.power && first.uses === 1 && first.used,
     `a first pass still pays (morale +${first.paid}, uses ${first.uses})`);

  const sameDay = await page.evaluate(() => {
    const uses = loadThermos().uses;
    const morale = G.morale;
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    finishAction({ id: 'thermos' });
    log = prev;
    return {
      uses: loadThermos().uses,
      morale: G.morale,
      used: thermosUsed,
      log: heard.join(' '),
    };
  });
  ok(sameDay.uses === 1 && sameDay.morale === first.paid + 50 && sameDay.used,
     'isolation: two passes the same day, no dawn, still refuse');
  ok(/tomorrow/.test(sameDay.log),
     'the same-day refuse still says tomorrow');

  // Park dawn like hvfire.js so the only latch under test is the thermos.
  const afterDawn = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
    G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.weather = 'clear';
    G.food = 20; G.population = 1; G.rep = 0;
    G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false;
    G.structures.soup_kitchen = false; G.structures.garden = false;
    G.structures.coats = false; G.mural = 0; G.season = 0;
    G.warmth = 80;
    onNewDay();
    Math.random = real;
    return { used: thermosUsed, days: G.days };
  });
  ok(afterDawn.used === false,
     `HV-93: dawn clears the latch (thermosUsed ${afterDawn.used})`);

  const tomorrow = await page.evaluate(() => {
    G.morale = 50;
    const uses = loadThermos().uses;
    finishAction({ id: 'thermos' });
    return {
      paid: G.morale - 50,
      uses: loadThermos().uses,
      used: thermosUsed,
      before: uses,
    };
  });
  ok(tomorrow.paid === first.power && tomorrow.uses === tomorrow.before + 1 && tomorrow.used,
     `HV-93: a dawn later the thermos pours again (uses ${tomorrow.uses})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

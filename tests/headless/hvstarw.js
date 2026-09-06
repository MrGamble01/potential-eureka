/*
 * HV-129 — the Chalk Star said word gets around.
 *
 * A beaten hold under the star logs "word gets around, and neighbors
 * leave groceries." Groceries land (+3 food). Word on the Street is
 * the neighborhood's name for reputation — the same phrase that
 * fires when a tier crosses. addRep never ran. hvstar only pins
 * food and cheers, so the line was invisible.
 *
 *  A. Source: recordDays' star branch calls addRep.
 *  B. The log still says word gets around.
 *  C. A hold under the star moves Word (+HVSTAR_REP) and still pays
 *     the groceries.
 *  D. A starless wall still rings dry — no food, no Word.
 *  E. The Long Memory's own +3 morale still pays without a star.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives recordDays the same way hvstar does.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const rec = /function recordDays\(d\)\{([\s\S]*?)\n\}/.exec(cfg);
const star = rec && /if\s*\(\s*starStood\s*\)\{([\s\S]*?)\n    \}/.exec(rec[1]);
ok(!!rec && !!star, 'recordDays still pays the chalk star in config.js');
ok(star && /word gets around/.test(star[1]),
  'the chalk star still says word gets around');
ok(star && /addRep\s*\(\s*HVSTAR_REP\s*\)/.test(star[1]),
  'HV-129: a hold under the star moves Word on the Street');
ok(/HVSTAR_REP\s*=\s*2/.test(cfg) && /HVSTAR_FOOD\s*=\s*3/.test(cfg),
  'HVSTAR_REP is 2 and the groceries are still +3 food');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    executablePath: process.env.CHROME_PATH || undefined,
  };
  if (!launch.executablePath) delete launch.executablePath;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvstarw-init')) {
      sessionStorage.setItem('hvstarw-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-plaque');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const under = await page.evaluate(() => {
    saveHvRec({ days: 5, beats: 3 });
    saveHvStar({ cheers: 0 });
    hvRecMark = null; hvRecRung = false;
    G.food = 10;
    G.rep = 20;
    G.morale = 50;
    if (typeof logFeed !== 'undefined' && logFeed) logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    recordDays(6);
    const log = Array.from(document.querySelectorAll('.log-line'))
      .map(d => d.textContent).join(' ');
    return {
      food: G.food, rep: G.rep, morale: G.morale,
      cheers: loadHvStar().cheers, beats: loadHvRec().beats, log,
    };
  });
  ok(under.food === 13 && under.cheers === 1 && under.beats === 4,
    `groceries still land under the star (food ${under.food}, cheers ${under.cheers})`);
  ok(under.rep === 22,
    `HV-129: word gets around — Word moves 20 → ${under.rep}`);
  ok(/word gets around/i.test(under.log) && /\+2/.test(under.log),
    `the log names Word (${under.log.slice(-120)})`);

  const dry = await page.evaluate(() => {
    saveHvRec({ days: 8, beats: 1 });
    saveHvStar({ cheers: 0 });
    hvRecMark = null; hvRecRung = false;
    G.food = 10;
    G.rep = 20;
    recordDays(9);
    return { food: G.food, rep: G.rep, cheers: loadHvStar().cheers };
  });
  ok(dry.food === 10 && dry.rep === 20 && dry.cheers === 0,
    `a starless wall still rings dry (food ${dry.food}, rep ${dry.rep})`);

  const memory = await page.evaluate(() => {
    saveHvRec({ days: 4, beats: 0 });
    saveHvStar({ cheers: 0 });
    hvRecMark = null; hvRecRung = false;
    G.rep = 20;
    G.morale = 50;
    recordDays(3);
    recordDays(5);
    return { morale: G.morale, rep: G.rep, beats: loadHvRec().beats };
  });
  ok(memory.morale === 53 && memory.rep === 20 && memory.beats === 1,
    `the Long Memory still pays +3 morale without a star (morale ${memory.morale}, rep ${memory.rep})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

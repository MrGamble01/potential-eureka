/* HV-100 — Busk said playing lifts you +2 morale, and the log never named it.
 *
 * The tooltip says playing lifts you (+2 morale). finishAction does
 * G.morale += 2 and floatText already shows +2😊. The log names the
 * take and +1 rep. It never names the lift. Soup night names both
 * halves. A camp meeting names the morale. This set does not.
 *
 * Not HV-19 (the guitar itself — hvbusk C already proves the +2
 * number). Not HV-78 (#741, Rest). Not HV-86 (#751, Kind Stranger).
 * Not HV-96 (#767, the city letter). This is the set.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the tooltip still promises +2 morale; the set log names
 *    +2 morale next to the take. ui.js is not touched.
 * B. A set still pays the take, +1 rep and +2 morale, and the log
 *    names the lift. A second set the same day is still refused.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const finAt = player.indexOf('function finishAction(a){');
const fin = finAt >= 0 ? player.slice(finAt) : '';
const buskAt = fin.indexOf("a.id==='busk'");
const nextAt = fin.indexOf("a.id==='newcomer'");
const busk = buskAt >= 0 && nextAt > buskAt ? fin.slice(buskAt, nextAt) : '';
const logLine = /log\('🎸[\s\S]*?\);/.exec(busk);
const tip = /id:'busk'[\s\S]{0,400}?tooltip:'([^']+)'/.exec(cfg)
         || /buskAction[\s\S]{0,400}?tooltip:'([^']+)'/.exec(cfg);

ok(buskAt >= 0 && /G\.morale\s*=\s*Math\.min\(100,\s*G\.morale\+2\)/.test(busk),
  'a set still lifts morale by 2 — that is the half that went missing');
ok(tip && /\+2 morale/.test(tip[1]),
  'the tooltip still promises playing lifts you (+2 morale)');
ok(logLine && /\+2 morale/.test(logLine[0]),
  'HV-100: the set log names +2 morale next to the take');
ok(!/buskDay/.test(ui) && !/Played a set on the corner/.test(ui),
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
    try { localStorage.removeItem('homeless_village_v1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    tip: (typeof buskAction === 'function' && buskAction().tooltip) || '',
  }));
  ok(!boot.intro,
    'a returning camp can play a set — not behind the crash course');
  ok(/\+2 morale/.test(boot.tip),
    'the live tooltip still promises the lift');

  const played = await page.evaluate(() => {
    G.structures.guitar = true;
    G.buskDay = -9;
    G.morale = 50;
    G.goodwill = 0;
    G.weather = 'clear';
    const rep0 = G.rep || 0;
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    finishAction(typeof buskAction === 'function' ? buskAction() : { id: 'busk' });
    log = prev;
    return {
      gw: G.goodwill,
      morale: G.morale,
      rep: (G.rep || 0) - rep0,
      busks: G.busks,
      day: G.buskDay === G.days,
      log: heard.join(' '),
    };
  });
  ok(played.gw === 3 && played.morale === 52 && played.rep === 1 && played.busks === 1 && played.day,
    `a set still pays the take, +1 rep and +2 morale (${played.gw}/${played.morale}/${played.rep})`);
  ok(/goodwill/.test(played.log) && /rep/.test(played.log),
    'the log still names the take and the rep');
  ok(/\+2 morale/.test(played.log),
    'HV-100: the set log names +2 morale');

  const sameDay = await page.evaluate(() => {
    const busks = G.busks;
    const morale = G.morale;
    doAction(typeof buskAction === 'function' ? buskAction() : { id: 'busk' });
    return { busks: G.busks, morale: G.morale, same: busks };
  });
  ok(sameDay.busks === sameDay.same && sameDay.morale === 52,
    'isolation: a second set the same day is still refused');

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

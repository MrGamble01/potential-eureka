/*
 * HV-260 — a cold morning said the cold gets into everything,
 * then Rest still recovered a warm-bed sleep.
 *
 * Dawn names the cold. Rest is sleep in the open. The recovery
 * never read the sky, so a cold morning still paid a clear-day
 * nap.
 *
 * Illness × rest is not this card (#903). A named snap under a
 * clear sky is not this card. A clear rest still pays the full
 * roll. ui.js is not this ticket.
 *
 *  A. Source: finishAction rest halves while the sky is cold.
 *  B. A pinned cold rest pays half and the log names the cold.
 *  C. A pinned clear rest still pays the full roll.
 *  D. Illness does not steal this card.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const finishAt = player.indexOf('function finishAction(a){');
const finish = finishAt >= 0 ? player.slice(finishAt) : '';
const restAt = finish.indexOf("a.id==='rest'");
const rest = restAt >= 0 ? finish.slice(restAt, restAt + 550) : '';

ok(/The cold gets into everything/.test(loop),
  'dawn still says the cold gets into everything');
ok(/weather==='cold'/.test(rest) && /floor\(h\/2\)/.test(rest),
  'HV-260: rest halves while the sky is cold');
ok(!/sickUntil|sickness/.test(rest),
  'illness × rest is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the cut lives on the rest — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvchill-init')) {
      sessionStorage.setItem('hvchill-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const dry = await t(() => {
    const mr = Math.random;
    Math.random = () => 0;
    G.weather = 'clear';
    G.snapUntil = null;
    G.health = 50;
    G.morale = 50;
    if (!G.regulars) G.regulars = {};
    G.regulars.ray = 2;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    finishAction({ id: 'rest' });
    window.log = prev;
    Math.random = mr;
    return { health: G.health, morale: G.morale, last: captured[captured.length - 1] || '' };
  });
  ok(dry.health === 55 && dry.morale === 53,
    `a clear rest still pays the full pinned roll (health=${dry.health}, morale=${dry.morale})`);
  ok(/^You rest\. Health \+5\./.test(dry.last),
    `the clear log still names the full nap (${dry.last})`);

  const chilled = await t(() => {
    const mr = Math.random;
    Math.random = () => 0;
    G.weather = 'cold';
    G.snapUntil = null;
    G.health = 50;
    G.morale = 50;
    if (!G.regulars) G.regulars = {};
    G.regulars.ray = 2;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    finishAction({ id: 'rest' });
    window.log = prev;
    Math.random = mr;
    return { health: G.health, morale: G.morale, last: captured[captured.length - 1] || '' };
  });
  ok(chilled.health === 52 && chilled.morale === 51,
    `HV-260: a cold rest pays half (health=${chilled.health}, morale=${chilled.morale})`);
  ok(/cold gets into the sleep/.test(chilled.last),
    `the last line names the cold sleep (${chilled.last})`);

  const sick = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'sickness');
    const mr = Math.random;
    Math.random = () => 0;
    G.weather = 'clear';
    G.health = 80;
    G.food = 20;
    ev.effect();
    G.health = 50;
    G.morale = 50;
    if (!G.regulars) G.regulars = {};
    G.regulars.ray = 2;
    finishAction({ id: 'rest' });
    Math.random = mr;
    return { health: G.health, morale: G.morale };
  });
  ok(sick.health === 55 && sick.morale === 53,
    `illness is not this card — a clear rest still pays full (health=${sick.health})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

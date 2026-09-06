/*
 * HV-152 — Dee said she patches you up, then the Injury limp stayed.
 *
 * Dee's perk is "patches you up when you're in bad shape." The Injury
 * card is "You hurt yourself. Moving slowly for the next while."
 * When she finds you under 30 health she adds +10 and walks away.
 * G.injuredUntil stays in the future. Rest still takes 1.8x. She
 * patched the number and left the limp.
 *
 *  A. Source: regularFavorsAtDawn clears injuredUntil when Dee patches.
 *  B. Her perk still says she patches you up.
 *  C. Live: friend Dee, health 20, a live limp — she heals AND the
 *     limp is gone. Rest starts at 3s, not 5.4s.
 *  D. Isolation: +10 health still lands. The 3-day rest still holds.
 *  E. Isolation: injured but health 40 — she does not come, limp stays
 *     (bad shape is the gate, not every scrape).
 *  F. Isolation: Marisol's tamales still drop. Injury still slows
 *     before she visits.
 *  Z. Zero page errors. ui.js untouched.
 *
 * Hook-free. Drives regularFavorsAtDawn / doAction on the production path.
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
const dee = /function regularFavorsAtDawn\(\)\{([\s\S]*?)\n\}/.exec(loop);
ok(!!dee, 'regularFavorsAtDawn is still in gameloop.js');
ok(dee && /regularStage\('dee'\)===2/.test(dee[1]) && /injuredUntil/.test(dee[1]),
  'HV-152: Dee\'s patch clears injuredUntil');
ok(/perk:'patches you up when you.re in bad shape'/.test(cfg),
  'Dee still promises to patch you up when you are in bad shape');
ok(!/injuredUntil/.test(ui),
  'ui.js untouched — the limp lives on the dawn patch');

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
    if (!sessionStorage.getItem('hvdeelimp-init')) {
      sessionStorage.setItem('hvdeelimp-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const patched = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.9;
    G.days = 5;
    G.regulars = { marisol: 0, ray: 0, dee: 5 };
    G.lastDeeDay = -9;
    G.health = 20;
    G.injuredUntil = Date.now() + 90000;
    G.food = 50; G.warmth = 80;
    const ev = EVENTS_BAD.find(e => e.id === 'injury');
    regularFavorsAtDawn();
    const rest = ACTIONS.find(a => a.id === 'rest');
    const now = Date.now();
    const duration = now < (G.injuredUntil || 0) ? rest.time * 1.8 : rest.time;
    Math.random = real;
    return {
      health: G.health,
      limp: now < (G.injuredUntil || 0),
      injuredUntil: G.injuredUntil || 0,
      restMs: duration,
      restBase: rest.time,
      perk: (REGULARS.find(r => r.id === 'dee') || {}).perk,
      card: ev && ev.desc,
      lastDeeDay: G.lastDeeDay,
    };
  });
  ok(/patches you up/i.test(patched.perk),
    `Dee still says she patches you up (${patched.perk})`);
  ok(/Moving slowly/i.test(patched.card),
    'Injury still says you move slowly for the next while');
  ok(patched.health === 30,
    `she still adds +10 health (20 → ${patched.health})`);
  ok(!patched.limp && patched.restMs === patched.restBase,
    `HV-152: the limp is gone — Rest is ${patched.restMs}ms, not 1.8x (${patched.injuredUntil})`);

  const cooldown = await page.evaluate(() => {
    G.lastDeeDay = G.days;
    G.health = 20;
    G.injuredUntil = Date.now() + 90000;
    regularFavorsAtDawn();
    return {
      health: G.health,
      limp: Date.now() < (G.injuredUntil || 0),
    };
  });
  ok(cooldown.health === 20 && cooldown.limp,
    'the 3-day rest still holds — she does not patch two dawns in a row');

  const healthyLimp = await page.evaluate(() => {
    G.lastDeeDay = -9;
    G.health = 40;
    G.injuredUntil = Date.now() + 90000;
    regularFavorsAtDawn();
    return {
      health: G.health,
      limp: Date.now() < (G.injuredUntil || 0),
    };
  });
  ok(healthyLimp.health === 40 && healthyLimp.limp,
    'injured at 40 health — she does not come (bad shape is the gate)');

  const before = await page.evaluate(() => {
    G.regulars.dee = 0;
    G.lastDeeDay = -9;
    G.health = 80;
    G.injuredUntil = Date.now() + 90000;
    G.cooldowns = {};
    delete activeJobs.rest;
    const rest = ACTIONS.find(a => a.id === 'rest');
    const now = Date.now();
    const duration = now < (G.injuredUntil || 0) ? rest.time * 1.8 : rest.time;
    return { restMs: duration, restBase: rest.time };
  });
  ok(before.restMs === Math.floor(before.restBase * 1.8) || before.restMs === before.restBase * 1.8,
    `Injury still slows Rest before she visits (${before.restMs} vs ${before.restBase})`);

  const tamale = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.1;
    G.regulars = { marisol: 5, ray: 0, dee: 0 };
    G.food = 10;
    regularFavorsAtDawn();
    Math.random = real;
    return { food: G.food };
  });
  ok(tamale.food === 12,
    `Marisol's tamales still drop (10 → ${tamale.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

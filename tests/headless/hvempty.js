/*
 * HV-113 — Scavenge said Nothing today, then counted a haul of zero.
 *
 * Two lies on the same dumpster:
 *  1. A miss logs "The dumpster is empty. Nothing today." The action
 *     cooldown is 8 seconds. hvregulars pins that the next try can
 *     still pay — so "today" is the lie, not the retry.
 *  2. Winter halves the yield. floor(rand * 0.5) can be 0/0/0. That
 *     path still said "Scavenged: 0 cans, 0 scraps." and ticked
 *     totalScavenged. A dumpster that gave nothing was counted as dug.
 *
 *  A. Source: the empty log no longer promises the rest of the day.
 *  B. Source: a zero-yield success is treated as empty.
 *  C. Spring 0.15: stranger empty, Ray's friend still finds scraps
 *     the same day (hvregulars E must stay true).
 *  D. Winter 0.15: a "success" of 0/0/0 is empty — no haul log, no
 *     totalScavenged tick.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(scavenge) on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const scav = /if\(a\.id==='scavenge'\)\{([\s\S]*?)\} else if\(a\.id==='forage'\)/.exec(player);
ok(!!scav, 'scavenge still lives in finishAction');
ok(scav && /Nothing this time/.test(scav[1]) && !/Nothing today/.test(scav[1]),
  'HV-113: an empty dumpster no longer promises the rest of the day');
ok(scav && /c\+s\+f|c \+ s \+ f/.test(scav[1]),
  'HV-113: a zero-yield success is treated as empty');

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
    if (!sessionStorage.getItem('hvempty-init')) {
      sessionStorage.setItem('hvempty-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const ray = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.15;
    G.weather = 'clear'; G.season = 0; G.cooldowns = {};
    G.regulars.ray = 0; G.cans = 0; G.scraps = 0; G.food = 0;
    G.totalScavenged = 0;
    if (typeof logFeed !== 'undefined' && logFeed) logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    finishAction(ACTIONS.find(a => a.id === 'scavenge'));
    const stranger = {
      scraps: G.scraps,
      dug: G.totalScavenged,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
    G.regulars.ray = 5; G.cooldowns = {}; G.scraps = 0; G.cans = 0;
    if (typeof logFeed !== 'undefined' && logFeed) logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    finishAction(ACTIONS.find(a => a.id === 'scavenge'));
    Math.random = real;
    return {
      stranger,
      friendScraps: G.scraps,
      friendDug: G.totalScavenged,
    };
  });
  ok(ray.stranger.scraps === 0 && /empty/i.test(ray.stranger.log),
    `spring 0.15: a stranger still digs an empty bin (${ray.stranger.log.slice(-80)})`);
  ok(!/today/i.test(ray.stranger.log),
    `the empty log no longer says today (${ray.stranger.log.slice(-80)})`);
  ok(ray.friendScraps > 0,
    `Ray's friend still finds scraps the same day (+${ray.friendScraps}) — hvregulars E`);

  const winter = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.15;
    G.weather = 'clear'; G.season = 3; G.cooldowns = {};
    G.regulars.ray = 0; G.cans = 0; G.scraps = 0; G.food = 0;
    G.totalScavenged = 0;
    if (typeof logFeed !== 'undefined' && logFeed) logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    finishAction(ACTIONS.find(a => a.id === 'scavenge'));
    Math.random = real;
    return {
      scraps: G.scraps,
      cans: G.cans,
      food: G.food,
      dug: G.totalScavenged,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(winter.scraps === 0 && winter.cans === 0 && winter.food === 0,
    `winter 0.15 floors the haul to nothing (${winter.cans}/${winter.scraps}/${winter.food})`);
  ok(winter.dug === 0 && /empty/i.test(winter.log) && !/Scavenged: 0/.test(winter.log),
    `HV-113: a haul of zero is empty, not a dumpster dug (dug=${winter.dug}, ${winter.log.slice(-90)})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

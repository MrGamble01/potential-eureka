/*
 * HV-115 — Dee said she patches you when you're in bad shape.
 *
 * Her perk: "patches you up when you’re in bad shape."
 * The dawn latch was G.health<30. Thirty percent is bad shape —
 * the HUD reads 30 — and she walked past. hvregulars already pins
 * 20 → 30; it never stood on the line.
 *
 *  A. Source: regularFavorsAtDawn treats health<=30 as bad shape.
 *  B. The perk copy still says bad shape.
 *  C. Health 30, Dee a friend, a quiet dawn: she patches +10.
 *  D. Health 31 is not the line — she does not patch.
 *  E. No Dee, health 30: nobody patches (isolation).
 *  F. Health 20 still patches to 30 (hvregulars F).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives regularFavorsAtDawn via onNewDay.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const dawn = /function regularFavorsAtDawn\(\)\{([\s\S]*?)\n\}/.exec(loop);
ok(!!dawn, 'regularFavorsAtDawn is still in gameloop.js');
ok(dawn && /G\.health\s*<=\s*30/.test(dawn[1]),
  'HV-115: Dee patches when health is 30 or below');
ok(/patches you up when you.re in bad shape/.test(cfg),
  'Dee still promises to patch you when you are in bad shape');

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
    if (!sessionStorage.getItem('hvshape-init')) {
      sessionStorage.setItem('hvshape-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawnAt = (arg) => page.evaluate((a) => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.days = 1;
    G.season = 0;
    G.timeOfDay = 0;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.health = a.health;
    G.food = 40;
    G.warmth = 80;
    G.morale = 50;
    G.population = 1;
    G.dog = 0;
    G.mural = 0;
    G.friendDay = -1;
    G.snapUntil = null;
    G.ticketsSent = 0;
    G.rainBetOn = false;
    G.rayDebt = 0;
    G.rep = 0;
    G.arcDone = true;
    G.lastEventDay = 99;
    G.goalIndex = GOALS.length;
    G.favor = null;
    G.petitions = {};
    G.structures.soup_kitchen = false;
    G.structures.pantry = false;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.workers = { scrapper: false, cook: false, lookout: false, builder: false };
    G.regulars = { marisol: 0, ray: 0, dee: a.dee ? 5 : 0 };
    G.lastDeeDay = -9;
    if (typeof logFeed !== 'undefined' && logFeed) logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    onNewDay();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line'))
      .map(d => d.textContent).join(' ');
    return { health: G.health, lastDee: G.lastDeeDay, log };
  }, arg);

  const on30 = await dawnAt({ health: 30, dee: true });
  ok(on30.health === 40,
    `HV-115: health 30 is bad shape — Dee patches +10 (30 → ${on30.health})`);
  ok(/patched you up/i.test(on30.log),
    `the log names the patch (${on30.log.slice(-80)})`);

  const on31 = await dawnAt({ health: 31, dee: true });
  ok(on31.health === 31 && !/patched you up/i.test(on31.log),
    `health 31 is not the line (${on31.health})`);

  const noDee = await dawnAt({ health: 30, dee: false });
  ok(noDee.health === 30 && !/patched you up/i.test(noDee.log),
    'without Dee, 30 health is not patched');

  const low = await dawnAt({ health: 20, dee: true });
  ok(low.health === 30,
    `health 20 still patches to 30 (hvregulars F) (${low.health})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

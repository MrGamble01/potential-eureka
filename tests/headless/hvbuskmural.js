/*
 * HV-158 — the finished mural said passers-by slow down,
 * then a set on the corner never felt them linger.
 *
 * The Underpass Mural greets every morning and "passers-by
 * slow down for it." Panhandle already uses that linger
 * (×1.1 on the success window). Busk is the other corner
 * verb — same foot traffic, a hat that rides spirits and
 * doubles on a scorcher — and the take never read G.mural.
 *
 * #823 is Cold Snap thinning the hat. #775 is the +2 morale
 * log. #793 is the tip hiding the base coin. This is the
 * wall's own promise on the set, not the weather.
 *
 *  A. Source: the mural still slows passers-by; the busk
 *     finish reads a finished wall.
 *  B. A live set under a finished mural pays the linger
 *     (+1 on the take) and names it.
 *  C. A bare wall still pays the spirits table (morale 50
 *     clear = 3). Three panels is not finished.
 *  D. A scorcher still doubles, then the linger stacks
 *     (morale 50 heat = 6 + 1).
 *  E. +1 rep and +2 morale still land. One set a day.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production finishAction(busk).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const busk = /\} else if\(a\.id==='busk'\)\{([\s\S]*?)\n  \} else if\(a\.id==='newcomer'\)/.exec(player);
ok(/passers-by slow down/.test(cfg) && /id:'busk'/.test(cfg),
  'the mural still slows passers-by; the guitar still plays a set on the corner');
ok(busk && /G\.mural/.test(busk[1]) && /MURAL_PANELS/.test(busk[1]),
  'HV-158: the busk finish reads a finished mural');

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
    if (!sessionStorage.getItem('hvbuskmural-init')) {
      sessionStorage.setItem('hvbuskmural-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const lingered = await page.evaluate(() => {
    G.structures.guitar = true;
    G.mural = MURAL_PANELS;
    G.morale = 50;
    G.weather = 'clear';
    G.goodwill = 0;
    G.buskDay = -9;
    G.busks = 0;
    G.goalIndex = GOALS.length;
    const rep0 = G.rep || 0;
    finishAction(buskAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      gw: G.goodwill,
      morale: G.morale,
      rep: (G.rep || 0) - rep0,
      busks: G.busks,
      day: G.buskDay === G.days,
      named: /linger|mural|slowed/i.test(log),
    };
  });
  ok(lingered.gw === 4 && lingered.named,
    'HV-158: a finished mural adds +1 to the take and the log names the linger');
  ok(lingered.rep === 1 && lingered.morale === 52 && lingered.busks === 1 && lingered.day,
    '+1 rep and +2 morale still land; one set stamps the day');

  const bare = await page.evaluate(() => {
    const run = (mural) => {
      G.mural = mural;
      G.morale = 50;
      G.weather = 'clear';
      G.goodwill = 0;
      G.buskDay = -9;
      finishAction(buskAction());
      return G.goodwill;
    };
    return { none: run(0), three: run(3) };
  });
  ok(bare.none === 3 && bare.three === 3,
    'a bare wall and three panels still pay the spirits table (3)');

  const scorcher = await page.evaluate(() => {
    G.mural = MURAL_PANELS;
    G.morale = 50;
    G.weather = 'heat';
    G.goodwill = 0;
    G.buskDay = -9;
    finishAction(buskAction());
    return G.goodwill;
  });
  ok(scorcher === 7,
    'a scorcher still doubles, then the linger stacks (6 + 1)');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

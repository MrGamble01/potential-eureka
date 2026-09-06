/**
 * HV-98 — Dee said she always stops and a missed panhandle never saw her.
 *
 * Roster copy: Dee's how is "Panhandle her route — she always stops".
 * finishAction only calls bumpRegular('dee') on a successful panhandle
 * (the 55% weather-weighted roll). A miss logs "Ignored again. Morale
 * fades a little." and never records her. The first time you meet Dee
 * is supposed to be that she stops on your route — a miss still meets
 * her. A win is still exactly one bump, not two.
 *
 *  A. Dee's how still says she always stops.
 *  B. The miss arm calls bumpRegular('dee') and does not addRep.
 *  C. ui.js stays out of regulars bookkeeping.
 *  D. A forced miss (Math.random = 0.99) leaves dee at 1, learns her
 *     name, costs 3 morale, and pays no goodwill / reputation.
 *  E. A forced win still bumps Dee once, pays goodwill, and addRep(1).
 *  Z. Zero page errors.
 *
 * Write-first: on unfixed main, B and D fail by name. E already passes.
 * Hook-free. Drives finishAction(ACTIONS.find(a => a.id === 'panhandle')).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const NAMED =
  'HV-98: Dee said she always stops and a missed panhandle never saw her';

const playerSrc = fs.readFileSync(
  path.join(ROOT, 'homeless-village/js/player.js'),
  'utf8'
);
const configSrc = fs.readFileSync(
  path.join(ROOT, 'homeless-village/js/config.js'),
  'utf8'
);
const uiSrc = fs.readFileSync(
  path.join(ROOT, 'homeless-village/js/ui.js'),
  'utf8'
);

const deeHow = configSrc.match(/id:'dee'[\s\S]*?how:'([^']+)'/);
ok(!!deeHow, 'Dee how copy is still in REGULARS');
ok(deeHow && /always stops/i.test(deeHow[1]),
  `Dee how still says she always stops`);

const panhandleFn = playerSrc.match(
  /a\.id===['"]panhandle['"][\s\S]*?(?=\n  \} else if\(a\.id===['"]rest['"])/
);
ok(!!panhandleFn, 'panhandle finishAction branch is still in player.js');
const failArm = panhandleFn && panhandleFn[0].match(
  /else \{[\s\S]*?Ignored again[\s\S]*?\}/
);
ok(!!failArm, 'panhandle miss arm (Ignored again) is still in player.js');
ok(failArm && /bumpRegular\(\s*['"]dee['"]\s*\)/.test(failArm[0]),
  NAMED + ' — miss arm never calls bumpRegular(\'dee\')');
ok(failArm && !/addRep\(/.test(failArm[0]),
  'a miss still does not add reputation');
ok(!/\bbumpRegular\b/.test(uiSrc),
  'ui.js must stay out of regulars bookkeeping');

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
    if (!sessionStorage.getItem('hvdee-init')) {
      sessionStorage.setItem('hvdee-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const miss = await page.evaluate(() => {
    const pan = ACTIONS.find((a) => a.id === 'panhandle');
    if (!pan) return { error: 'no panhandle action' };
    G.goodwill = 4;
    G.rep = 0;
    G.morale = 50;
    G.regulars.dee = 0;
    G.regulars.ray = 2;
    G.busy = false;
    G.act = null;
    const orig = Math.random;
    Math.random = () => 0.99;
    finishAction(pan);
    Math.random = orig;
    return {
      dee: G.regulars.dee,
      ray: G.regulars.ray,
      goodwill: G.goodwill,
      rep: G.rep,
      morale: G.morale,
      log: Array.from(document.querySelectorAll('.log-line')).map((d) => d.textContent)
    };
  });
  ok(!miss.error, miss.error || 'panhandle action is on the live page');
  ok(miss.dee === 1,
    `${NAMED} — miss left dee at ${miss.dee} (expected 1)`);
  ok(miss.ray === 2, `a miss should not touch Ray (ray=${miss.ray})`);
  ok(miss.goodwill === 4, `a miss should not pay goodwill (goodwill=${miss.goodwill})`);
  ok(miss.rep === 0, `a miss should not add reputation (rep=${miss.rep})`);
  ok(miss.morale === 47, `a miss should still cost 3 morale (morale=${miss.morale})`);
  ok((miss.log || []).some((line) => /Ignored again/i.test(line)),
    'miss still logs the ignore line');
  ok((miss.log || []).some((line) => /Dee/.test(line) && /name/i.test(line)),
    'miss still learns Dee\'s name');

  const win = await page.evaluate(() => {
    const pan = ACTIONS.find((a) => a.id === 'panhandle');
    G.goodwill = 4;
    G.rep = 0;
    G.morale = 50;
    G.regulars.dee = 0;
    G.busy = false;
    G.act = null;
    const orig = Math.random;
    Math.random = () => 0;
    finishAction(pan);
    Math.random = orig;
    return {
      dee: G.regulars.dee,
      goodwill: G.goodwill,
      rep: G.rep,
      log: Array.from(document.querySelectorAll('.log-line')).map((d) => d.textContent)
    };
  });
  ok(win.dee === 1,
    `a successful panhandle should bump Dee once, not ${win.dee}`);
  ok(win.goodwill > 4, `a successful panhandle should still pay goodwill (goodwill=${win.goodwill})`);
  ok(win.rep === 1, `success should still addRep(1) (rep=${win.rep})`);
  ok((win.log || []).some((line) => /goodwill/i.test(line)),
    'success still logs the goodwill line');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.error('not ok  ' + err.message);
  process.exit(1);
});

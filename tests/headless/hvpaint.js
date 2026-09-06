/*
 * HV-145 — a friend came by to paint a while, then affinity never moved.
 *
 * The mural session log names the visit: "{Name} came by to paint a
 * while." Trade, rest and a successful panhandle each call
 * bumpRegular(). Painting together is the same class of time spent.
 * finishAction only wrote the line. Marisol sat at 5 and left at 5.
 *
 *  A. Source: the mural branch still logs the visit.
 *  B. HV-145: that branch calls bumpRegular for the friend who came.
 *  C. ui.js is untouched.
 *  D. A friend at 5 who comes by to paint moves to 6. The visit is
 *     still logged. +3 morale and +2 rep still pay.
 *  E. A session with no friends still pays +3 morale +2 rep, and
 *     nobody's affinity moves.
 *  F. Trade still bumps Marisol +1.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(muralAction()) on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const mural = /a\.id==='mural'[\s\S]*?else if\(a\.id==='meeting'/.exec(player);
ok(!!mural, 'the mural branch is still in player.js');
ok(mural && /came by to paint a while/.test(mural[0]),
  'the mural branch still logs the visit');
ok(mural && /bumpRegular\s*\(/.test(mural[0]),
  'HV-145: the mural visit calls bumpRegular');
ok(!/came by to paint a while/.test(ui) && !/bumpRegular/.test(ui),
  'ui.js is untouched');

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
    if (!sessionStorage.getItem('hvpaint-init')) {
      sessionStorage.setItem('hvpaint-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const painted = await t(() => {
    G.rep = 30; G.days = 2; G.dog = 1; G.dogMetDay = 99;
    G.goalIndex = GOALS.length;
    G.regulars = { marisol: 5, ray: 0, dee: 0 };
    G.mural = 0; G.muralDay = -1;
    G.scraps = 10; G.morale = 50;
    const rep0 = G.rep;
    finishAction(muralAction());
    return {
      affinity: G.regulars.marisol,
      ray: G.regulars.ray,
      mural: G.mural,
      morale: G.morale,
      rep: G.rep - rep0,
      scraps: G.scraps,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(painted.mural === 1 && painted.morale === 53 && painted.rep === 2 && painted.scraps === 8,
    `a session still costs 2 scraps and pays +3 morale +2 rep (${painted.morale}, +${painted.rep} rep)`);
  ok(/Marisol came by to paint a while/.test(painted.log),
    `the visit is still logged (${painted.log.slice(-120)})`);
  ok(painted.affinity === 6 && painted.ray === 0,
    `HV-145: Marisol moves 5 → 6 for the visit (${painted.affinity})`);

  const alone = await t(() => {
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.days = 3; G.muralDay = -1;
    G.scraps = 10; G.morale = 40;
    const rep0 = G.rep;
    finishAction(muralAction());
    return {
      affinity: G.regulars.marisol,
      mural: G.mural,
      morale: G.morale,
      rep: G.rep - rep0,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(alone.mural === 2 && alone.morale === 43 && alone.rep === 2 && alone.affinity === 0,
    `no friends: the session still pays, affinity stays 0 (${alone.affinity})`);
  ok(!/came by to paint a while/.test(alone.log),
    'no friends: the visit line stays quiet');

  const trade = await t(() => {
    G.cans = 30; G.cooldowns = {};
    G.regulars.marisol = 2;
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    return { a: G.regulars.marisol };
  });
  ok(trade.a === 3, `trade still bumps Marisol +1 (2 → ${trade.a})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

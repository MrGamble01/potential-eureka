/*
 * HV-109 — Busk said +1 goodwill per 25 morale, then a quiet camp
 * still took a coin.
 *
 * The 🎸 tooltip prices the take: "+1 goodwill per 25 morale,
 * doubled on a scorcher." buskPay() is 1 + floor(morale/25). A
 * camp at 0 morale still takes 1. A camp at 50 takes 3, not 2.
 * hvbusk already locks that table. The tip never named the base.
 *
 *  A. Source: the tip is built from the same 1 + floor the pay uses.
 *  B. The pay table is still 1 / 3 / 5, doubled to 6 on a scorcher.
 *  C. The live 🎸 tip names the base coin — not a bare "+1 per 25".
 *  D. A quiet set (morale 0) pays 1 and the tip promised that 1.
 *  E. Isolation: +2 morale, +1 rep, one set a day, heat still doubles.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives buskPay + buskAction + finishAction.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');

ok(/function buskPay\(/.test(cfg), 'buskPay is still in config.js — guards the take');
ok(/1\s*\+\s*Math\.floor\(\s*\(G\.morale\|\|0\)\s*\/\s*25\s*\)/.test(cfg),
  'HV-109: buskPay is still 1 + floor(morale/25) — the table hvbusk locked');

const tip = /function buskAction\([\s\S]*?tooltip:'([^']+)'/.exec(cfg);
ok(!!tip, 'buskAction still writes the 🎸 tip');
ok(tip && /1 goodwill plus 1 per 25 morale/.test(tip[1]),
  'HV-109: the tip names the base coin, not a bare +1 per 25');
ok(tip && !/\(\+1 goodwill per 25 morale/.test(tip[1]),
  'the old "+1 goodwill per 25 morale" clause is gone');

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

  const table = await page.evaluate(() => {
    const at = (m, w) => { G.morale = m; G.weather = w; return buskPay(); };
    return [at(0, 'clear'), at(50, 'clear'), at(100, 'clear'), at(50, 'heat')].join(',');
  });
  ok(table === '1,3,5,6',
    `the take is still 1/3/5, doubled to 6 on a scorcher (${table})`);

  const live = await page.evaluate(() => {
    G.structures.guitar = true;
    G.buskDay = -9;
    buildActionUI();
    const btn = document.getElementById('action-busk');
    return btn ? btn.getAttribute('data-tip') : '';
  });
  ok(/1 goodwill plus 1 per 25 morale/.test(live),
    `the 🎸 tip names the base coin (${(live || '').slice(40, 95)})`);
  ok(!/\(\+1 goodwill per 25 morale/.test(live),
    'the live tip no longer prices a bare +1 per 25');

  const quiet = await page.evaluate(() => {
    G.structures.guitar = true;
    G.morale = 0; G.weather = 'clear';
    G.goodwill = 0; G.buskDay = -9; G.busks = 0;
    const rep0 = G.rep || 0;
    finishAction(buskAction());
    return {
      gw: G.goodwill,
      morale: G.morale,
      rep: (G.rep || 0) - rep0,
      busks: G.busks,
      day: G.buskDay === G.days,
    };
  });
  ok(quiet.gw === 1,
    `a quiet set pays the base coin (0 morale → ${quiet.gw})`);
  ok(quiet.morale === 2 && quiet.rep === 1 && quiet.busks === 1 && quiet.day,
    'playing still lifts +2 morale, +1 rep, one set a day');

  const heat = await page.evaluate(() => {
    G.days += 1;
    G.morale = 50; G.weather = 'heat';
    G.goodwill = 0;
    finishAction(buskAction());
    return G.goodwill;
  });
  ok(heat === 6, `a scorcher still doubles the 50-morale take (${heat})`);

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

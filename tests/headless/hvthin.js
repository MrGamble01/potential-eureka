/*
 * HV-140 — the Cold Snap said foot traffic thins, then Busk still
 * paid the full take.
 *
 * HV-18 thins the street: panhandle success is cut to 0.75 inside a
 * gripping snap. HV-19's other corner verb is documented as riding
 * the same foot traffic (the scorcher double). buskPay() doubled on
 * heat and never asked snapActive(). A Respected set on a clear snap
 * dawn still paid the quiet-day take.
 *
 * Not the snap-start family (#729 / #757 / #787) and not the in-snap
 * neighbor hand-warmers (#812). Not #775 (the +2 morale log) or #793
 * (the tip's base coin). This is the hat on the corner ignoring the
 * snap's traffic cut.
 *
 *  A. Source: buskPay reads snapActive.
 *  B. A 50-morale clear set pays 3 quiet and 2 inside a snap.
 *  C. A scorcher still doubles (6). A scorcher-in-snap is 4.
 *  D. Morale 0 inside a snap still pays the base coin (1).
 *  E. Panhandle's snap cut and the +2 morale / +1 rep still hold.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives buskPay() and finishAction(buskAction()).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const pay = /function buskPay\(\)\{([\s\S]*?)\n\}/.exec(src);
ok(!!pay, 'buskPay is still in config.js');
ok(pay && /snapActive\s*\(/.test(pay[1]),
  'HV-140: buskPay reads snapActive — the snap thins the hat');
ok(/traffic thins/.test(src) && /doubles on a scorcher/.test(src),
  'HV-18 still promises thin traffic; HV-19 still doubles on a scorcher');

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
    if (!sessionStorage.getItem('hvthin-init')) {
      sessionStorage.setItem('hvthin-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const table = await t(() => {
    G.structures.guitar = true;
    const at = (m, w, snap) => {
      G.morale = m;
      G.weather = w;
      G.snapUntil = snap ? G.days + 5 : null;
      return buskPay();
    };
    return {
      quiet: at(50, 'clear', false),
      snap: at(50, 'clear', true),
      heat: at(50, 'heat', false),
      heatSnap: at(50, 'heat', true),
      baseSnap: at(0, 'clear', true),
      high: at(100, 'clear', false),
    };
  });
  ok(table.quiet === 3 && table.high === 5,
    `a quiet set still rides the spirits (50→${table.quiet}, 100→${table.high})`);
  ok(table.snap === 2,
    `HV-140: a 50-morale clear set inside a snap pays 2, not 3 (${table.snap})`);
  ok(table.heat === 6,
    `a scorcher still doubles (50→${table.heat})`);
  ok(table.heatSnap === 4,
    `a scorcher inside a snap is 4, not 6 (${table.heatSnap})`);
  ok(table.baseSnap === 1,
    `morale 0 inside a snap still pays the base coin (${table.baseSnap})`);

  const set = await t(() => {
    G.structures.guitar = true;
    G.snapUntil = G.days + 5;
    G.weather = 'clear';
    G.morale = 50;
    G.goodwill = 0;
    G.buskDay = -9;
    const rep0 = G.rep || 0;
    finishAction(buskAction());
    return {
      gw: G.goodwill,
      morale: G.morale,
      rep: (G.rep || 0) - rep0,
      day: G.buskDay === G.days,
    };
  });
  ok(set.gw === 2 && set.morale === 52 && set.rep === 1 && set.day,
    `the set pays the thinned take, still +2 morale and +1 rep (${set.gw}🩶, morale ${set.morale})`);

  const thin = await t(() => {
    const real = Math.random;
    G.rep = 0; G.dog = 0; G.mural = 0; G.weather = 'clear';
    G.structures.awning = false;
    G.snapUntil = G.days + 5;
    G.goodwill = 0;
    Math.random = () => 0.5;
    finishAction({ id: 'panhandle', cooldown: 0, time: 0 });
    const inSnap = G.goodwill;
    G.snapUntil = null;
    finishAction({ id: 'panhandle', cooldown: 0, time: 0 });
    Math.random = real;
    return { inSnap, after: G.goodwill };
  });
  ok(thin.inSnap === 0 && thin.after > 0,
    'panhandle still thins inside a snap — hvsnap E holds');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

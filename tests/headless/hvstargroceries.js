/* HV-199 — the Chalk Star said neighbors leave groceries at the
 * fence, then a cold snap still brought them outside.
 *
 * A beaten hold under the star pays +3 food: "word gets around,
 * and neighbors leave groceries at the fence." Panhandle already
 * knows "nobody lingers outside in a cold snap." The snap dawn
 * says two brutal days. The groceries still landed on the fence.
 *
 * #810 is star vs Word on the Street. #812 is hand-warmers only
 * leaving change. #823 is snap vs Busk. #883 is snap vs the
 * garden. This is the fence.
 *
 *  A. Source: the star still leaves groceries at the fence. Snap
 *     still thins the street.
 *  B. Source: the star payout reads snapActive(). ui.js does not.
 *  C. Live: three holds standing, a live snap, the next beaten
 *     hold — the cheer ticks, the fire feels it, the pot does not.
 *     The log names the empty fence.
 *  D. The same hold without a snap still pays +3 groceries.
 *  E. A starless wall in a snap still rings dry.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production recordDays().
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const rec = /function recordDays\(d\)\{([\s\S]*?)\n\}/.exec(cfg);
const body = rec ? rec[1] : '';

ok(/neighbors leave groceries at the fence/.test(cfg)
  && /nobody lingers outside in a cold snap/.test(player)
  && /A cold snap grips the block/.test(fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8')),
  'the star still leaves groceries at the fence; a snap still thins the street');
ok(body && /snapActive\s*\(\s*\)/.test(body),
  'HV-199: the star grocery payout reads a named snap');
ok(!/groceries at the fence/.test(ui) && !/snapActive/.test(ui),
  'ui.js untouched — the empty fence lives on the record beat');

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
    if (!sessionStorage.getItem('hvstargroceries-init')) {
      sessionStorage.setItem('hvstargroceries-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-plaque');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const beat = (opts) => page.evaluate((opts) => {
    saveHvRec({ days: 5, beats: opts.beats });
    saveHvStar({ cheers: 0 });
    hvRecMark = null;
    hvRecRung = false;
    G.days = 5;
    G.food = 10;
    G.morale = 50;
    G.snapUntil = opts.snap ? 99 : null;
    log('HV198-MARK');
    recordDays(6);
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV198-MARK/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      food: G.food,
      morale: G.morale,
      beats: loadHvRec().beats,
      cheers: loadHvStar().cheers,
      groceries: /neighbors leave groceries at the fence/.test(newest),
      empty: /snap/i.test(newest) && /fence/.test(newest) && /empty|inside/i.test(newest),
      fire: /The fire feels it/.test(newest),
    };
  }, opts);

  const snap = await beat({ beats: 3, snap: true });
  ok(snap.beats === 4 && snap.cheers === 1 && snap.fire
    && snap.food === 10 && snap.empty && !snap.groceries,
    `HV-199: a snap hold cheers, the fence stays empty (food ${snap.food}, cheers ${snap.cheers})`);

  const clear = await beat({ beats: 3, snap: false });
  ok(clear.beats === 4 && clear.cheers === 1 && clear.fire
    && clear.food === 13 && clear.groceries && !clear.empty,
    `a quiet hold still pays +3 groceries (food ${clear.food})`);

  const dry = await beat({ beats: 1, snap: true });
  ok(dry.beats === 2 && dry.cheers === 0 && dry.food === 10
    && !dry.groceries && !dry.empty,
    'a starless wall in a snap still rings dry');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

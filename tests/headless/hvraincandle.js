/* HV-195 — Mark the Anniversary said light a candle and keep it
 * lit, then a rainy day still filled the pot.
 *
 * The tooltip is "Light a candle for it once a session, and the
 * bridge remembers who kept it lit." The log puts folks by the
 * flame with something for the pot. Rain still paid the dish like
 * a clear day. A candle in the rain does not stay lit — they
 * still struck it; nobody came by a drowned flame.
 *
 * #814 is the look-count. #864 / #789 are Dry Corner rain.
 * #881 is fence-post tamales. #884 is a bag by the bridge.
 * This is the candle.
 *
 *  A. Source: the row still lights a candle. The log still names
 *     the flame. The tooltip still says kept it lit.
 *  B. Source: the anniversary payout reads weather==='rain'.
 *     ui.js does not.
 *  C. Live: the year is counted, rain — the pot does not move.
 *     The log names the drown. The tally does not tick.
 *  D. The same marking on a clear day still pays the dish.
 *  E. A scorcher still pays. An uncounted year still refuses.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction({id:'anniv'}).
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const anniv = /\} else if\(a\.id==='anniv'\)\{([\s\S]*?)\n  \} else if\(a\.id==='guestbook'\)/.exec(player);
const body = anniv ? anniv[1] : '';

ok(/Light a candle for it once a session/.test(cfg)
  && /kept it lit/.test(cfg)
  && /a candle lit to prove it/.test(player)
  && /Folks come by the flame/.test(player),
  'the anniversary still lights a candle; folks still come by the flame');
ok(body && /weather\s*===\s*'rain'/.test(body),
  'HV-195: the anniversary payout reads a rainy sky');
ok(!/drowned the anniversary candle/.test(ui) && !/annivMarked/.test(ui),
  'ui.js untouched — the drown lives on the marking');

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
    if (!sessionStorage.getItem('hvraincandle-init')) {
      sessionStorage.setItem('hvraincandle-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-anniversary');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const mark = (weather, looks) => page.evaluate(({ weather, looks }) => {
    saveHvSnap({ looks: looks });
    saveHvAnniv({ toasts: 0 });
    annivMarked = false;
    G.weather = weather;
    G.food = 10;
    log('HV195-MARK');
    finishAction({ id: 'anniv' });
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV195-MARK/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      food: G.food,
      toasts: loadHvAnniv().toasts,
      marked: !!annivMarked,
      drowned: /drowned/i.test(newest) && /candle|flame/i.test(newest),
      lit: /a candle lit to prove it/.test(newest) && /something for the pot/.test(newest),
      refused: /Nobody has counted the winters/.test(newest),
    };
  }, { weather, looks });

  const rain = await mark('rain', 3);
  ok(rain.food === 10 && rain.toasts === 0 && rain.drowned && !rain.lit,
    `HV-195: a rainy marking drowns the candle (food ${rain.food}, toasts ${rain.toasts})`);

  const clear = await mark('clear', 3);
  ok(clear.food === 16 && clear.toasts === 1 && clear.lit && !clear.drowned,
    `a clear marking still pays the dish (food ${clear.food}, toasts ${clear.toasts})`);

  const heat = await mark('heat', 3);
  ok(heat.food === 16 && heat.toasts === 1 && heat.lit && !heat.drowned,
    `a scorcher still pays the dish (food ${heat.food})`);

  const early = await mark('rain', 2);
  ok(early.food === 10 && early.toasts === 0 && early.refused && !early.drowned && !early.lit,
    'an uncounted year still refuses, rain or not');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

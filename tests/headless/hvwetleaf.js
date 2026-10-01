/* HV-202 — Leaf the Notebook said one of the names always left
 * something behind, then rain on an unroofed corner still paid
 * a dry-page dish.
 *
 * The Dry Corner exists to carry the notebook in out of the
 * weather: "the notebook, the can, the snapshot, the panels, the
 * names — goes under it. It just stops the rain from taking the
 * story." Leaf the Notebook still paid the dish on a rainy day
 * while the corner was open to the sky. Wet pages do not keep a
 * name's leftover — they still opened it; the ink ran.
 *
 * #789 is rain editing names on the wall at dawn. #864 is the
 * Dry Corner sit on a clear day. #885 is the anniversary candle.
 * This is the spiral notebook.
 *
 *  A. Source: the notebook row still leaves something behind.
 *     The Dry Corner still names the notebook and the rain.
 *  B. Source: the guestbook payout reads weather==='rain' and
 *     dryBuilt(). ui.js does not.
 *  C. Live: the notebook is out, rain, no roof — the pot does
 *     not move. The log names the soak. The leaf tally does not
 *     tick. The session latch still spends.
 *  D. The same leaf-through on a clear unroofed day still pays.
 *  E. Rain under a roofed corner still pays — the sheeting is
 *     why the Dry Corner exists.
 *  F. A scorcher still pays. Two candles still refuse.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction({id:'guestbook'}).
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

const gb = /\} else if\(a\.id==='guestbook'\)\{([\s\S]*?)\n  \} else if\(a\.id==='bench'\)/.exec(player);
const body = gb ? gb[1] : '';

ok(/Leaf through it once a session/.test(cfg)
  && /one of the names always left something behind/.test(cfg)
  && /the notebook, the can, the snapshot, the panels/.test(cfg)
  && /stops the rain from taking the story/.test(cfg)
  && /One of the names left something behind/.test(player),
  'the notebook still leaves something behind; the Dry Corner still names it');
ok(body && /weather\s*===\s*'rain'/.test(body) && /dryBuilt\s*\(\s*\)/.test(body),
  'HV-202: the notebook payout reads a rainy sky and whether the corner is roofed');
ok(!/soaked leaf/.test(ui) && !/notebookLeafed/.test(ui) && !/Rain took the spiral notebook/.test(ui),
  'ui.js untouched — the soak lives on the leaf-through');

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
    if (!sessionStorage.getItem('hvwetleaf-init')) {
      sessionStorage.setItem('hvwetleaf-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-anniversary');
      localStorage.removeItem('hv-guestbook');
      localStorage.removeItem('hv-drycorner');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const leaf = (weather, toasts, built) => page.evaluate(({ weather, toasts, built }) => {
    saveHvAnniv({ toasts: toasts });
    saveHvGb({ leafs: 0 });
    saveHvDry({ built: !!built, sits: 0 });
    notebookLeafed = false;
    G.weather = weather;
    G.food = 10;
    log('HV202-LEAF');
    finishAction({ id: 'guestbook' });
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV202-LEAF/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      food: G.food,
      leafs: loadHvGb().leafs,
      latch: !!notebookLeafed,
      soaked: /rain took the spiral notebook/i.test(newest) || /soaked leaf/i.test(newest),
      paid: /One of the names left something behind/.test(newest),
      refused: /No notebook by the fridge yet/.test(newest),
    };
  }, { weather, toasts, built });

  const rainOpen = await leaf('rain', 3, false);
  ok(rainOpen.food === 10 && rainOpen.leafs === 0 && rainOpen.soaked && !rainOpen.paid && rainOpen.latch,
    `HV-202: rain on an unroofed notebook soaks the leaf (food ${rainOpen.food}, leafs ${rainOpen.leafs})`);

  const clearOpen = await leaf('clear', 3, false);
  ok(clearOpen.food === 17 && clearOpen.leafs === 1 && clearOpen.paid && !clearOpen.soaked,
    `a clear unroofed leaf-through still pays the dish (food ${clearOpen.food}, leafs ${clearOpen.leafs})`);

  const rainRoof = await leaf('rain', 3, true);
  ok(rainRoof.food === 17 && rainRoof.leafs === 1 && rainRoof.paid && !rainRoof.soaked,
    `rain under a roofed corner still pays — the sheeting keeps the pages (food ${rainRoof.food})`);

  const heatOpen = await leaf('heat', 3, false);
  ok(heatOpen.food === 17 && heatOpen.leafs === 1 && heatOpen.paid && !heatOpen.soaked,
    `a scorcher still pays the dish (food ${heatOpen.food})`);

  const early = await leaf('rain', 2, false);
  ok(early.food === 10 && early.leafs === 0 && early.refused && !early.soaked && !early.paid,
    'two candles still leave no notebook out, rain or not');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

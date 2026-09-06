/* HV-213 — Look at the Snapshot said somebody in the shot
 * swings by after with a little something, then a rainy day
 * still brought them to the door.
 *
 * A look at the reunion snapshot pays because somebody in the
 * frame always swings by after. finishAction never read
 * G.weather. Kind Stranger’s bag and Marisol’s casserole already
 * know rain turns a visitor back. A swing-by that sat in the rain
 * is not a little something.
 *
 * #894 is the bare-door job. #889 is chalk-star groceries in a
 * snap. #884 is Kind Stranger’s bag. #904 is Marisol’s casserole.
 * This is the snapshot visitor in the rain.
 *
 *  A. Source: somebody in the shot still swings by after.
 *  B. Source: the snapshot payout reads G.weather. ui.js does not.
 *  C. Live: rain, three reunions — the pot does not move.
 *     The look tally does not tick. The log names the rain.
 *  D. A clear day still pays the dish and ticks the tally.
 *  E. Two reunions still leave the door bare, rain or not.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction({id:'snapshot'}).
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

const snap = /\} else if\(a\.id==='snapshot'\)\{([\s\S]*?)\n  \} else if\(a\.id==='anniv'\)/.exec(player);
const body = snap ? snap[1] : '';

ok(/swings by with a little something after/.test(cfg)
  && /swings by after with a little something/.test(player)
  && /id:\s*'snapshot'/.test(cfg),
  'Look at the Snapshot still sends somebody in the shot swinging by');
ok(body && /G\.weather/.test(body),
  'HV-213: the snapshot payout reads the sky');
ok(!/rain turned them back|swings by in the rain/.test(ui),
  'ui.js untouched — the rain lives on the look');

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
    if (!sessionStorage.getItem('hvwetsnap-init')) {
      sessionStorage.setItem('hvwetsnap-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-reunion');
      localStorage.removeItem('hv-portrait');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const look = (held, weather) => page.evaluate(({ held, weather }) => {
    saveHvReunion({ held: held });
    saveHvSnap({ looks: 0 });
    snapshotLooked = false;
    G.weather = weather;
    G.food = 10;
    log('HV213-SNAP');
    finishAction({ id: 'snapshot' });
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV213-SNAP/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      food: G.food,
      looks: loadHvSnap().looks,
      latch: !!snapshotLooked,
      soaked: /rain/i.test(newest) && /swing|shot|something|back/i.test(newest),
      paid: /reunion snapshot/.test(newest) && /little something/.test(newest),
      bare: /No snapshot/.test(newest),
    };
  }, { held, weather });

  const wet = await look(3, 'rain');
  ok(wet.food === 10 && wet.looks === 0 && !wet.latch && wet.soaked && !wet.paid,
    `HV-213: rain turns the visitor back (food ${wet.food}, looks ${wet.looks}, latch ${wet.latch})`);

  const dry = await look(3, 'clear');
  ok(dry.food === 15 && dry.looks === 1 && dry.latch && dry.paid && !dry.soaked,
    `a clear day still pays the look (food ${dry.food}, looks ${dry.looks})`);

  const early = await look(2, 'rain');
  ok(early.food === 10 && early.looks === 0 && early.bare && !early.paid,
    'two reunions still leave the door bare, rain or not');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

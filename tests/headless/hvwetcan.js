/* HV-214 — Dig Up the Coffee Can said something’s tucked in
 * with it, then rain on an unroofed piling still paid a dry-can
 * dish.
 *
 * The can is buried by the piling — a notebook page, a snapshot,
 * a guitar pick. The Dry Corner says the can goes under the
 * sheeting so the rain stops taking the story. finishAction never
 * read G.weather or dryBuilt(). An open hole in the rain is not
 * a dry capsule.
 *
 * #905 is the bare-piling job. #892 is the notebook leaf. This
 * is the can in the wet hole.
 *
 *  A. Source: the can is still by the piling, and the Dry Corner
 *     still sheets it in. THE COFFEE CAN still tucks something in.
 *  B. Source: the can payout reads G.weather / dryBuilt.
 *     ui.js does not.
 *  C. Live: rain, three playings, no roof — the pot does not move.
 *     The dig tally does not tick. The log names the rain.
 *  D. Rain under a roof still pays. A clear unroofed hole still pays.
 *  E. Two playings still bury nothing, rain or not.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction({id:'can'}).
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

const can = /\} else if\(a\.id==='can'\)\{([\s\S]*?)\n  \} else if\(a\.id==='fifth'\)/.exec(player);
const body = can ? can[1] : '';

ok(/coffee can by the piling/.test(cfg)
  && /the notebook, the can/.test(cfg)
  && /THE COFFEE CAN/.test(player)
  && /tucked in with it/.test(player),
  'the can is still by the piling, and the Dry Corner still sheets it in');
ok(body && (/G\.weather/.test(body) || /dryBuilt/.test(body)),
  'HV-214: the can payout reads the sky and the roof');
ok(!/filled the hole|soaked/.test(ui),
  'ui.js untouched — the rain lives on the dig');

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
    if (!sessionStorage.getItem('hvwetcan-init')) {
      sessionStorage.setItem('hvwetcan-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-song');
      localStorage.removeItem('hv-capsule');
      localStorage.removeItem('hv-dry');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dig = (plays, weather, roofed) => page.evaluate(({ plays, weather, roofed }) => {
    saveHvSong({ plays: plays });
    saveHvCan({ digs: 0 });
    saveHvDry({ built: !!roofed, sits: 0 });
    canDug = false;
    G.weather = weather;
    G.food = 10;
    log('HV214-CAN');
    finishAction({ id: 'can' });
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV214-CAN/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      food: G.food,
      digs: loadHvCan().digs,
      latch: !!canDug,
      soaked: /rain/i.test(newest) && /piling|hole|soak|page|can/i.test(newest),
      paid: /THE COFFEE CAN/.test(newest) && /tucked in/.test(newest),
      bare: /Nothing buried/.test(newest),
    };
  }, { plays, weather, roofed });

  const wet = await dig(3, 'rain', false);
  ok(wet.food === 10 && wet.digs === 0 && !wet.latch && wet.soaked && !wet.paid,
    `HV-214: rain on an open hole soaks the can (food ${wet.food}, digs ${wet.digs}, latch ${wet.latch})`);

  const roofed = await dig(3, 'rain', true);
  ok(roofed.food === 21 && roofed.digs === 1 && roofed.latch && roofed.paid && !roofed.soaked,
    `rain under the sheeting still pays (food ${roofed.food}, digs ${roofed.digs})`);

  const dry = await dig(3, 'clear', false);
  ok(dry.food === 21 && dry.digs === 1 && dry.paid,
    `a clear unroofed hole still pays (food ${dry.food}, digs ${dry.digs})`);

  const early = await dig(2, 'rain', false);
  ok(early.food === 10 && early.digs === 0 && early.bare && !early.paid,
    'two playings still bury nothing, rain or not');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

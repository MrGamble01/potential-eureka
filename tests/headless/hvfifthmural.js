/* HV-208 — Stand at the Fifth Panel said beside the finished
 * mural, then paid while the wall was still four-panels short.
 *
 * Somebody primes a fifth panel beside the finished mural —
 * the four panels, then the fifth, the whole underpass. The
 * gate is three digs of the coffee can. finishAction never
 * asked whether the four were up. A fifth with no four is
 * not a fifth.
 *
 * #790 is Word fading an unfinished mural. #794 is the stand
 * latch vs dawn. #860 is wet paint. #887 is morning light.
 * This is the missing four.
 *
 *  A. Source: the fifth is still beside the finished mural.
 *     Three digs still prime it. The mural is still four panels.
 *  B. Source: the fifth-panel payout reads G.mural / MURAL_PANELS.
 *     ui.js does not.
 *  C. Live: three digs, zero panels — the pot does not move.
 *     The log names the missing four. The stand tally does not
 *     tick.
 *  D. The same three digs beside a finished mural still pay.
 *  E. Two digs still prime nothing, finished mural or not.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction({id:'fifth'}).
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

const fifth = /\} else if\(a\.id==='fifth'\)\{([\s\S]*?)\n  \} else if\(a\.id==='walk'\)/.exec(player);
const body = fifth ? fifth[1] : '';

ok(/beside the finished mural/.test(cfg)
  && /fifth panel beside the finished mural/.test(cfg)
  && /THE FIFTH PANEL/.test(player)
  && /MURAL_PANELS\s*=\s*4/.test(cfg),
  'the fifth is still beside the finished mural; the wall is still four panels');
ok(body && (/G\.mural/.test(body) || /MURAL_PANELS/.test(body)),
  'HV-208: the fifth-panel payout reads whether the four are up');
ok(!/four are still bare/.test(ui) && !/panelStood/.test(ui),
  'ui.js untouched — the missing four live on the stand');

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
    if (!sessionStorage.getItem('hvfifthmural-init')) {
      sessionStorage.setItem('hvfifthmural-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-capsule');
      localStorage.removeItem('hv-mural');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const stand = (digs, mural) => page.evaluate(({ digs, mural }) => {
    saveHvCan({ digs: digs });
    saveHvPanel({ stands: 0 });
    panelStood = false;
    G.mural = mural;
    G.food = 10;
    log('HV208-FIFTH');
    finishAction({ id: 'fifth' });
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV208-FIFTH/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      food: G.food,
      stands: loadHvPanel().stands,
      latch: !!panelStood,
      missing: /four/.test(newest) && /mural|panel|bare/i.test(newest),
      paid: /THE FIFTH PANEL/.test(newest) && /left something/.test(newest),
      primed: /still bare block/.test(newest),
    };
  }, { digs, mural });

  const short = await stand(3, 0);
  ok(short.food === 10 && short.stands === 0 && !short.latch && short.missing && !short.paid,
    `HV-208: three digs beside zero panels leave the fifth waiting (food ${short.food}, stands ${short.stands}, latch ${short.latch})`);

  const done = await stand(3, 4);
  ok(done.food === 22 && done.stands === 1 && done.paid && !done.missing,
    `three digs beside a finished mural still pay (food ${done.food}, stands ${done.stands})`);

  const early = await stand(2, 4);
  ok(early.food === 10 && early.stands === 0 && early.primed && !early.paid && !early.missing,
    'two digs still prime nothing, finished mural or not');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

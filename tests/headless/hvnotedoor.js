/* HV-206 — the fridge-door note said taped in the fridge door,
 * then a fridge-less corner still found it.
 *
 * Every fresh camp with a history to cite finds a note taped
 * inside the corner fridge's door. deliverHvNote fires on any
 * welcomed-camp count OR any beaten hold — it never asks whether
 * the fridge hums. Start Over keeps the long memory and unplugs
 * nothing that was never plugged in. A note taped in a door that
 * is not there is not a note.
 *
 * #820 is take-the-milk never moving the pot. #894 is Look at
 * the Snapshot starting the job when two reunions left the door
 * bare. This is the note, and the missing fridge.
 *
 *  A. Source: the note is still taped in the fridge door. Take
 *     the milk still stands. The letter tally still lives.
 *  B. Source: deliverHvNote reads whether the fridge is built.
 *     ui.js does not.
 *  C. Live: no fridge, a 14-dawn hold — morale stays, the tally
 *     stays, the log never names the door.
 *  D. The same hold with the fridge humming still delivers +2
 *     and ticks.
 *  E. No history still leaves the door blank, fridge or not.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production deliverHvNote().
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const fn = /function deliverHvNote\(\)\{([\s\S]*?)\n\}/.exec(cfg);
const body = fn ? fn[1] : '';

ok(/A note taped in the fridge door/.test(cfg)
  && /Take the milk, leave a story/.test(cfg)
  && /taped inside the corner/.test(cfg)
  && /HVNOTE_KEY='hv-letter'/.test(cfg)
  && /HVNOTE_MORALE=2/.test(cfg),
  'the note is still taped in the fridge door; take the milk still stands');
ok(body && /loadFridge\s*\(\s*\)\.built/.test(body),
  'HV-206: deliverHvNote reads whether the fridge is humming');
ok(!/deliverHvNote/.test(ui) && !/hv-letter/.test(ui) && !/no fridge on the corner/.test(ui),
  'ui.js untouched — the missing door lives on the delivery');

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
    if (!sessionStorage.getItem('hvnotedoor-init')) {
      sessionStorage.setItem('hvnotedoor-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const leave = (built, days, camps) => page.evaluate(({ built, days, camps }) => {
    saveFridge({ built: !!built, camps: camps });
    saveHvRec({ days: days, beats: days > 0 ? 1 : 0 });
    saveHvNote({ read: 0 });
    G.morale = 50;
    log('HV206-DOOR');
    deliverHvNote();
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV206-DOOR/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      morale: G.morale,
      read: loadHvNote().read,
      taped: /taped in the fridge door/.test(newest),
      missing: /no fridge on the corner/.test(newest) || /no door/.test(newest),
    };
  }, { built, days, camps });

  const bareHold = await leave(false, 14, 0);
  ok(bareHold.morale === 50 && bareHold.read === 0 && !bareHold.taped,
    `HV-206: a 14-dawn hold with no fridge leaves the door blank (morale ${bareHold.morale}, read ${bareHold.read})`);

  const hums = await leave(true, 14, 1);
  ok(hums.morale === 52 && hums.read === 1 && hums.taped,
    `the same hold with the fridge humming still delivers (morale ${hums.morale}, read ${hums.read})`);

  const noHist = await leave(true, 0, 0);
  ok(noHist.morale === 50 && noHist.read === 0 && !noHist.taped,
    'a humming fridge with no history still leaves the door blank');

  const nothing = await leave(false, 0, 0);
  ok(nothing.morale === 50 && nothing.read === 0 && !nothing.taped,
    'no fridge and no history still leaves the door blank');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

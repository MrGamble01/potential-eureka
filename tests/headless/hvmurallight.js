/* HV-197 — the finished mural said morning light, then a rainy
 * dawn still named the light.
 *
 * The finished wall greets every morning: a fixed +2 morale, and
 * sometimes the log says "Morning light on the mural." Rain still
 * wrote that line. There is no morning light in the rain. The
 * mural still helps. The sky does not clear.
 *
 * #860 is wet paint on a session that needs to dry. #847 is
 * passers-by lingering for a set. #886 is Good Weather vs the
 * garden. This is the greeting on a rainy dawn.
 *
 *  A. Source: the finished mural still greets the morning. The
 *     log still names morning light.
 *  B. Source: muralAtDawn reads a rainy sky. ui.js does not.
 *  C. Live: a finished wall, pinned roll, rain — +2 morale, no
 *     morning-light line.
 *  D. The same roll on a clear dawn still names the light.
 *  E. A scorcher still names the light. An unfinished wall stays
 *     quiet. The mural still helps in the rain.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production muralAtDawn().
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const dawn = /function muralAtDawn\(\)\{([\s\S]*?)\n\}/.exec(loop);
const body = dawn ? dawn[1] : '';

ok(/the finished mural greets every morning/.test(loop)
  && /Morning light on the mural/.test(loop)
  && /It helps more than it should/.test(loop),
  'the finished mural still greets the morning; the log still names the light');
ok(body && /weather\s*!==\s*'rain'|weather\s*===\s*'rain'/.test(body),
  'HV-197: muralAtDawn reads a rainy sky');
ok(!/Morning light on the mural/.test(ui) && !/muralAtDawn/.test(ui),
  'ui.js untouched — the greeting lives at dawn');

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
    if (!sessionStorage.getItem('hvmurallight-init')) {
      sessionStorage.setItem('hvmurallight-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const greet = (weather, panels, roll) => page.evaluate(({ weather, panels, roll }) => {
    const real = Math.random;
    Math.random = () => roll;
    G.mural = panels;
    G.weather = weather;
    G.morale = 50;
    log('HV197-MARK');
    muralAtDawn();
    Math.random = real;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = lines.findLastIndex(t => /HV197-MARK/.test(t));
    const newest = (at >= 0 ? lines.slice(at + 1) : lines.slice(-6)).join('\n');
    return {
      morale: G.morale,
      light: /Morning light on the mural/.test(newest),
    };
  }, { weather, panels, roll });

  const rain = await greet('rain', 4, 0.01);
  ok(rain.morale === 52 && !rain.light,
    `HV-197: a rainy greeting skips the morning light (morale ${rain.morale})`);

  const clear = await greet('clear', 4, 0.01);
  ok(clear.morale === 52 && clear.light,
    `a clear greeting still names the light (morale ${clear.morale})`);

  const heat = await greet('heat', 4, 0.01);
  ok(heat.morale === 52 && heat.light,
    'a scorcher still names the light');

  const wetQuiet = await greet('rain', 4, 0.99);
  ok(wetQuiet.morale === 52 && !wetQuiet.light,
    'the mural still helps in the rain when the flavor roll stays quiet');

  const undone = await greet('clear', 3, 0.01);
  ok(undone.morale === 50 && !undone.light,
    'an unfinished wall stays quiet');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

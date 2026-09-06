/* HV-78 — Rest said recover health and morale, then only logged health.
 *
 * Rest's tooltip promises both: "Recover health and morale slightly."
 * finishAction applies both — health rand(5,15), morale rand(3,8) —
 * but the float and the log only count health:
 *   floatText('+'+h+'❤️');
 *   log('You rest. Health +'+h+'.');
 *
 * Meeting, mural and busk all announce the morale they paid. Rest
 * moves the HUD in silence. A player who reads the log — the thing
 * that confirms what just happened — is told they recovered health.
 * The morale line of the tooltip never shows up.
 *
 * This suite is write-first and source-driven.
 *
 *  A. The tooltip still promises morale — that is the contract.
 *  B. Source: the rest branch's log() names morale. ui.js is not
 *     this ticket (it still only paints the log line it is given).
 *  C. Live: a pinned rest pays +5 health and +3 morale (rand min
 *     at Math.random = 0) and the log says so. Health still moves.
 *     Reverting the log to health-only fails the named line.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(ACTIONS.rest).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const restTip = (cfg.match(/id:'rest'[\s\S]*?tooltip:'([^']+)'/) || [])[1] || '';
const restAt = player.indexOf("a.id==='rest'");
const rest = restAt >= 0 ? player.slice(restAt, restAt + 420) : '';
const restLog = (rest.match(/log\(([^)]+)\)/) || [])[1] || '';

(async () => {
  ok(/morale/i.test(restTip),
     `the Rest tooltip still promises morale (got ${JSON.stringify(restTip)})`);

  ok(restAt >= 0 && /G\.morale\s*=/.test(rest),
     'finishAction still applies morale on rest — guards the guard');

  ok(/morale/i.test(restLog),
     `the rest log names the morale it paid (got ${restLog})`);

  ok(!/You rest/.test(ui) && !/id:'rest'/.test(ui),
     'ui.js is not this ticket — it still only paints the log line it is given');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvrest-init')) {
      sessionStorage.setItem('hvrest-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const live = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0;
    G.health = 50;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    finishAction(ACTIONS.find(a => a.id === 'rest'));
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { health: G.health, morale: G.morale, log };
  });

  ok(live.health === 55,
     `a pinned rest still pays +5 health (50 → ${live.health})`);
  ok(live.morale === 53,
     `and +3 morale — rand(3,8) at 0 is 3 (50 → ${live.morale})`);
  ok(/morale\s*\+3/i.test(live.log),
     `HV-78: Rest's log counts the morale it paid (log has ${JSON.stringify(live.log.slice(-120))})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

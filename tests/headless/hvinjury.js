/* HV-69 — Injury says "Moving slowly" and the walk never slows.
 *
 * The Injury card: "You hurt yourself. Moving slowly for the next
 * while." It stamps G.injuredUntil for 90 seconds. doAction already
 * multiplies the action bar by 1.8×. movePlayer() never reads the
 * stamp — PLAYER_SPEED stays 4.2. You limp on the progress bar and
 * sprint across camp.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the card still sells a slow walk; doAction still uses
 *    the 1.8×. movePlayer reads injuredUntil. ui.js is not touched.
 * B. Behaviour: drive frame() by hand (same clock as hvwander). A
 *    healthy second covers ~4.2u. An injured second covers ~4.2/1.8.
 *    Reverting the walk factor fails the named injured stride.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const main   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const loop   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const moveAt = main.indexOf('function movePlayer(dt){');
const move = moveAt >= 0 ? main.slice(moveAt, moveAt + 900) : '';
const injAt = loop.indexOf("id:'injury'");
const inj = injAt >= 0 ? loop.slice(injAt, injAt + 420) : '';

ok(/Moving slowly for the next while/.test(inj),
   'Injury still sells a slow walk on the card');
ok(/G\.injuredUntil\s*=\s*Date\.now\(\)\s*\+\s*90000/.test(inj),
   'Injury still stamps ninety seconds on injuredUntil');
ok(/now\s*<\s*G\.injuredUntil\s*\?\s*a\.time\s*\*\s*1\.8/.test(player),
   'actions still take 1.8× while hurt — that half already worked');
ok(moveAt >= 0 && /PLAYER_SPEED/.test(move),
   'movePlayer is still the walk — guards the guard');
ok(/injuredUntil/.test(move) && /PLAYER_SPEED\s*\/\s*1\.8/.test(move),
   'HV-69: movePlayer reads injuredUntil and walks at PLAYER_SPEED/1.8');
ok(!/injuredUntil/.test(ui) && !/function movePlayer/.test(ui),
   'ui.js is not this ticket — it never drove the walk');

const FRAME = 1000 / 60;

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    card: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'injury')),
    speed: typeof PLAYER_SPEED === 'number' ? PLAYER_SPEED : null,
  }));
  ok(!boot.intro && boot.card && boot.speed === 4.2,
     'a returning camp still has the Injury card and a 4.2 walk');

  // Drive frame() by hand: headless rAF has its own clock, and the
  // claim is what one known second of WASD does while hurt.
  const stride = (hurt, steps, dt) => page.evaluate(({ hurt, steps, dt }) => {
    player.position.set(0, 0, 0);
    walkTarget = null;
    keysDown = { right: true };
    if (hurt) {
      const ev = EVENTS_BAD.find(e => e.id === 'injury');
      ev.effect();
    } else {
      G.injuredUntil = 0;
    }
    let ts = 1e6;
    frame(ts);
    const from = player.position.x;
    for (let i = 0; i < steps; i++) frame(ts += dt);
    keysDown = {};
    return { dx: player.position.x - from, until: G.injuredUntil };
  }, { hurt, steps, dt });

  const healthy = await stride(false, 60, FRAME);
  ok(Math.abs(healthy.dx - 4.2) < 0.05,
     `a healthy second still covers 4.2u (got ${healthy.dx.toFixed(3)})`);

  const limp = await stride(true, 60, FRAME);
  ok(limp.until > Date.now(),
     'the Injury card still stamps injuredUntil for the walk that follows');
  ok(Math.abs(limp.dx - (4.2 / 1.8)) < 0.05,
     `HV-69: an injured second covers 4.2/1.8u, not a full stride (got ${limp.dx.toFixed(3)})`);
  ok(limp.dx < healthy.dx - 1,
     `the limp is slower than the healthy walk (${limp.dx.toFixed(3)} < ${healthy.dx.toFixed(3)})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

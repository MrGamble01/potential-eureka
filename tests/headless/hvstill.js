/* HV-63 — reading The Bridge still walked the camp.
 *
 * HV-56 / HV-59 paused tickDay behind the crash course and The Bridge
 * so reading does not cost daylight. The figure kept walking. WASD,
 * held arrow keys, and a queued tap-walk all still drove movePlayer
 * while #chain-modal covered the diorama. A player who opened The
 * Bridge with W held, or who had tapped a dumpster and then opened
 * the overlay, came back somewhere else.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: movePlayer early-returns via overlayOpen(), a sibling of
 *    introOpen / bridgeOpen declared in config.js (the first game
 *    script). ui.js is not touched — it still only opens and closes
 *    overlays. The clock pauses stay in tickDay.
 * B. Behaviour on the real page: with The Bridge open, the player's
 *    position holds even with W held and a tap-walk planted. Close it
 *    and the figure is still there (keys and the walk were dropped, so
 *    closing does not lurch). With the overlay closed the same W
 *    actually walks. Reverting the early-return fails the named hold.
 *
 * Arrive as a returning camp (hv-intro-seen) so the crash-course
 * pause is not what is holding the figure.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const moveAt = main.indexOf('function movePlayer(dt){');
const move = moveAt >= 0 ? main.slice(moveAt, moveAt + 900) : '';

(async () => {
  // --- A. source --------------------------------------------------------
  ok(moveAt >= 0 && /function movePlayer\(dt\)\{/.test(move),
     'movePlayer is still in main.js — guards the guard');

  const overlayCallAt = move.indexOf('if(overlayOpen())');
  ok(overlayCallAt >= 0,
     'movePlayer early-returns via overlayOpen() while an overlay is up');

  ok(/keysDown=\{\}/.test(move) && /walkTarget=null/.test(move),
     'the early-return also drops held keys and a queued tap-walk, so closing does not lurch');

  const helper = /function overlayOpen\(\)\{\s*if\(introOpen\(\)\) return true;\s*if\(bridgeOpen\(\)\) return true;\s*if\(typeof gameOverShown!=='undefined' && gameOverShown\) return true;\s*return !!document\.getElementById\('hv-graduation'\);\s*}/.exec(cfg);
  ok(!!helper,
     'overlayOpen lives in config.js beside introOpen / bridgeOpen — intro, The Bridge, game-over, Keys in Hand');

  ok(!/function overlayOpen/.test(ui) && !/function movePlayer/.test(ui),
     'ui.js was not given a move API — it still only opens and closes overlays');

  ok(!/getElementById\('chain-modal'\)/.test(move),
     'movePlayer itself does not reach into #chain-modal — it asks overlayOpen()');

  ok(/if\(introOpen\(\)\) return/.test(loop) && /if\(bridgeOpen\(\)\) return/.test(loop),
     'the HV-56 / HV-59 clock pauses in tickDay are untouched');

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

  // --- B. behaviour -----------------------------------------------------
  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    chain: !!(document.getElementById('chain-modal') && document.getElementById('chain-modal').classList.contains('open')),
    over: !!document.getElementById('hv-gameover'),
    btn: !!document.getElementById('chain-btn'),
    helper: typeof overlayOpen === 'function' && overlayOpen() === false,
    x: player.position.x, z: player.position.z,
  }));
  ok(!boot.intro && !boot.over && boot.btn && !boot.chain,
     'a returning camp is not behind the crash course or game-over — The Bridge button is free');
  ok(boot.helper, 'overlayOpen() is live on the page and reports closed on boot');

  // Prove the figure actually walks with the overlay closed, so a suite
  // that froze all movement would fail here rather than look like a hold.
  await page.evaluate(() => {
    player.position.x = 0;
    player.position.z = 0;
    keysDown = { up: true };
    walkTarget = null;
  });
  await page.waitForTimeout(800);
  const walking = await page.evaluate(() => ({
    x: player.position.x, z: player.position.z, keys: Object.keys(keysDown),
  }));
  ok(walking.z < -1.5,
     `with The Bridge closed, held W walks the figure (z 0 -> ${walking.z.toFixed(2)})`);

  await page.evaluate(() => { keysDown = {}; });
  await page.waitForTimeout(200);

  await page.click('#chain-btn');
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => ({
    cls: document.getElementById('chain-modal').classList.contains('open'),
    helper: typeof overlayOpen === 'function' && overlayOpen() === true,
  }));
  ok(opened.cls && opened.helper,
     'clicking The Bridge opens #chain-modal and overlayOpen() agrees');

  // Park the figure, hold W, and plant a tap-walk that would cross the
  // camp in well under the wait below. Without the hold, either input
  // moves the player. With it, position stays put and the inputs die.
  const parked = await page.evaluate(() => {
    player.position.x = 0;
    player.position.z = 0;
    player.rotation.y = 0;
    keysDown = { up: true };
    walkTarget = { x: 8, z: 4 };
    return { x: player.position.x, z: player.position.z, rot: player.rotation.y };
  });
  await page.waitForTimeout(1500);
  const held = await page.evaluate(() => ({
    x: player.position.x, z: player.position.z, rot: player.rotation.y,
    open: document.getElementById('chain-modal').classList.contains('open'),
    keys: Object.keys(keysDown).length,
    walk: walkTarget,
  }));
  ok(held.open && held.x === parked.x && held.z === parked.z,
     `the figure stands still behind The Bridge (W held, tap-walk planted — x ${parked.x}->${held.x}, z ${parked.z}->${held.z})`);
  ok(held.keys === 0 && held.walk === null,
     'held keys and the queued tap-walk were dropped, not merely ignored');
  ok(held.rot === parked.rot,
     `facing holds with the figure ("${parked.rot}" -> "${held.rot}")`);

  await page.click('#chain-close');
  await page.waitForTimeout(800);
  const closed = await page.evaluate(() => ({
    open: document.getElementById('chain-modal').classList.contains('open'),
    x: player.position.x, z: player.position.z,
    helper: typeof overlayOpen === 'function' && overlayOpen() === false,
  }));
  ok(!closed.open && closed.helper,
     'the close control dismisses The Bridge and overlayOpen() agrees');
  ok(closed.x === parked.x && closed.z === parked.z,
     `closing The Bridge does not lurch the figure (x ${closed.x}, z ${closed.z})`);

  // Same W, overlay down: the figure walks again.
  await page.evaluate(() => { keysDown = { up: true }; walkTarget = null; });
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    z: player.position.z, keys: Object.keys(keysDown),
  }));
  ok(after.z < parked.z - 1.5,
     `with The Bridge closed again, held W walks (z ${parked.z} -> ${after.z.toFixed(2)})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

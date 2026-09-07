/* HV-271 — closing the tab threw away the last half-minute of the camp.
 *
 * Homeless Village writes its save on a 30-second autosave timer in
 * frame(), plus explicit saveGame() calls inside the once-a-day and
 * chain actions. The five grind actions a player actually spends the
 * day on — Scavenge, Forage, Panhandle, Rest, Trade — never save, and
 * neither does hiring a worker. So whatever landed since the last tick
 * of the 30s timer lives only in memory.
 *
 * Every other flagship closes that window: Tycoon, Grow Op and Voxel
 * Isle all save on beforeunload AND on visibilitychange→hidden /
 * pagehide, because iOS Safari kills a backgrounded tab without ever
 * firing beforeunload. Homeless Village had none of the three. Switch
 * apps on a phone after a good haul, come back to a killed tab, and the
 * haul is gone. Close the laptop lid mid-session; same.
 *
 * The fix is the sibling games' handler, in main.js beside the other
 * window listeners, with one guard the siblings needed too: Start Over
 * (game over) and Start a New Camp (graduation) clear the save key and
 * reload — a pagehide save would write the dead camp straight back and
 * make both buttons no-ops. So the handler stands down while the
 * game-over overlay or the graduation overlay is up.
 *
 * Write-first; hook-free (real page, real events, real localStorage).
 *
 * A. Source: main.js listens for pagehide and visibilitychange and
 *    saves; the handler is guarded by gameOverShown and #hv-graduation.
 *    ui.js is not part of the fix.
 * B. Live: a forage lands in memory only (the save key still shows the
 *    old wood). pagehide writes it. Reverting the handler fails the
 *    named assertion.
 * C. Live: visibilitychange→hidden writes it too (the mobile path).
 * D. Real navigation away from the page writes it, and the camp comes
 *    back with the haul on the next visit.
 * E. Guard: with the game-over overlay up, a cleared key stays cleared
 *    through pagehide; same for the graduation overlay.
 * F. Guard: a key another writer changed since this page last wrote or
 *    loaded it (a second tab, the hub's Reset progress) is left alone.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const KEY = 'homeless_village_v1';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// ── A. Source ──
const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
ok(/addEventListener\(\s*'pagehide'/.test(main) && /addEventListener\(\s*'visibilitychange'/.test(main),
  'HV-271: main.js saves on pagehide and on visibilitychange, like Tycoon, Grow Op and Voxel Isle');
const leaveAt = main.indexOf("'pagehide'");
const around = leaveAt >= 0 ? main.slice(Math.max(0, leaveAt - 1200), leaveAt + 400) : '';
ok(/gameOverShown/.test(around) && /hv-graduation/.test(around),
  'the leave-save stands down behind the game-over and graduation overlays (Start Over / Start a New Camp clear the key and reload)');
ok(!/pagehide|visibilitychange/.test(ui), 'ui.js is not part of the fix');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvleave-init')) {
      sessionStorage.setItem('hvleave-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = (fn, arg) => page.evaluate(fn, arg);
  const saved = () => t(() => { const r = localStorage.getItem('homeless_village_v1'); return r ? JSON.parse(r) : null; });

  // Pin the save to a known state so "in memory only" is provable.
  await t(() => { G.wood = 0; G.cardboard = 0; G.goodwill = 0; saveGame(); autosaveTimer = 0; });

  // ── B. pagehide ──
  const forage = await t(() => {
    finishAction(ACTIONS.find(a => a.id === 'forage'));   // the grind action: no saveGame in its branch
    return { wood: G.wood, card: G.cardboard };
  });
  const before = await saved();
  ok(forage.wood > 0 && before && before.wood === 0,
    `a forage lands in memory only — G.wood ${forage.wood}, the save still says ${before && before.wood} (this is the window)`);
  await t(() => window.dispatchEvent(new Event('pagehide')));
  const afterHide = await saved();
  ok(afterHide && afterHide.wood === forage.wood && afterHide.cardboard === forage.card,
    `HV-271: pagehide writes the haul (save wood ${afterHide && afterHide.wood}, cardboard ${afterHide && afterHide.cardboard}) — reverting the handler fails this by name`);

  // ── C. visibilitychange → hidden (the mobile path) ──
  const hidden = await t(() => {
    G.goodwill = 7;
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const r = JSON.parse(localStorage.getItem('homeless_village_v1') || 'null');
    delete document.visibilityState;
    return { gw: r && r.goodwill, live: document.visibilityState };
  });
  ok(hidden.gw === 7, `visibilitychange→hidden writes the save too (save goodwill ${hidden.gw})`);
  ok(hidden.live === 'visible', 'the visibility shim is undone after the check');

  // ── D. Real navigation away, then back ──
  await t(() => { G.wood = 41; G.scraps = 13; });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const onLeave = await saved();
  ok(onLeave && onLeave.wood === 41 && onLeave.scraps === 13,
    `navigating away writes the camp (save wood ${onLeave && onLeave.wood}, scraps ${onLeave && onLeave.scraps})`);
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const back = await t(() => ({ wood: G.wood, scraps: G.scraps }));
  ok(back.wood === 41 && back.scraps === 13, `and the camp comes back with the haul (wood ${back.wood}, scraps ${back.scraps})`);

  // ── E. The guard: Start Over and Start a New Camp must still wipe ──
  const guard = await t(() => {
    showGameOver();                                   // the overlay that owns Start Over
    localStorage.removeItem('homeless_village_v1');   // what Start Over does before location.reload()
    window.dispatchEvent(new Event('pagehide'));      // what the reload fires
    const afterGameOver = localStorage.getItem('homeless_village_v1');
    // Reset for the graduation path.
    gameOverShown = false;
    const go = document.getElementById('hv-gameover'); if (go) go.remove();
    showGraduation();                                 // the overlay that owns Start a New Camp
    localStorage.removeItem('homeless_village_v1');
    window.dispatchEvent(new Event('pagehide'));
    const afterGrad = localStorage.getItem('homeless_village_v1');
    const gr = document.getElementById('hv-graduation'); if (gr) gr.remove();
    // Overlays down: re-baseline with the game's own save, change the
    // camp, leave — the leave-save works again.
    saveGame(); G.wood = 99;
    window.dispatchEvent(new Event('pagehide'));
    const afterClear = JSON.parse(localStorage.getItem('homeless_village_v1') || 'null');
    return { afterGameOver, afterGrad, afterClearWood: afterClear && afterClear.wood };
  });
  ok(guard.afterGameOver === null, 'behind the game-over overlay, a cleared key stays cleared through pagehide — Start Over still starts over');
  ok(guard.afterGrad === null, 'behind the graduation overlay, a cleared key stays cleared — Start a New Camp still starts one');
  ok(guard.afterClearWood === 99, `with both overlays down the leave-save writes again (save wood ${guard.afterClearWood})`);

  // ── F. Another writer owns the key: a second tab, the hub's Reset progress ──
  const other = await t(() => {
    saveGame(); G.wood = 5;                             // this page's camp
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    s.wood = 77; s.otherTab = true;                     // the tab you kept playing in wrote since
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
    window.dispatchEvent(new Event('pagehide'));
    const kept = JSON.parse(localStorage.getItem('homeless_village_v1'));
    localStorage.removeItem('homeless_village_v1');    // the hub's Reset progress, with this tab still open
    window.dispatchEvent(new Event('pagehide'));
    const wiped = localStorage.getItem('homeless_village_v1');
    return { keptWood: kept.wood, keptFlag: !!kept.otherTab, wiped };
  });
  ok(other.keptWood === 77 && other.keptFlag, `a key another tab wrote since is left alone (save wood ${other.keptWood}, not this page's 5)`);
  ok(other.wiped === null, "a key the hub's Reset progress cleared stays cleared — leaving the tab does not resurrect the camp");

  // ── Z ──
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

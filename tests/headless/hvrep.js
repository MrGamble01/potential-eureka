/*
 * HV-9 — Word on the Street (re-runnable; classic scripts, no hook).
 *  A. Fresh camps are A Stranger at 0; the HUD pill says so.
 *  B. addRep clamps 0–100 and logs tier crossings both ways.
 *  C. Known lifts panhandle odds: a pinned roll that fails a stranger
 *     succeeds once the neighborhood knows you (and success pays +1 rep).
 *  D. Respected halves complaint calls: the same pinned sweep roll that
 *     warns a stranger's camp passes a Respected one by.
 *  E. A regular reaching friendship vouches for you (+5 rep).
 *  F. Beloved dawns: −1 decay, then a fence-post gift at most once a day.
 *  G. The Respected goal is on the ladder; rep rides the save; legacy
 *     saves migrate to 0.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvr-init')) {
      sessionStorage.setItem('hvr-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // A. fresh state + pill
  const a = await t(() => { updateHUD(); return { rep: G.rep, tier: repTier(),
    pill: document.getElementById('rep-name').textContent, icon: document.getElementById('rep-icon').textContent }; });
  ok(a.rep === 0 && a.tier === 0, 'a fresh camp starts at 0 rep, A Stranger');
  ok(/A Stranger · 0/.test(a.pill) && a.icon === '💬', `the HUD pill says so (${a.icon} ${a.pill})`);

  // B. addRep math + tier logs
  const b = await t(() => {
    const logs = []; const oldLog = window.log; window.log = m => { logs.push(m); oldLog(m); };
    addRep(24); const at24 = { rep: G.rep, tier: repTier() };
    addRep(1);  const at25 = { rep: G.rep, tier: repTier(), crossed: logs.some(m => /Word gets around/.test(m) && /Known/.test(m)) };
    addRep(999); const clampHi = { rep: G.rep, tier: repTier(), beloved: logs.some(m => /Beloved/.test(m)) };
    addRep(-999); const clampLo = { rep: G.rep, tier: repTier(), faded: logs.some(m => /Word fades/.test(m)) };
    window.log = oldLog;
    return { at24, at25, clampHi, clampLo };
  });
  ok(b.at24.rep === 24 && b.at24.tier === 0 && b.at25.rep === 25 && b.at25.tier === 1 && b.at25.crossed,
    'rep 25 crosses to Known with a log line');
  ok(b.clampHi.rep === 100 && b.clampHi.tier === 3 && b.clampHi.beloved, 'clamps at 100 (Beloved logged)');
  ok(b.clampLo.rep === 0 && b.clampLo.tier === 0 && b.clampLo.faded, 'clamps at 0 with a fade log');

  // C. Known lifts panhandle odds — same roll, different outcome
  const c = await t(() => {
    G.weather = 'clear'; G.dog = 0;
    const oldR = Math.random;
    // 0.6 fails the stranger's .55 bar, passes the Known .55×1.15 = .6325 bar
    Math.random = () => 0.6;
    G.rep = 0; const gw0 = G.goodwill; const mo0 = G.morale;
    finishAction({ id: 'panhandle' });
    const strangerFailed = G.goodwill === gw0 && G.morale < mo0;
    G.rep = 30; const gw1 = G.goodwill;
    finishAction({ id: 'panhandle' });
    const knownRep = G.rep;
    Math.random = oldR;
    return { strangerFailed, knownPaid: G.goodwill > gw1, knownRep };
  });
  ok(c.strangerFailed, 'a stranger is ignored on the 0.6 roll (morale dips)');
  ok(c.knownPaid && c.knownRep === 31, 'the same roll pays once Known — and success is +1 rep');

  // D. Respected halves complaint calls
  const d = await t(() => {
    const oldR = Math.random;
    G.days = 10; G.workers.lookout = true; G.sweepWarned = false;
    const mk = q => { let i = 0; return () => (i < q.length ? q[i++] : 0.99); };
    // gate 0.5 passes (<=.55 keeps going), sweep roll 0.15: < .18 for a
    // stranger → warning; NOT < .18×.67=.1206 for Respected → passed by
    G.rep = 0;
    Math.random = mk([0.5, 0.15]);
    maybeEvent();
    const strangerWarned = G.sweepWarned;
    G.sweepWarned = false; showSweepWarning(false);
    G.rep = 50;
    Math.random = mk([0.5, 0.15]);
    maybeEvent();
    const respectedWarned = G.sweepWarned;
    Math.random = oldR;
    G.sweepWarned = false; showSweepWarning(false);
    const ev = document.getElementById('event-overlay'); if (ev) ev.style.display = 'none';
    return { strangerWarned, respectedWarned };
  });
  ok(d.strangerWarned && !d.respectedWarned, 'the 0.15 sweep roll warns a stranger, passes Respected by');

  // E. a friend who vouches
  const e = await t(() => {
    G.rep = 10; G.regulars.dee = 4;   // one bump from friendship (stage 2 at 5)
    bumpRegular('dee');
    return { rep: G.rep, stage: regularStage('dee') };
  });
  ok(e.stage === 2 && e.rep === 15, 'Dee reaching friendship vouches for you (+5 rep)');

  // F. Beloved dawns — decay then one gift a day
  const f = await t(() => {
    const oldR = Math.random;
    G.rep = 76; G.repGiftDay = -1; G.days = 12;
    const food0 = G.food;
    // gift roll 0.1 < .2 hits; branch roll 0.4 < .5 → the covered plate
    let q = [0.1, 0.4, 0.5]; Math.random = () => (q.length ? q.shift() : 0.5);
    repAtDawn();
    const gifted = { rep: G.rep, food: G.food - food0, day: G.repGiftDay };
    q = [0.1, 0.4, 0.5];
    repAtDawn();   // same day again — decay only, no second plate
    const second = { rep: G.rep, food: G.food - food0 };
    Math.random = oldR;
    return { gifted, second };
  });
  ok(f.gifted.rep === 75 && f.gifted.food >= 1 && f.gifted.day === 12,
    `a Beloved dawn decays 76→75 and leaves a plate (+${f.gifted.food} food)`);
  ok(f.second.rep === 74 && f.second.food === f.gifted.food, 'no second gift the same day');

  // G. goal + persistence + legacy migration
  const g1 = await t(() => {
    G.rep = 42; saveGame();
    return { goal: GOALS.some(g => g.id === 'respected' && g.target === 50) };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const g2 = await t(() => { updateHUD(); return { rep: G.rep, pill: document.getElementById('rep-name').textContent }; });
  await t(() => { const s = JSON.parse(localStorage.getItem('homeless_village_v1')); delete s.rep; delete s.repGiftDay; localStorage.setItem('homeless_village_v1', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const g3 = await t(() => ({ rep: G.rep, giftDay: G.repGiftDay }));
  ok(g1.goal, 'the Respected goal is on the ladder');
  ok(g2.rep === 42 && /Known · 42/.test(g2.pill), `rep rides the save (${g2.pill})`);
  ok(g3.rep === 0 && g3.giftDay === -1, 'a pre-HV-9 save migrates to 0 rep');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

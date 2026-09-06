/* HV-57 — the Bridge-chain refills at dawn, and not on a reload.
 *
 * The fourteen linked payouts under the bridge (the Old Thermos through
 * the Dry Corner) each gated on a bare `var x=false` in config.js. Two
 * things followed, both player-facing:
 *   - A dawn never cleared them. Every refusal line promised "it refills
 *     tomorrow" / "already came by today"; the tab could run ten in-game
 *     days and the thermos stayed used. Each link needs three tallies to
 *     open the next, so the chain could not be walked in one sitting.
 *   - A reload cleared all fourteen at once, while food, morale and the
 *     per-link tallies stayed persisted. F5 was a free replay of every
 *     payout on the wall, up to +17 food for the dry corner.
 * The latch now lives in G.linkDays[actionId] as the day it last paid,
 * like muralDay / buskDay / depositDay — onNewDay's G.days++ is the reset.
 *
 *  A. Source guard: no bare boolean latch is declared any more, and all
 *     fourteen branches in finishAction gate through linkDoneToday /
 *     markLinkDone.
 *  B. A fresh camp boots with an empty G.linkDays.
 *  C. The thermos pays once, refuses the same day — then a REAL dawn
 *     (tickDay → onNewDay) clears it and it pays again.
 *  D. The latch rides the save: after a reload the thermos still refuses
 *     today, the tally is unchanged, and the refusal names tomorrow.
 *  E. Every one of the fourteen links: pays, refuses, pays again after a
 *     dawn — and none of them leaks into another's latch.
 *  F. Migration: a save from before HV-57 (no key) and damaged shapes
 *     (a string, an array) boot to {} without throwing.
 *  Z. Zero page errors.
 *
 * Classic-script page: finishAction, tickDay and G are globals, so no
 * window.__ hook is needed.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const LINKS = ['thermos', 'marisol', 'reunion', 'snapshot', 'anniv', 'guestbook', 'bench',
  'story', 'ballad', 'can', 'fifth', 'walk', 'mark', 'dry'];
const OLD_FLAGS = ['thermosUsed', 'marisolCame', 'bridgeReunionHeld', 'snapshotLooked',
  'annivMarked', 'notebookLeafed', 'benchSat', 'hvStoryTold', 'balladPlayed', 'canDug',
  'panelStood', 'walkGiven', 'markAdded', 'drySat'];

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));

  // ---- A. source guard ----
  const cfg = await (await page.request.get(BASE + '/homeless-village/js/config.js')).text();
  const ply = await (await page.request.get(BASE + '/homeless-village/js/player.js')).text();
  const bare = OLD_FLAGS.filter(f => new RegExp('\\bvar\\s+' + f + '\\s*=').test(cfg));
  ok(bare.length === 0,
    `config.js declares no bare boolean latch for the chain${bare.length ? ' — still has ' + bare.join(', ') : ''}`);
  const gates = (ply.match(/else if\(linkDoneToday\(a\.id\)\)/g) || []).length;
  const marks = (ply.match(/markLinkDone\(a\.id\);/g) || []).length;
  ok(gates === LINKS.length && marks === LINKS.length,
    `all ${LINKS.length} finishAction branches gate on linkDoneToday and mark with markLinkDone (${gates} gates, ${marks} marks)`);
  const stale = OLD_FLAGS.filter(f => new RegExp('\\b' + f + '\\b').test(ply));
  ok(stale.length === 0,
    `player.js no longer reads any of the old flags${stale.length ? ' — ' + stale.join(', ') : ''}`);

  // ---- B. fresh boot ----
  await page.addInitScript(() => {
    // First load only: a genuinely fresh camp. The reloads below must see
    // what the earlier passes wrote. The crash course is marked seen so
    // tickDay is free to run the clock in C.
    if (!sessionStorage.getItem('hvrefill-init')) {
      sessionStorage.setItem('hvrefill-init', '1');
      Object.keys(localStorage).filter(k => k === 'homeless_village_v1' || k.startsWith('hv-'))
        .forEach(k => localStorage.removeItem(k));
    }
    localStorage.setItem('hv-intro-seen', '1');
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const fresh = await t(() => ({
    shape: Object.prototype.toString.call(G.linkDays), n: Object.keys(G.linkDays || {}).length,
    helpers: typeof linkDoneToday === 'function' && typeof markLinkDone === 'function',
    none: ['thermos', 'dry'].every(id => !linkDoneToday(id)),
  }));
  ok(fresh.shape === '[object Object]' && fresh.n === 0 && fresh.helpers && fresh.none,
    'a fresh camp boots with G.linkDays = {} and nothing done today');

  // ---- C. the thermos, and a real dawn ----
  const day = await t(() => {
    saveHvRec({ days: 14, beats: 4 });     // warms the thermos (and Marisol's story)
    saveHvNote({ read: 2 });
    saveThermos({ uses: 0 });
    G.food = 50; G.warmth = 80; G.health = 100; G.morale = 50;
    finishAction({ id: 'thermos' });
    const one = { uses: loadThermos().uses, done: linkDoneToday('thermos'), day: G.linkDays.thermos };
    finishAction({ id: 'thermos' });
    const two = { uses: loadThermos().uses };
    // Park the sun a second before dawn and let the real clock land it.
    const d0 = G.days;
    G.timeOfDay = 0.9999;
    tickDay(1000);
    const dawn = { d0, d1: G.days, done: linkDoneToday('thermos') };
    finishAction({ id: 'thermos' });
    return { one, two, dawn, three: loadThermos().uses };
  });
  ok(day.one.uses === 1 && day.one.done && day.one.day === day.dawn.d0,
    `the thermos pays once and stamps today (day ${day.dawn.d0}) in G.linkDays`);
  ok(day.two.uses === 1, 'the same day refuses a second pass');
  ok(day.dawn.d1 === day.dawn.d0 + 1 && !day.dawn.done,
    `a real dawn through tickDay → onNewDay (day ${day.dawn.d0} → ${day.dawn.d1}) clears the latch`);
  ok(day.three === 2, 'and tomorrow the thermos pays again — "it refills tomorrow" is now true');

  // ---- D. the latch rides the save ----
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => {
    const before = loadThermos().uses;
    const done = linkDoneToday('thermos');
    finishAction({ id: 'thermos' });
    const lines = Array.from(document.querySelectorAll('#log-feed .log-line')).map(l => l.textContent);
    return { before, done, after: loadThermos().uses, last: lines[lines.length - 1] || '' };
  });
  ok(back.done && back.before === 2 && back.after === 2,
    'after a reload the thermos is still used today — no free replay from an F5');
  ok(/refills tomorrow/.test(back.last),
    `and the refusal names tomorrow (${back.last.trim()})`);

  // ---- E. all fourteen links ----
  const all = await t((ids) => {
    // Open every gate on the wall at once; each one reads the tally of the
    // link before it, and the payouts below only move those tallies up.
    saveHvRec({ days: 14, beats: 4 }); saveHvNote({ read: 2 });
    saveHvStar({ cheers: 3 }); saveMarisol({ visits: 3 });
    saveHvReunion({ held: 3 }); saveHvSnap({ looks: 3 }); saveHvAnniv({ toasts: 3 });
    saveHvGb({ leafs: 3 }); saveHvBench({ sits: 3 }); saveHvStory({ tellings: 3 });
    saveHvSong({ plays: 3 }); saveHvCan({ digs: 3 }); saveHvPanel({ stands: 3 });
    saveHvWalk({ walks: 3 }); saveHvMark({ names: 3 }); saveHvDry({ built: true, sits: 3 });
    const tally = {
      thermos: () => loadThermos().uses, marisol: () => loadMarisol().visits,
      reunion: () => loadHvReunion().held, snapshot: () => loadHvSnap().looks,
      anniv: () => loadHvAnniv().toasts, guestbook: () => loadHvGb().leafs,
      bench: () => loadHvBench().sits, story: () => loadHvStory().tellings,
      ballad: () => loadHvSong().plays, can: () => loadHvCan().digs,
      fifth: () => loadHvPanel().stands, walk: () => loadHvWalk().walks,
      mark: () => loadHvMark().names, dry: () => loadHvDry().sits,
    };
    G.linkDays = {};
    G.food = 50; G.morale = 50; G.scraps = 40; G.cardboard = 40;
    const out = {};
    ids.forEach(id => {
      const t0 = tally[id]();
      finishAction({ id }); const t1 = tally[id]();
      finishAction({ id }); const t2 = tally[id]();
      out[id] = { t0, t1, t2, stamped: G.linkDays[id] === G.days };
    });
    const stamped = Object.keys(G.linkDays).length;
    G.days += 1;
    ids.forEach(id => { const b = tally[id](); finishAction({ id }); out[id].t3 = tally[id](); out[id].b3 = b; });
    return { out, stamped };
  }, LINKS);
  LINKS.forEach(id => {
    const r = all.out[id];
    ok(r.t1 === r.t0 + 1 && r.t2 === r.t1 && r.stamped && r.t3 === r.b3 + 1,
      `${id}: pays once (${r.t0}→${r.t1}), refuses today (${r.t2}), pays again after a dawn (${r.b3}→${r.t3})`);
  });
  ok(all.stamped === LINKS.length,
    `each link stamps only its own key — ${all.stamped} of ${LINKS.length} after one pass down the wall`);

  // ---- F. migration ----
  const boots = [];
  for (const shape of [undefined, '"x"', '[]']) {
    await page.evaluate((sh) => {
      const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
      if (sh === undefined) delete s.linkDays; else s.linkDays = JSON.parse(sh);
      localStorage.setItem('homeless_village_v1', JSON.stringify(s));
    }, shape);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(3000);
    boots.push(await t(() => {
      let threw = null;
      try { finishAction({ id: 'thermos' }); finishAction({ id: 'dry' }); } catch (e) { threw = String(e); }
      return { shape: Object.prototype.toString.call(G.linkDays), threw, days: G.days };
    }));
  }
  ok(boots.every(b => b.shape === '[object Object]' && b.threw === null),
    `a pre-HV-57 save and damaged shapes (a string, an array) all boot to {} and act without throwing (${boots.map(b => b.shape).join(', ')})`);
  ok(boots.every(b => typeof b.days === 'number' && b.days >= 1),
    'and the rest of the save came through the migration intact');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

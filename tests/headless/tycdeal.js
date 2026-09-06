/* TYC-60 — the deal-value multiplier is derived, not overwritten.
 *
 * Startup Tycoon's dealValueMult folds together three things that are
 * owned in three places: the prestige multiplier (2× per IPO), the
 * Enterprise Tier upgrade (×3 / ×8 / ×20) and the temporary boosts
 * (Demo Day ×3, the Award ×4, a Corp Dev greeting ×1.5). Until this
 * ticket every owner *assigned* the variable — `= prestige`,
 * `= prestige × tier`, `*= 3` then `= max(1, ÷3)`, save-then-restore —
 * and whichever ran last won:
 *
 *   • On every reload after the first IPO the save schema applied the
 *     Enterprise upgrade (with prestige still 1) and the prestige entry
 *     then wrote `dealValueMult = prestigeMultiplier` over it. A Season
 *     2 company with Enterprise Lv2 booted at $19 a ship instead of
 *     $154 — and the per-ship tooltip printed a "Penalty ×0.13" it had
 *     to invent to make the arithmetic close. The panel still showed
 *     the tier as owned. Buying the next tier repaired it; at Lv3 there
 *     was no repair until the next IPO.
 *   • Buying Enterprise while Demo Day was on screen: the purchase
 *     overwrote the ×3, and Demo Day's end divided the fresh tier by 3.
 *     $500 for nothing.
 *   • Corp Dev then Demo Day: the greeting's 60 s timer restored the
 *     value it had *saved* — Demo Day's ×3 — and left it there for the
 *     season.
 *
 * The fix makes dealValueMult a value recomputed from its parts, and
 * this suite keeps it that way in three layers:
 *
 *   A. Source: exactly one assignment to dealValueMult in play.html —
 *      the recompute — so the class of "one more writer" cannot creep
 *      back in.
 *   B. vm: the production event pool, investor table, Enterprise entry
 *      and recompute helpers are lifted out of play.html and replayed
 *      with the overlaps above. Non-vacuous: the pre-fix arithmetic is
 *      replayed on the same sequence and shown to lose the tier.
 *   C. DOM: real boots from seeded saves, reading the per-ship HUD
 *      (`#m-pership`, and its breakdown tooltip). No window.__ hook.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const SAVE_KEY = 'startup-tycoon-v7';   // VARIANT.saveKey — see saves.js for why this is read, not guessed
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const source = fs.readFileSync(path.join(__dirname, '../../tycoon/play.html'), 'utf8');

// ── A. one writer ──────────────────────────────────────────
{
  const writes = source.match(/\bdealValueMult\s*[-+*/]?=(?!=)/g) || [];
  ok(writes.length === 2,
    `dealValueMult has exactly one assignment beyond its declaration (found ${writes.length} — ` +
    'every owner must go through recomputeDealValueMult / addDealBoost / removeDealBoost)');
  ok(/function recomputeDealValueMult\(\)/.test(source) && /function addDealBoost\(/.test(source)
     && /function removeDealBoost\(/.test(source),
    'the recompute and boost helpers exist');
  ok(!/\[1,3,8,20\]\[/.test(source),
    'the Enterprise multiplier table is not duplicated inline (ENT_DEAL_MULTS is the one copy)');
}

// ── B. vm replay of the production pieces ────────────────────
function slice(startMarker, endMarker, label) {
  const s = source.indexOf(startMarker);
  const e = s >= 0 ? source.indexOf(endMarker, s) : -1;
  ok(s >= 0 && e > s, `found ${label} in play.html`);
  return s >= 0 && e > s ? source.slice(s, e + endMarker.length) : '';
}
const helpers   = slice('const ENT_DEAL_MULTS = [', 'function upgCost(u) {', 'the TYC-60 helpers')
  .replace(/function upgCost\(u\) \{$/, '');
const upgrades  = slice('const UPGRADES = [', '\n];', 'the UPGRADES table');
const events    = slice('const EVENT_POOL = [', '\n];', 'the EVENT_POOL table');
const investors = slice('const INVESTOR_TYPES = [', '\n];', 'the INVESTOR_TYPES table');

// Everything the lifted tables reach for, stubbed. Timers are captured
// so a scenario can fire them in the order the clock would.
const PRELUDE = `
  let dealValueMult = 1, prestigeMultiplier = 1, ideaSpeedMult = 1, dealSpeedMult = 1,
      playerSpeed = 1, featurePrice = 8, sessionGen = 0;
  const upgLevels = { enterprise: 0 };
  const CONFIG = { playerBaseSpeed: 1, playerSpeedPerLevel: 0.1 };
  const state = { cash: 0, allTimeCash: 0 };
  const ideaWorkers = [];
  const timers = [];
  function setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; }
  function fireTimers() { const t = timers.splice(0); for (const x of t) x.fn(); }
  const noop = () => {};
  const changeMorale = noop, showToast = noop, addCash = noop, addFeedEntry = noop, popCashAt = noop;
  const fmtCash = n => String(n);
`;
function scenario(body) {
  const ctx = vm.createContext({});
  vm.runInContext(PRELUDE + helpers + upgrades + events + investors, ctx);
  return vm.runInContext(body, ctx);
}
const withFix = `
  const demo  = EVENT_POOL.find(e => e.id === 'demo');
  const award = EVENT_POOL.find(e => e.id === 'award');
  const corp  = INVESTOR_TYPES.find(t => t.id === 'corpdev');
  const ent   = UPGRADES.find(u => u.id === 'enterprise');
  const buyEnterprise = () => { upgLevels.enterprise++; ent.apply(upgLevels.enterprise); };
`;

if (helpers && upgrades && events && investors) {
  // Sanity: the lifted pieces are the real ones.
  ok(scenario(withFix + 'recomputeDealValueMult()') === 1, 'a fresh company computes ×1');

  // Demo Day, buy Enterprise Lv1 during it, Demo Day ends → the tier stays.
  const r1 = scenario(withFix + `
    demo.onStart(); const during = dealValueMult;
    buyEnterprise(); const bought = dealValueMult;
    demo.onEnd();
    ({ during, bought, after: dealValueMult });`);
  ok(r1.during === 3 && r1.bought === 9 && r1.after === 3,
    `Enterprise bought during Demo Day survives its end (×3 → ×9 → ×3; got ${r1.during}/${r1.bought}/${r1.after})`);

  // Corp Dev, then Demo Day starts and ends, then the 60 s timer fires → back to ×1, not stuck at ×3.
  const r2 = scenario(withFix + `
    corp.onGreet({ type: corp }); const greeted = dealValueMult;
    demo.onStart(); const both = dealValueMult;
    demo.onEnd(); const demoOver = dealValueMult;
    fireTimers();
    ({ greeted, both, demoOver, after: dealValueMult });`);
  ok(r2.greeted === 1.5 && r2.both === 4.5 && r2.demoOver === 1.5 && r2.after === 1,
    `Corp Dev overlapping Demo Day unwinds to ×1 (got ${r2.greeted}/${r2.both}/${r2.demoOver}/${r2.after})`);

  // Two Corp Dev greetings inside one window: the first timer must not cut the second short.
  const r3 = scenario(withFix + `
    corp.onGreet({ type: corp });
    corp.onGreet({ type: corp }); const stacked = dealValueMult;
    timers[0].fn(); const afterFirst = dealValueMult;
    timers[1].fn(); const afterSecond = dealValueMult;
    ({ stacked, afterFirst, afterSecond });`);
  ok(r3.stacked === 1.5 && r3.afterFirst === 1.5 && r3.afterSecond === 1,
    `a second Corp Dev replaces rather than stacks, and outlives the first's timer (got ${r3.stacked}/${r3.afterFirst}/${r3.afterSecond})`);

  // Season 3 (×4) with Enterprise Lv2 under the Award: 4 × 8 × 4, then 4 × 8.
  const r4 = scenario(withFix + `
    prestigeMultiplier = 4; upgLevels.enterprise = 2; recomputeDealValueMult();
    const base = dealValueMult;
    award.onStart(); const on = dealValueMult;
    award.onEnd();
    ({ base, on, off: dealValueMult });`);
  ok(r4.base === 32 && r4.on === 128 && r4.off === 32,
    `the Award multiplies the whole permanent product and hands it back (got ${r4.base}/${r4.on}/${r4.off})`);

  // Order independence — the reload bug in miniature: apply the tier with
  // prestige still 1, then learn the prestige, and the answer is the same
  // as the other way round.
  const r5 = scenario(withFix + `
    upgLevels.enterprise = 2; ent.apply(2);            // schema 'upgrades' entry, prestige unknown yet
    prestigeMultiplier = 2; recomputeDealValueMult(); // schema 'prestige' entry
    const upgradesFirst = dealValueMult;
    prestigeMultiplier = 2; recomputeDealValueMult(); upgLevels.enterprise = 2; ent.apply(2);
    ({ upgradesFirst, prestigeFirst: dealValueMult });`);
  ok(r5.upgradesFirst === 16 && r5.prestigeFirst === 16,
    `prestige and Enterprise compose the same in either order (got ${r5.upgradesFirst}/${r5.prestigeFirst})`);

  // Corrupt prestige in the save cannot zero or NaN the deal value.
  const r6 = scenario(withFix + `
    upgLevels.enterprise = 1;
    const out = [];
    for (const bad of [0, -2, NaN, Infinity, 'x', null, undefined]) { prestigeMultiplier = bad; out.push(recomputeDealValueMult()); }
    out;`);
  ok(r6.every(v => v === 3), `a corrupt prestigeMultiplier falls back to ×1 under the tier (got ${r6.join(',')})`);

  // Non-vacuous: the pre-fix arithmetic on the Demo Day sequence loses the tier.
  const OLD = `
    let dealValueMult = 1, prestigeMultiplier = 1;
    dealValueMult *= 3;                                   // Demo Day onStart
    dealValueMult = prestigeMultiplier * [1,3,8,20][1];   // Enterprise Lv1 apply
    dealValueMult = Math.max(1, dealValueMult / 3);       // Demo Day onEnd
    dealValueMult;`;
  ok(vm.runInContext(OLD, vm.createContext({})) === 1,
    'the pre-fix arithmetic on the same sequence ends at ×1 — the tier was lost (old shape, replayed)');
}

// ── C. real boots ────────────────────────────────────────────
async function boot(browser, save, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
  // Seed once per context: addInitScript re-runs on reload, and a reload
  // is exactly what the live-purchase row is testing.
  await page.addInitScript(([k, v, w]) => {
    if (sessionStorage.getItem('tycdeal-seeded')) return;
    sessionStorage.setItem('tycdeal-seeded', '1');
    try { localStorage.setItem(k, v); localStorage.setItem(w, '1'); } catch (e) {}
    window.__sawKey = false;
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = function (n) { if (n === k) window.__sawKey = true; return orig.call(this, n); };
  }, [SAVE_KEY, JSON.stringify(save), 'tycoon:welcomeSeen-v1']);
  await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(opts.settle || 1200);
  const read = () => page.evaluate(() => ({
    per: document.getElementById('m-pership').textContent,
    tip: document.getElementById('m-pership-row').title,
    ent: document.querySelector('[data-id="enterprise"]').textContent,
    read: !!window.__sawKey,
  }));
  return { page, ctx, errs, read };
}

// Season N: prestigeLevel N-1, prestigeMultiplier 2^(N-1), legacy 1 + 0.2·(N-1). Base feature price $8.
const S2 = { v: 7, allTimeCash: 50, prestigeLevel: 1, prestigeMultiplier: 2 };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // 1. The headline: Season 2 + Enterprise Lv2 boots at 8 × 2 × 1.2 × 8 = $153.6.
  {
    const b = await boot(browser, { ...S2, cash: 0, upgrades: { enterprise: 2 } });
    const st = await b.read();
    ok(st.read, 'the game read the seeded save');
    ok(st.per === '$154', `Season 2 with Enterprise Lv2 boots at $154 per ship (got ${st.per})`);
    ok(/Enterprise Lv2 ×8/.test(st.tip) && !/Penalty/.test(st.tip),
      `the per-ship breakdown cites the tier and no longer invents a Penalty (${st.tip})`);
    ok(b.errs.length === 0, `no page errors on boot${b.errs.length ? ' — ' + b.errs[0] : ''}`);
    await b.ctx.close();
  }

  // 2. Control: Season 1 never hit the ordering bug — it must not move.
  {
    const b = await boot(browser, { v: 7, cash: 0, allTimeCash: 50, upgrades: { enterprise: 1 }, prestigeLevel: 0, prestigeMultiplier: 1 });
    const st = await b.read();
    ok(st.per === '$24', `Season 1 with Enterprise Lv1 still boots at $24 per ship (got ${st.per})`);
    await b.ctx.close();
  }

  // 3. The player's path: buy the tier in Season 2, let the 5 s autosave run, reload.
  {
    const b = await boot(browser, { ...S2, cash: 100000, upgrades: {} });
    const before = (await b.read()).per;
    await b.page.click('[data-id="enterprise"]');
    await b.page.waitForTimeout(300);
    const after = (await b.read()).per;
    ok(before === '$19' && after === '$58', `buying Enterprise Lv1 in Season 2 moves $19 → $58 per ship (got ${before} → ${after})`);
    await b.page.waitForTimeout(5500);
    await b.page.reload({ waitUntil: 'load' });
    await b.page.waitForTimeout(1200);
    const st = await b.read();
    ok(/Lv 1\/3/.test(st.ent), `the purchase is in the save (${st.ent.slice(0, 20)})`);
    ok(st.per === '$58', `and it is still worth $58 per ship after the reload (got ${st.per})`);
    ok(b.errs.length === 0, `no page errors across the purchase and reload${b.errs.length ? ' — ' + b.errs[0] : ''}`);
    await b.ctx.close();
  }

  // 4. A save with a corrupt prestige multiplier still pays something per ship.
  {
    const b = await boot(browser, { ...S2, cash: 0, prestigeMultiplier: 0, upgrades: { enterprise: 1 } });
    const st = await b.read();
    const n = Number(st.per.replace(/[$,k]/g, ''));
    ok(n > 0, `prestigeMultiplier:0 in the save does not zero the per-ship value (got ${st.per})`);
    ok(b.errs.length === 0, 'and boots clean');
    await b.ctx.close();
  }

  await browser.close();
  ok(pass >= 20, 'suite is populated across the source, vm and DOM layers');
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

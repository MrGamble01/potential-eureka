/* TYC-61 — the engineer-speed multiplier is derived, not overwritten.
 *
 * ideaSpeedMult is the factor every engineer's work rate is multiplied
 * by. It folds together five ideation upgrades (Faster Ideation, Deep
 * Focus, Brainstorm Sessions, AI Copilot, Cloud Compute), the Standup
 * amenity, and three temporary boosts (the Hackathon event, the post-
 * outage burst, the Pivot). Until this ticket every owner assigned the
 * variable — twelve writers — and whichever ran last won:
 *
 *   • The Hackathon event set it to 3 on start and to 1 on end. A floor
 *     running at ×5 (Faster Ideation Lv4, two Deep Focus, Copilot, the
 *     Standup) came out of a 40-second event at ×1 and stayed there
 *     until the next reload. Every ideation upgrade paid for, erased by
 *     a random event that fires every two to three minutes.
 *   • Faster Ideation assigned `1 + lv × 0.25`. Buy AI Copilot first
 *     (×1.5) and then Faster Ideation Lv1: ×1.25, not ×1.875 — the
 *     purchase order decided what you kept, and a reload (which applies
 *     upgrades in table order) quietly changed the answer again.
 *   • The Outage burst and the Pivot each saved the value and restored
 *     it later; overlapping, the later one restored the earlier one's
 *     premium as the new baseline.
 *
 * The fix derives ideaSpeedMult from its parts in the order the save
 * loader always applied them — so a reload changes nothing — and this
 * suite keeps it that way in three layers, no window.__ hook:
 *
 *   A. Source: exactly one assignment in play.html — the recompute.
 *   B. vm: the production UPGRADES and EVENT_POOL tables and the helpers
 *      are lifted out and replayed with the overlaps above; the pre-fix
 *      Hackathon arithmetic is replayed on the same stack to show it
 *      ends at ×1.
 *   C. DOM: real boots. The multiplier is not on screen anywhere, but the
 *      save's `offlineRatePerSec` is written from it every 5 s — one
 *      engineer in Season 1 is 0.032 × speed × $8 — so the seeded boots
 *      and the live purchase-order case read it back from localStorage.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const SAVE_KEY = 'startup-tycoon-v7';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

const source = fs.readFileSync(path.join(__dirname, '../../tycoon/play.html'), 'utf8');

// ── A. one writer ──────────────────────────────────────────
{
  const writes = source.match(/\bideaSpeedMult\s*[-+*/]?=(?!=)/g) || [];
  ok(writes.length === 2,
    `ideaSpeedMult has exactly one assignment beyond its declaration (found ${writes.length} — ` +
    'every owner must go through recomputeIdeaSpeedMult / addIdeaBoost / removeIdeaBoost)');
  ok(/function recomputeIdeaSpeedMult\(\)/.test(source) && /function addIdeaBoost\(/.test(source)
     && /function removeIdeaBoost\(/.test(source),
    'the recompute and boost helpers exist');
}

// ── B. vm replay ───────────────────────────────────────────
function slice(startMarker, endMarker, label) {
  const s = source.indexOf(startMarker);
  const e = s >= 0 ? source.indexOf(endMarker, s) : -1;
  ok(s >= 0 && e > s, `found ${label} in play.html`);
  return s >= 0 && e > s ? source.slice(s, e + endMarker.length) : '';
}
const helpers  = slice('const IDEA_STACK_CAP = ', '\nfunction buyUpgrade(id) {', 'the TYC-61 helpers')
  .replace(/\nfunction buyUpgrade\(id\) \{$/, '');
const upgrades = slice('const UPGRADES = [', '\n];', 'the UPGRADES table');
const events   = slice('const EVENT_POOL = [', '\n];', 'the EVENT_POOL table');

const PRELUDE = `
  let ideaSpeedMult = 1, dealValueMult = 1, prestigeMultiplier = 1, dealSpeedMult = 1,
      playerSpeed = 1, featurePrice = 8, sessionGen = 0;
  const upgLevels = { growth: 0, farmexp: 0, dev: 0, aicopilot: 0, cdnspeed: 0, speed: 0, marketing: 0, pricing: 0, enterprise: 0 };
  const amenities = [{ id: 'standup', isOwned: false }, { id: 'coffee', isOwned: true }];
  const CONFIG = { playerBaseSpeed: 1, playerSpeedPerLevel: 0.1 };
  const state = { cash: 0, allTimeCash: 0 };
  const ideaWorkers = [];
  const timers = [];
  function setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; }
  const noop = () => {};
  const changeMorale = noop, showToast = noop, addCash = noop, addFeedEntry = noop;
  const fmtCash = n => String(n);
  function recomputeDealValueMult() {}
`;
function scenario(body) {
  const ctx = vm.createContext({});
  vm.runInContext(PRELUDE + helpers + upgrades + events, ctx);
  return vm.runInContext(body, ctx);
}
const withFix = `
  const buy = id => { const u = UPGRADES.find(x => x.id === id); upgLevels[id]++; u.apply(upgLevels[id]); };
  const hack   = EVENT_POOL.find(e => e.id === 'hackathon');
  const outage = EVENT_POOL.find(e => e.id === 'outage');
  const pivot  = EVENT_POOL.find(e => e.id === 'pivot');
`;

if (helpers && upgrades && events) {
  ok(scenario(withFix + 'recomputeIdeaSpeedMult()') === 1, 'a fresh company computes ×1');

  // The stack the loader has always produced: growth 4 → 2.0, +0.3 +0.3 → 2.6, ×1.5 → 3.9, Standup ×1.3 → 5.07.
  const r1 = scenario(withFix + `
    buy('growth'); buy('growth'); buy('growth'); buy('growth');
    buy('farmexp'); buy('farmexp'); buy('aicopilot');
    amenities[0].isOwned = true; recomputeIdeaSpeedMult();
    ideaSpeedMult;`);
  ok(near(r1, 5.07), `a full stack composes to ×5.07 in table order (got ${r1})`);

  // Purchase order no longer matters: Copilot first, then Faster Ideation.
  const r2 = scenario(withFix + `
    buy('aicopilot'); const afterCopilot = ideaSpeedMult;
    buy('growth');
    ({ afterCopilot, after: ideaSpeedMult });`);
  ok(near(r2.afterCopilot, 1.5) && near(r2.after, 1.875),
    `Copilot then Faster Ideation keeps the Copilot (×1.5 → ×1.875; got ${r2.afterCopilot} → ${r2.after})`);

  // The headline: the Hackathon event hands the stack back when it ends.
  const r3 = scenario(withFix + `
    buy('growth'); buy('growth'); buy('growth'); buy('growth');
    buy('farmexp'); buy('farmexp'); buy('aicopilot');
    amenities[0].isOwned = true; recomputeIdeaSpeedMult();
    const before = ideaSpeedMult;
    hack.onStart(); const during = ideaSpeedMult;
    hack.onEnd();
    ({ before, during, after: ideaSpeedMult });`);
  ok(near(r3.before, 5.07) && near(r3.during, 15.21) && near(r3.after, 5.07),
    `the Hackathon event triples the stack and hands it back (×5.07 → ×15.21 → ×5.07; got ${r3.before}/${r3.during}/${r3.after})`);

  // Outage burst under a Pivot: both unwind to the stack, in either order.
  const r4 = scenario(withFix + `
    buy('growth'); buy('growth');            // ×1.5
    pivot.onStart(); const p = ideaSpeedMult;        // ×3
    outage.onEnd();  const po = ideaSpeedMult;       // ×9
    timers[0].fn();  const o = ideaSpeedMult;        // pivot expires → ×4.5
    timers[1].fn();
    ({ p, po, o, after: ideaSpeedMult });`);
  ok(near(r4.p, 3) && near(r4.po, 9) && near(r4.o, 4.5) && near(r4.after, 1.5),
    `a Pivot and an Outage burst overlap and unwind cleanly (got ${r4.p}/${r4.po}/${r4.o}/${r4.after})`);

  // A second Pivot inside the first's window: the first timer must not cut it short.
  const r5 = scenario(withFix + `
    pivot.onStart(); pivot.onStart(); const stacked = ideaSpeedMult;
    timers[0].fn(); const afterFirst = ideaSpeedMult;
    timers[1].fn(); ({ stacked, afterFirst, afterSecond: ideaSpeedMult });`);
  ok(near(r5.stacked, 2) && near(r5.afterFirst, 2) && near(r5.afterSecond, 1),
    `a second Pivot replaces rather than stacks, and outlives the first's timer (got ${r5.stacked}/${r5.afterFirst}/${r5.afterSecond})`);

  // The cap is on the permanent stack, in the loader's order.
  const r6 = scenario(withFix + `
    for (let i = 0; i < 10; i++) buy('growth');   // 3.5
    buy('farmexp'); buy('farmexp');               // 4.1
    for (let i = 0; i < 10; i++) buy('dev');      // 5.6
    buy('aicopilot'); buy('aicopilot'); buy('aicopilot'); // 8 (capped)
    buy('cdnspeed');                              // 8
    ideaSpeedMult;`);
  ok(near(r6, 8), `a maxed stack caps at ×8 (got ${r6})`);

  // Garbage levels cannot NaN the floor.
  const r7 = scenario(withFix + `
    upgLevels.growth = 'x'; upgLevels.dev = NaN; upgLevels.aicopilot = -3;
    recomputeIdeaSpeedMult();`);
  ok(r7 === 1, `corrupt upgrade levels fall back to ×1 (got ${r7})`);

  // Non-vacuous: the pre-fix Hackathon on the same stack ends at ×1.
  const OLD = `
    let ideaSpeedMult = 1;
    ideaSpeedMult = 1 + 4 * 0.25;                  // Faster Ideation Lv4
    ideaSpeedMult = Math.min(ideaSpeedMult + 0.3, 8); ideaSpeedMult = Math.min(ideaSpeedMult + 0.3, 8);
    ideaSpeedMult = Math.min(ideaSpeedMult * 1.5, 8);
    ideaSpeedMult *= 1.3;                          // Standup
    const before = ideaSpeedMult;
    ideaSpeedMult = 3;                             // Hackathon onStart
    ideaSpeedMult = 1;                             // Hackathon onEnd
    ({ before, after: ideaSpeedMult });`;
  const old = vm.runInContext(OLD, vm.createContext({}));
  ok(near(old.before, 5.07) && old.after === 1,
    'the pre-fix Hackathon on the same ×5.07 stack ends at ×1 — every upgrade lost (old shape, replayed)');
  const OLD2 = `
    let ideaSpeedMult = 1;
    ideaSpeedMult = Math.min(ideaSpeedMult * 1.5, 8);   // Copilot first
    ideaSpeedMult = 1 + 1 * 0.25;                       // then Faster Ideation Lv1
    ideaSpeedMult;`;
  ok(vm.runInContext(OLD2, vm.createContext({})) === 1.25,
    'the pre-fix Faster Ideation after Copilot ends at ×1.25 — the Copilot lost (old shape, replayed)');
}

// ── C. real boots ────────────────────────────────────────────
// One engineer, Season 1, no revenue upgrades: dealVal = $8, so
// offlineRatePerSec = 0.032 × ideaSpeedMult × 8 = 0.256 × ideaSpeedMult.
const PER_UNIT = 0.032 * 8;
async function boot(browser, save) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
  await page.addInitScript(([k, v, w]) => {
    if (sessionStorage.getItem('tycspeed-seeded')) return;
    sessionStorage.setItem('tycspeed-seeded', '1');
    try { localStorage.setItem(k, v); localStorage.setItem(w, '1'); } catch (e) {}
  }, [SAVE_KEY, JSON.stringify(save), 'tycoon:welcomeSeen-v1']);
  await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  const speed = async () => {
    // The field is written by the 5 s autosave; poll for a fresh one
    // rather than guessing how long the boot took.
    const since = Date.now();
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);
      const v = await page.evaluate(([k, t]) => {
        try { const p = JSON.parse(localStorage.getItem(k)); return (p.savedAt >= t && typeof p.offlineRatePerSec === 'number') ? p.offlineRatePerSec : null; }
        catch (e) { return null; }
      }, [SAVE_KEY, since]);
      if (v !== null) return v / PER_UNIT;
    }
    return NaN;
  };
  return { page, ctx, errs, speed };
}

const BASE_SAVE = { v: 7, allTimeCash: 50, ideaWorkers: 1, prestigeLevel: 0, prestigeMultiplier: 1 };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // 1. A saved stack boots at the value the loader has always produced (the control).
  {
    const b = await boot(browser, { ...BASE_SAVE, cash: 0,
      upgrades: { growth: 4, farmexp: 2, aicopilot: 1 }, amenities: [{ id: 'standup', stock: 0 }] });
    const sp = await b.speed();
    ok(near(sp, 5.07, 0.02), `a saved Lv4 + 2×Focus + Copilot + Standup stack boots at ×5.07 (got ${sp.toFixed(3)})`);
    ok(b.errs.length === 0, `no page errors on boot${b.errs.length ? ' — ' + b.errs[0] : ''}`);
    await b.ctx.close();
  }

  // 2. The player's path: buy Copilot, then Faster Ideation, live. The Copilot must survive.
  {
    const b = await boot(browser, { ...BASE_SAVE, cash: 100000, upgrades: {} });
    // A first-run tip card (the desk ran out of paper) can sit over the
    // sidebar; Escape dismisses it the way a player would.
    await b.page.keyboard.press('Escape');
    await b.page.click('[data-id="aicopilot"]');
    await b.page.waitForTimeout(200);
    await b.page.keyboard.press('Escape');
    await b.page.click('[data-id="growth"]');
    const sp = await b.speed();
    ok(near(sp, 1.875, 0.02), `Copilot then Faster Ideation runs the floor at ×1.875 live (got ${sp.toFixed(3)})`);
    await b.page.reload({ waitUntil: 'load' });
    await b.page.waitForTimeout(1200);
    const sp2 = await b.speed();
    ok(near(sp2, 1.875, 0.02), `and a reload agrees (got ${sp2.toFixed(3)})`);
    ok(b.errs.length === 0, `no page errors across the purchases and reload${b.errs.length ? ' — ' + b.errs[0] : ''}`);
    await b.ctx.close();
  }

  await browser.close();
  ok(pass >= 18, 'suite is populated across the source, vm and DOM layers');
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

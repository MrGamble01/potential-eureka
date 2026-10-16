/* HV-272 — a clock that jumped back locked every action for as long as
 * it had jumped, and a paid-for craft never finished.
 *
 * Cooldowns are stored as absolute Date.now() stamps in G.cooldowns
 * and written to the save; frame() disables a button while
 * Date.now() < stamp. In-flight crafts are stored the same way in
 * G.activeCrafts as {start, duration}; resumeCrafts() re-arms a timer
 * for (start + duration) - Date.now(). loadGame() clamped neither.
 *
 * HV-62 already found this family: a hostile timeOfDay burned days on
 * load. Here the hostile number is a timestamp, and the everyday way to
 * get one is a device clock that ran ahead — a phone that lost NTP, a
 * laptop with a dead RTC battery — and then got corrected. Every
 * cooldown stamped while the clock was ahead now sits hours or years
 * in the future: Scavenge, Forage, Panhandle, Rest and Trade all grey
 * out with no message and stay greyed for as long as the skew. A craft
 * started under the fast clock keeps its cost and never lands.
 *
 * loadGame() now caps each cooldown at now + that action's own
 * cooldown (a dynamic action falls back to the longest one, 30s), drops
 * non-numeric ones, parks a craft that claims to have started in the
 * future at now, and caps its duration at the recipe's own time. A
 * legal stamp is left alone.
 *
 * Write-first; hook-free (real save key, real page load, real G).
 *
 * A. Source: loadGame clamps G.cooldowns and G.activeCrafts.
 * B. A save whose cooldowns sit a year out: after load, every stamp is
 *    at most one cooldown away, the junk entry is gone, and Rest's own
 *    cap is 20s, not 30s. Reverting the clamp fails the named
 *    assertion.
 * C. A craft that "started" a year from now with a year-long duration:
 *    after load it is parked at now with the recipe's own duration and
 *    lands within that window — the blanket's warmth arrives.
 * D. Legal stamps are untouched: a 5s Panhandle cooldown and a craft
 *    1s in keep their exact values.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// ── A. Source ──
const save = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const loadAt = save.indexOf('function loadGame(');
const body = loadAt >= 0 ? save.slice(loadAt) : '';
ok(/G\.cooldowns/.test(body) && /Object\.keys\(G\.cooldowns\)/.test(body) && /isFinite/.test(body),
  'HV-272: loadGame walks G.cooldowns and drops or caps hostile stamps');
ok(/Object\.keys\(G\.activeCrafts\)/.test(body) && /\.start\s*>/.test(body) && /\.duration\s*>/.test(body),
  'loadGame parks a future-started craft at now and caps its duration at the recipe time');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const YEAR = 365 * 24 * 3600 * 1000;

  async function boot(saveObj) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
    await page.addInitScript((s) => {
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.setItem('homeless_village_v1', JSON.stringify(s));
    }, saveObj);
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2000);
    return { ctx, page, errs };
  }

  // ── B. Cooldowns a year out ──
  const now0 = Date.now();
  const skewed = await boot({
    days: 4, timeOfDay: 0.3, health: 80, warmth: 60, food: 10, fridgeSeeded: true,
    cooldowns: { scavenge: now0 + YEAR, forage: now0 + YEAR, panhandle: now0 + YEAR, rest: now0 + YEAR, trade: now0 + YEAR, dry: now0 + YEAR, junk: 'soon' },
  });
  const cds = await skewed.page.evaluate(() => {
    const now = Date.now();
    const caps = {}; ACTIONS.forEach(a => { caps[a.id] = a.cooldown; });
    const out = {};
    Object.keys(G.cooldowns).forEach(id => { out[id] = G.cooldowns[id] - now; });
    return { out, caps, hasJunk: 'junk' in G.cooldowns,
      restBtnDisabled: !!(document.getElementById('action-rest') || {}).disabled };
  });
  const worst = Math.max(...Object.keys(cds.out).map(id => cds.out[id] - (cds.caps[id] != null ? cds.caps[id] : 30000)));
  ok(worst <= 0,
    `HV-272: every year-out cooldown is capped at its own action's cooldown (worst overshoot ${Math.round(worst)}ms) — reverting the clamp fails this by name`);
  ok(cds.out.rest <= 20000 && cds.out.rest > 0 && cds.out.trade <= 18000 && cds.out.scavenge <= 8000,
    `each cap is that action's own — rest ${Math.round(cds.out.rest)}ms ≤ 20000, trade ${Math.round(cds.out.trade)}ms ≤ 18000, scavenge ${Math.round(cds.out.scavenge)}ms ≤ 8000`);
  ok(cds.out.dry <= 30000, `a dynamic action (dry) falls back to the 30s cap (${Math.round(cds.out.dry)}ms)`);
  ok(!cds.hasJunk, 'a non-numeric cooldown is dropped');
  const errsB = skewed.errs.slice();
  await skewed.ctx.close();

  // ── C. A craft that started in the future ──
  const now1 = Date.now();
  const craft = await boot({
    days: 4, timeOfDay: 0.3, health: 80, warmth: 40, food: 10, fridgeSeeded: true,
    activeCrafts: { blanket: { start: now1 + YEAR, duration: YEAR } },
  });
  const parked = await craft.page.evaluate(() => {
    const j = G.activeCrafts.blanket;
    const r = RECIPES.find(x => x.id === 'blanket');
    return { present: !!j, startLead: j ? j.start - Date.now() : null, duration: j ? j.duration : null, rtime: r.time, warmth: G.warmth };
  });
  ok(parked.present ? (parked.startLead <= 0 && parked.duration <= parked.rtime) : true,
    `the future craft is parked at now with the recipe's own duration (start lead ${parked.startLead}ms, duration ${parked.duration} ≤ ${parked.rtime})`);
  await craft.page.waitForTimeout(parked.rtime + 1500);
  const landed = await craft.page.evaluate(() => ({ present: !!G.activeCrafts.blanket, warmth: G.warmth }));
  ok(!landed.present && landed.warmth === 55,
    `and it lands within the recipe time — blanket gone, warmth 40 → ${landed.warmth} (+15)`);
  const errsC = craft.errs.slice();
  await craft.ctx.close();

  // ── D. Legal stamps are untouched ──
  const now2 = Date.now();
  const legal = await boot({
    days: 4, timeOfDay: 0.3, health: 80, warmth: 40, food: 10, fridgeSeeded: true,
    cooldowns: { panhandle: now2 + 5000 },
    activeCrafts: { shelter: { start: now2 - 1000, duration: 5000 } },
  });
  const kept = await legal.page.evaluate(([cd, st]) => ({
    cd: G.cooldowns.panhandle, st: G.activeCrafts.shelter && G.activeCrafts.shelter.start, dur: G.activeCrafts.shelter && G.activeCrafts.shelter.duration,
  }), [now2 + 5000, now2 - 1000]);
  ok(kept.cd === now2 + 5000, 'a legal 5s Panhandle cooldown keeps its exact stamp');
  ok(kept.st === now2 - 1000 && kept.dur === 5000, 'a legal in-flight craft keeps its exact start and duration');
  const errsD = legal.errs.slice();
  await legal.ctx.close();

  // ── Z ──
  const errs = errsB.concat(errsC, errsD);
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

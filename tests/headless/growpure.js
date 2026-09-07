/* LAB-60 — the ✨ ledger and the raid.
 *
 * Grow Op tracks premium product as a COUNT inside the stash, not as a
 * separate pile: `pureBags` is "how many of these `stashCount` bags are
 * ✨". Every sale reads it that way — sellToDealer() takes
 * `pureUsed = min(pureBags, qty)` off the top at 1.6× list. So
 * `pureBags <= stashCount` is a load-bearing invariant, and the file
 * says so seven times over: every path that takes bags off the shelf
 * re-clamps the ledger behind itself ("LAB-10: the ✨ ledger can't
 * exceed what's left") — the burn-the-evidence event, the big order,
 * the getaway bag, the route van, the undercover seizure, the Whale.
 *
 * triggerRaid() did not. The DEA seizure is the largest single bag
 * remover in the game — 30% of the shelf — and it moved `stashCount`
 * without touching `pureBags`. A raided stash of 15 with 15 ✨ came out
 * as 11 bags carrying a 15-bag premium ledger, which the stash label
 * rendered literally: `📦 Stash [11 · 15✨]`. Nothing there was pure;
 * every ordinary bag left on the shelf sold at the ✨ premium until the
 * ledger drained. The tell that this was an oversight and not a rule:
 * reloading the page fixed it, because loadGame() clamps.
 *
 * Except loadGame() clamped early. It ran the LAB-10 clamp against the
 * SAVED bag count and only afterwards cut `stashCount` down to the
 * LAB-22 rented ceiling — so a save claiming more bags than its cap
 * allows (the shape tests/headless/saves.js exists to survive) booted
 * with more ✨ than stash. Same invariant, one layer up.
 *
 * A. Boot from a save inside the cap: the ledger is intact.
 * B. THE RAID: 30% of the bags go, and the ✨ ledger goes with them —
 *    never more ✨ than bags on the shelf.
 * C. A save claiming 40 bags with no unit rented lands at the cap of
 *    15, and the ledger lands with it.
 * D. Source guards: the raid clamps, the load clamps after the cap,
 *    and the sale path takes pure off the top so it cannot drift.
 * Z. Zero page errors.
 *
 * Behavioural where it can be: Grow Op's game script is
 * `<script type="module">`, so `stashCount`, `pureBags` and
 * `triggerRaid()` are module-scoped and unreachable from
 * page.evaluate — and reaching for them would mean bolting on a
 * `window.__` hook, which tests/headless/nohooks.js forbids. So the
 * raid is fired the way a player fires it: heat seeded at the raid
 * line with an empty wallet, so the bribe's paid branch disables
 * itself (LAB-3) and "Refuse. Let them come." is the only way out.
 * The assertion reads the stash label off the DOM — the same string
 * the player is looking at.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// A save shaped like the real one, trimmed to the fields these legs read.
const save = over => ({
  cash: 0, totalEarned: 5000, totalSold: 0,
  heat: over ? 20 : 96,
  upgrades: {}, ownedRooms: ['garage'],
  trimmers: 0, lookouts: 0, runners: 0, cooks: 0, batches: 0,
  goalIndex: 0, won: false,
  stashCount: over ? 40 : 15, pureBags: over ? 40 : 15,
  trimQueue: 0, trimBags: 0,
  chemQueue: 0, chemProduct: 0, chemProgress: 0, chemPure: 0,
  pCarrying: null, plots: [], savedAt: Date.now(),
  difficulty: 'careful', unitRented: false,
});

const stashLabel = page => page.evaluate(() =>
  ([...document.querySelectorAll('#labels > div')]
    .map(d => d.textContent).find(t => t && t.includes('Stash')) || ''));

// "📦 Stash [11 · 11✨]" → { bags: 11, pure: 11 }
function readLedger(text) {
  const m = /Stash \[(\d+)(?: · (\d+)✨)?\]/.exec(text || '');
  return m ? { bags: +m[1], pure: m[2] ? +m[2] : 0 } : null;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  async function boot(over) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await page.addInitScript(sv => {
      try { localStorage.setItem('drug-lab-v1', JSON.stringify(sv)); } catch (e) {}
    }, save(over));
    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    return { ctx, page };
  }

  // ---- A + B: the raid ------------------------------------------------
  {
    const { ctx, page } = await boot(false);

    const before = readLedger(await stashLabel(page));
    ok(before && before.bags === 15 && before.pure === 15,
      `a save inside the cap boots whole — 15 bags, 15 ✨ (${JSON.stringify(before)})`);

    const bribe = await page.evaluate(() => ({
      open: document.getElementById('event-modal').classList.contains('open'),
      title: document.getElementById('ev-title').textContent,
      choices: [...document.querySelectorAll('#ev-choices button')]
        .map(b => ({ text: b.textContent, disabled: b.disabled })),
    }));
    ok(bribe.open && /Blue Lights/.test(bribe.title) && bribe.choices.length === 2
       && bribe.choices[0].disabled,
      'heat at the raid line with an empty wallet: the bribe opens, the paid branch is dead');

    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#ev-choices button')].find(x => /Refuse/.test(x.textContent));
      if (b) b.click();
    });
    await page.waitForTimeout(800);

    const raided = await page.evaluate(() => ({
      label: ([...document.querySelectorAll('#labels > div')]
        .map(d => d.textContent).find(t => t && t.includes('Stash')) || ''),
      overlay: document.getElementById('raid-overlay').classList.contains('active'),
    }));
    const after = readLedger(raided.label);
    ok(raided.overlay, 'refusing the bribe brings the raid');
    // 30% of 15 = 4 seized, 11 left on the shelf.
    ok(after && after.bags === 11,
      `the raid takes 30% of the shelf — 15 → 11 bags (${JSON.stringify(after)})`);
    ok(after && after.pure === 11,
      `and the ✨ ledger comes down with it — 11 bags, 11 ✨ (was 15✨ over 11 bags) (${JSON.stringify(after)})`);
    ok(after && after.pure <= after.bags,
      'the invariant holds: never more ✨ than bags on the shelf');

    await ctx.close();
  }

  // ---- C: the over-cap save ------------------------------------------
  {
    const { ctx, page } = await boot(true);
    const led = readLedger(await stashLabel(page));
    ok(led && led.bags === 15,
      `a save claiming 40 bags with no unit rented lands at the cap of 15 (${JSON.stringify(led)})`);
    ok(led && led.pure === 15,
      `and its ✨ ledger lands with it, not on the saved 40 (${JSON.stringify(led)})`);
    await ctx.close();
  }

  // ---- D: source guards ----------------------------------------------
  {
    const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');

    const raid = /function triggerRaid\(\) \{([\s\S]*?)\n\}/.exec(src);
    const body = raid ? raid[1] : '';
    const seizeAt = body.indexOf('stashCount - lost');
    const clampAt = body.search(/pureBags\s*=\s*Math\.min\(pureBags,\s*stashCount\)/);
    ok(seizeAt >= 0 && clampAt > seizeAt,
      'triggerRaid() re-clamps the ✨ ledger after the seizure');

    const capAt = src.indexOf("stashCount=Math.min(sv.unitRented?45:STASH_MAX_BASE");
    const loadClampAt = src.indexOf('pureBags = Math.min(pureBags, stashCount);', capAt);
    ok(capAt >= 0 && loadClampAt > capAt && loadClampAt - capAt < 400,
      'loadGame() re-clamps the ✨ ledger after the rented ceiling cuts the stash down');

    // The street sale is the one bag-remover that needs no trailing clamp:
    // it takes the pure off the top first, so it cannot break the invariant.
    ok(/const pureUsed=Math\.min\(pureBags, qty\);[\s\S]{0,200}?pureBags-=pureUsed;/.test(src),
      'the street sale takes ✨ off the top — invariant-preserving by construction');
  }

  ok(errs.length === 0, `no page errors (${errs.length ? errs.join(' | ') : 'clean'})`);

  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();

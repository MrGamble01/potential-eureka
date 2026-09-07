/* TYC-63 — the bell closes the books: nothing in flight crosses the IPO.
 *
 * doIPO() resets the company to $200 × season and an empty floor, and it
 * used to leave everything in flight exactly where it was:
 *
 *   • an on-site engagement (payout locked at the OLD season's rate,
 *     min $2,000) and a launch in polish paid into the new company a
 *     minute later; a hackathon shipped for the old run rate (min $3,000)
 *   • an outage carried its ≥$1,000 page into a $200 season, then hit
 *     the fresh roster with −6 morale when it burned out
 *   • a moonshot placed while ahead auto-lost the moment the goal bar
 *     and the rival reset to zero; the factoring desk kept diverting the
 *     new season's first receivables; the hedge rode into a race it
 *     never insured
 *   • Jeff Jackets — the one hire the reset forgot — churned $60+ every
 *     ten seconds out of a company that starts with $200
 *   • every open pitch stayed on screen over the season card, its clock
 *     still running, and the troll's expire path could still charge a
 *     default judgment
 *
 * Now settleSeasonAtIPO() settles the wagers against the season as it
 * stands and shelves the rest, before the reset. This suite seeds a
 * Season 2 save with all of it in flight, presses the real IPO button,
 * waits past every timer, and checks the new company's books are
 * exactly its starting cash with nothing left on the chips. Hook-free.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const SAVE_KEY = 'startup-tycoon-v7';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const source = fs.readFileSync(path.join(__dirname, '../../tycoon/play.html'), 'utf8');

// ── A. source ────────────────────────────────────────────────
{
  const ipo = source.slice(source.indexOf('function doIPO()'), source.indexOf('function doIPO()') + 400);
  ok(/settleSeasonAtIPO\(\);/.test(ipo), 'doIPO() opens with settleSeasonAtIPO()');
  const settle = source.slice(source.indexOf('function settleSeasonAtIPO()'), source.indexOf('function doIPO()'));
  for (const v of ['moonshot', 'factor', 'hedge', 'onsite', 'launchPolish', 'retreat', 'hackathon', 'outage',
                   'trollOffer', 'poachOffer', 'boardActive', 'activeEvent', 'rushActive', 'jeff']) {
    ok(new RegExp('\\b' + v + '\\b').test(settle), `the settle block covers ${v}`);
  }
  ok(/function settleMoonshot\(\)/.test(source) && /function settleFactor\(\)/.test(source),
    'the moonshot and factor settlements are callable from the bell');
}

// ── B. a real IPO with everything in flight ──────────────────
// Season 2 (post-IPO systems are live), IPO unlocked, one engineer, and
// every in-flight thing the schema can carry, each timer a few seconds
// from paying out.
const SEED = {
  v: 7, cash: 0, allTimeCash: 100000, ideaWorkers: 1,
  prestigeLevel: 1, prestigeMultiplier: 2,
  onsite: { timeLeft: 4, payout: 5000 },
  launches: { n: 0, polish: { timeLeft: 4, payout: 4000 } },
  hackathons: { held: 0, active: { timeLeft: 4 } },
  retreats: { held: 0, active: { timeLeft: 4 } },
  outages: { paged: 0, seen: 0, active: { timeLeft: 4 } },
  hedge: { active: 500, paid: 0, burned: 0 },
  factor: { open: { advance: 900, timeLeft: 4, diverted: 100 }, taken: 0, wins: 0, profit: 0 },
  jeff: { churns: 0, stage: 'am' },
};

async function boot(browser, save) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
  await page.addInitScript(([k, v, w]) => {
    if (sessionStorage.getItem('tycipo-seeded')) return;
    sessionStorage.setItem('tycipo-seeded', '1');
    try { localStorage.setItem(k, v); localStorage.setItem(w, '1'); } catch (e) {}
  }, [SAVE_KEY, JSON.stringify(save), 'tycoon:welcomeSeen-v1']);
  await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  const read = () => page.evaluate(k => {
    const t = id => { const el = document.getElementById(id); return el ? el.textContent : null; };
    const shown = id => { const el = document.getElementById(id); return !!el && el.style.display !== 'none'; };
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(k)); } catch (e) {}
    return {
      onsiteChip: t('onsite-chip'), launchChip: t('launch-chip'), hackChip: t('hack-chip'),
      retreatChip: t('retreat-chip'), factorChip: t('factor-chip'), hedgeChip: t('hedge-chip'),
      outageBanner: shown('outage-banner'),
      jeffBtn: shown('recruit-jeff-btn') ? t('recruit-jeff-btn') : '(hidden)',
      feed: Array.from(document.querySelectorAll('#feed-list .feed-entry')).map(e => e.textContent).join(' | '),
      cash: saved ? saved.cash : null, season: saved ? saved.prestigeLevel : null,
      hedge: saved ? saved.hedge : null, factor: saved ? saved.factor : null,
      onsite: saved ? saved.onsite : null, jeff: saved ? saved.jeff : null,
    };
  }, SAVE_KEY);
  return { page, ctx, errs, read };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const b = await boot(browser, SEED);

  // The seed took: everything is visibly in flight before the bell.
  const before = await b.read();
  ok(/🧳/.test(before.onsiteChip) && /…|s/.test(before.factorChip) && /covered/.test(before.hedgeChip) && before.outageBanner,
    `before the IPO the engagement, the desk, the hedge and the outage are all live (${before.onsiteChip} / ${before.factorChip} / ${before.hedgeChip} / banner ${before.outageBanner})`);
  ok(before.jeffBtn === '(hidden)', 'Jeff is on the payroll as an AM (his button is hidden)');

  await b.page.keyboard.press('Escape');
  await b.page.click('#ipo-btn');
  await b.page.click('#ipo-confirm-btn');
  // Past every 4 s timer, past Jeff's first churn window, and past an autosave.
  await b.page.waitForTimeout(9000);
  const after = await b.read();

  ok(after.season === 2, `the IPO went through (season index ${after.season})`);
  // Season 3 starts at 200 × 2 = $400. Nothing from the old season may land on top of it,
  // and nothing (Jeff) may take from it.
  ok(after.cash === 400, `the new company's cash is exactly its $400 start, nine seconds in (got $${after.cash})`);
  ok(!after.onsiteChip && !after.launchChip && !after.hackChip && !after.retreatChip,
    `no engagement, polish, hackathon or retreat chip survives the bell (${JSON.stringify([after.onsiteChip, after.launchChip, after.hackChip, after.retreatChip])})`);
  ok(!after.outageBanner, 'the outage banner is down');
  ok(!/paid \$|shipped clean|hackathon build ships|burned out/.test(after.feed),
    `no old-season payout or burn-out reached the feed (${after.feed.slice(0, 160)})`);
  ok(after.hedge && after.hedge.active === 0 && after.hedge.burned === 1,
    `the hedge expired at the bell (active ${after.hedge && after.hedge.active}, burned ${after.hedge && after.hedge.burned})`);
  ok(after.factor && after.factor.open === null && after.factor.taken === 1,
    `the factoring window was settled at the bell (open ${after.factor && JSON.stringify(after.factor.open)}, taken ${after.factor && after.factor.taken})`);
  ok(after.onsite === null && after.jeff === null, 'the save carries no engagement and no Jeff into the new season');
  ok(/Recruit Jeff/.test(after.jeffBtn), `Jeff can be recruited again (${after.jeffBtn})`);
  ok(b.errs.length === 0, `no page errors across the IPO${b.errs.length ? ' — ' + b.errs[0] : ''}`);
  await b.ctx.close();

  await browser.close();
  ok(pass >= 24, 'suite is populated');
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

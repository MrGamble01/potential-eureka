/* TYC-62 — a reload between the bell and the IPO no longer turns BUY into SELL.
 *
 * triggerWin() sets raceWonSeason when YOU ring the bell before the
 * rival. rollAnalyst() reads it at the IPO: a won race rates BUY (+5%
 * on every deal next season, the BUY streak feeds the dividend, and the
 * retro banks two learnings instead of one); a lost race rates SELL
 * (−5%). The flag lived only in memory. The autosave runs every five
 * seconds and the IPO button appears on its own schedule, so any reload
 * in between — a tab closed for the night, a phone that evicted the
 * page — reopened with raceWonSeason at its initial false: the rival
 * bar full, the goal bar full, and the analyst rating the season SELL.
 *
 * The fix rides the flag on the rivalRace schema entry beside the
 * race's own rev/done/name. This suite is hook-free: it seeds a save
 * that has already won the race, presses the real IPO button, and reads
 * the analyst chip and the saved rating back. Non-vacuous: the lost-race
 * seed still rates SELL, and the pre-fix page rates the won seed SELL too.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const SAVE_KEY = 'startup-tycoon-v7';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const source = fs.readFileSync(path.join(__dirname, '../../tycoon/play.html'), 'utf8');

// ── A. the schema carries it ────────────────────────────────
{
  const entry = source.slice(source.indexOf("key: 'rivalRace'"), source.indexOf("key: 'climate'"));
  ok(entry.length > 0 && /won:\s*raceWonSeason/.test(entry), 'the rivalRace write carries won: raceWonSeason');
  ok(/raceWonSeason\s*=\s*!!p\.rivalRace\.won/.test(entry), 'and the read restores it');
}

// ── B. real IPOs ────────────────────────────────────────────
async function boot(browser, save) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
  await page.addInitScript(([k, v, w]) => {
    if (sessionStorage.getItem('tycrace-seeded')) return;
    sessionStorage.setItem('tycrace-seeded', '1');
    try { localStorage.setItem(k, v); localStorage.setItem(w, '1'); } catch (e) {}
  }, [SAVE_KEY, JSON.stringify(save), 'tycoon:welcomeSeen-v1']);
  await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  const ipo = async () => {
    await page.keyboard.press('Escape');
    await page.click('#ipo-btn');
    await page.click('#ipo-confirm-btn');
    await page.waitForTimeout(600);
    return page.evaluate(k => {
      const chip = document.getElementById('analyst-chip');
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(k)); } catch (e) {}
      return {
        chip: chip && chip.style.display !== 'none' ? chip.textContent : '',
        rating: saved && saved.analyst ? saved.analyst.rating : null,
        streak: saved && saved.analyst ? saved.analyst.streak : null,
        season: saved ? saved.prestigeLevel : null,
      };
    }, SAVE_KEY);
  };
  const savedRace = () => page.evaluate(k => {
    try { return JSON.parse(localStorage.getItem(k)).rivalRace; } catch (e) { return null; }
  }, SAVE_KEY);
  return { page, ctx, errs, ipo, savedRace };
}

// Season 1, goal hit, IPO available, the race already over.
const WON  = { v: 7, cash: 0, allTimeCash: 100000, prestigeLevel: 0, prestigeMultiplier: 1,
               seasonGoalHit: true, rivalRace: { rev: 30000, done: true, name: 'Yodel', won: true } };
const LOST = { ...WON, rivalRace: { rev: 30000, done: true, name: 'Yodel', won: false } };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // 1. The headline: a won race survives the reload and rates BUY at the bell.
  {
    const b = await boot(browser, WON);
    const r = await b.ipo();
    ok(r.season === 1, `the IPO went through (season index ${r.season})`);
    ok(/BUY/.test(r.chip), `the analyst chip reads BUY after a reload-then-IPO on a won race (got "${r.chip}")`);
    ok(r.rating === 'buy' && r.streak === 1, `the saved rating is buy with a streak of 1 (got ${r.rating}/${r.streak})`);
    const race = await b.savedRace();
    ok(race && race.won === false, 'the new season starts with the flag down again');
    ok(b.errs.length === 0, `no page errors across the IPO${b.errs.length ? ' — ' + b.errs[0] : ''}`);
    await b.ctx.close();
  }

  // 2. Control: a lost race still rates SELL — the fix persists the truth, not a BUY.
  {
    const b = await boot(browser, LOST);
    const r = await b.ipo();
    ok(/SELL/.test(r.chip) && r.rating === 'sell' && r.streak === 0,
      `a lost race still rates SELL with the streak reset (got "${r.chip}", ${r.rating}/${r.streak})`);
    await b.ctx.close();
  }

  // 3. The flag rides the autosave: seeded true, it is still true in the next save written.
  {
    const b = await boot(browser, WON);
    await b.page.waitForTimeout(6500);
    const race = await b.savedRace();
    ok(race && race.won === true && race.done === true && race.name === 'Yodel',
      `the autosave carries won alongside rev/done/name (${JSON.stringify(race)})`);
    await b.ctx.close();
  }

  await browser.close();
  ok(pass >= 8, 'suite is populated');
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

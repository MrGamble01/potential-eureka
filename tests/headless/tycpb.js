/* TYC-64 — the season's personal best is played time, not time since page load.
 *
 * triggerWin() stamps "Time to goal" and the per-season PB from
 * `Date.now() - sessionStart`, and sessionStart was the page-load
 * instant: never persisted, never reset at the IPO. Two wrong answers:
 *
 *   • play Season 2 for forty minutes, reload, cross the goal thirty
 *     seconds later → "★ NEW BEST 0:30". Any PB was beatable by
 *     reloading just before the bell, and the goal bar's PB label was
 *     meaningless from the first reload on
 *   • play Season 1 for ten minutes, IPO, win Season 2 twenty minutes
 *     later in the same tab → Season 2's time is 30:00
 *
 * Now `seasonPlaySec` accumulates frame dt (a hidden tab adds nothing),
 * rides the save, and resets at the bell. This suite is hook-free: it
 * seeds a season one deal short of its goal with an hour already
 * played, lets a real BDR close the gap, and reads "Time to goal" off
 * the real win card and the PB out of the save.
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
  const win = source.slice(source.indexOf('function triggerWin('), source.indexOf('function triggerWin(') + 1200);
  ok(/const elapsed = Math\.floor\(seasonPlaySec\)/.test(win), 'triggerWin measures the season in played seconds');
  ok(!/Date\.now\(\) - sessionStart/.test(win), 'and no longer from page load');
  ok(/key: 'seasonPlaySec'/.test(source), 'the season clock rides the save schema');
  ok(/seasonPlaySec \+= dt;/.test(source), 'the clock runs on frame dt');
}

const parseMS = t => { const m = /(\d+):(\d\d)/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };

async function boot(browser, save) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
  await page.addInitScript(([k, v, w]) => {
    if (sessionStorage.getItem('tycpb-seeded')) return;
    sessionStorage.setItem('tycpb-seeded', '1');
    try { localStorage.setItem(k, v); localStorage.setItem(w, '1'); } catch (e) {}
  }, [SAVE_KEY, JSON.stringify(save), 'tycoon:welcomeSeen-v1']);
  await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  const saved = () => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, SAVE_KEY);
  return { page, ctx, errs, saved };
}

const BASE_SAVE = { v: 7, cash: 0, allTimeCash: 50, prestigeLevel: 0, prestigeMultiplier: 1, ideaWorkers: 1, bdrCount: 1,
                    rivalRace: { rev: 0, done: false, name: 'Yodel', won: false } };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // 1. An hour played, one deal short of the Season 1 goal ($25k): the win card must say so.
  {
    const b = await boot(browser, { ...BASE_SAVE, seasonRecurringRevenue: 24995, seasonPlaySec: 3661 });
    await b.page.keyboard.press('Escape');
    let opened = false;
    for (let i = 0; i < 90 && !opened; i++) {
      await b.page.waitForTimeout(500);
      opened = await b.page.evaluate(() => document.getElementById('win-modal').classList.contains('open'));
    }
    ok(opened, 'a real deal crossed the goal and the win card opened');
    const card = await b.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#win-stats .row'));
      const r = rows.find(x => /Time to goal/.test(x.textContent));
      return { time: r ? r.querySelector('strong').textContent : '', pb: document.getElementById('goal-pb').textContent };
    });
    const secs = parseMS(card.time);
    ok(secs >= 3661 && secs < 3661 + 60, `"Time to goal" carries the hour already played (${card.time.trim().slice(0, 12)})`);
    ok(/NEW BEST/.test(card.time), 'and it is the season\'s first PB');
    ok(parseMS(card.pb) === secs, `the goal bar's PB label agrees (${card.pb})`);
    await b.page.waitForTimeout(5500);
    const sv = await b.saved();
    ok(sv && sv.bestTimesToGoal && sv.bestTimesToGoal['0'] === secs, `the PB in the save is the played time (${sv && sv.bestTimesToGoal && sv.bestTimesToGoal['0']})`);
    ok(b.errs.length === 0, `no page errors${b.errs.length ? ' — ' + b.errs[0] : ''}`);
    await b.ctx.close();
  }

  // 2. The clock rides the save and keeps counting from where it was.
  {
    const b = await boot(browser, { ...BASE_SAVE, seasonPlaySec: 100 });
    // Poll the 5 s autosave until the clock has visibly moved on from the seed.
    let v = null;
    for (let i = 0; i < 30 && !(v >= 105); i++) { await b.page.waitForTimeout(500); const sv = await b.saved(); v = sv && sv.seasonPlaySec; }
    ok(v >= 105 && v <= 118,
      `a save seeded at 100 s keeps counting from there — the next saves read on past 105 s (got ${v})`);
    await b.ctx.close();
  }

  // 3. The IPO starts the new season's clock at zero.
  {
    const b = await boot(browser, { ...BASE_SAVE, allTimeCash: 100000, seasonPlaySec: 5000 });
    await b.page.keyboard.press('Escape');
    await b.page.click('#ipo-btn');
    await b.page.click('#ipo-confirm-btn');
    await b.page.waitForTimeout(1000);
    const sv = await b.saved();
    ok(sv && sv.prestigeLevel === 1 && sv.seasonPlaySec >= 0 && sv.seasonPlaySec < 10,
      `after the IPO the saved season clock is back near zero (got ${sv && sv.seasonPlaySec})`);
    await b.ctx.close();
  }

  await browser.close();
  ok(pass >= 11, 'suite is populated');
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

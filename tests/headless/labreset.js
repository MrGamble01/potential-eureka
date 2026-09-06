/* LAB-59 — "Reset Game" never reset anything.
 *
 * Grow Op's Reset Game button (and the bust modal's Start Over) both go
 * through resetGame(): wipe `drug-lab-v1`, then location.reload(). But a
 * reload fires beforeunload and pagehide first, and both are wired to
 * saveGame() — which wrote the still-live run straight back over the key
 * that had just been cleared. The page came back with the same cash, the
 * same rooms, the same difficulty, and no difficulty picker.
 *
 * LAB-1 fixed exactly this for the bust: saveGame() returns early while
 * `busted`. The voluntary reset runs with `busted` false, so it was never
 * covered — the only way to start a fresh run in Grow Op was to get
 * raided at 100 heat. Every fresh-start system (the difficulty pick, the
 * Youth Center's run counter, the cookout, the kite, the floor safe's
 * payout) was reachable by losing and by nothing else.
 *
 * The fix is a `resetting` flag set before the wipe and honoured by
 * saveGame() beside `busted` — the same shape Startup Tycoon's restart
 * already uses (`_restarting`).
 *
 * A. Source: the guard is in place, in the right order, and the unload
 *    saves it guards against are still wired (a fix for a race that no
 *    longer exists would be vacuous).
 * B. Browser, no hooks: seed a mid-run save before the page ever loads
 *    (setting it after load gets clobbered by the same autosave that is
 *    the bug), prove the game read it, prove a plain reload still keeps
 *    it (the autosave is live — this is the path the old reset lost to),
 *    prove a cancelled confirm changes nothing, then Reset Game: the key
 *    is gone, the difficulty picker opens, the HUD is a fresh garage, the
 *    cross-run keys (legacy, floor safe) are untouched — and picking
 *    Kingpin actually starts a Kingpin run with the safe's balance paid
 *    into the new pocket.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// ---- A. source ----------------------------------------------------
const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
const resetFn = /function resetGame\(\) \{([\s\S]*?)\n\}/.exec(src);
const resetBody = resetFn ? resetFn[1] : '';
const flagAt = resetBody.indexOf('resetting = true');
const wipeAt = resetBody.indexOf('localStorage.removeItem(LS_KEY)');
const reloadAt = resetBody.indexOf('location.reload()');
ok(flagAt >= 0 && wipeAt > flagAt && reloadAt > wipeAt,
   'resetGame() raises the flag, then wipes the key, then reloads — in that order');
ok(/if \(busted \|\| resetting\) return;/.test(src),
   'saveGame() stands down while resetting, beside the LAB-1 busted guard');
ok(/addEventListener\('beforeunload', saveGame\)/.test(src) && /'pagehide', \(\) => saveGame\(\)/.test(src),
   'the unload saves the guard exists for are still wired (beforeunload + pagehide)');

// ---- B. browser ---------------------------------------------------
const SEED = {
  cash: 4321, totalEarned: 9000, totalSold: 120, heat: 33, difficulty: 'kingpin',
  upgrades: { yield1: 2 }, ownedRooms: ['garage', 'growroom'], trimmers: 1, lookouts: 1,
  stashCount: 5, goalIndex: 2, savedAt: Date.now(),
};
const LEGACY = { points: 2, runs: 3 };
const VAULT = { bal: 900, life: 900 };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));

  // Seed from a same-origin page that does not run the game. Seeding after
  // the game has loaded is exactly what the unload autosave overwrites.
  await page.goto(BASE + '/robots.txt', { waitUntil: 'load', timeout: 25000 });
  await page.evaluate(([s, l, v]) => {
    localStorage.clear();
    localStorage.setItem('drug-lab-v1', JSON.stringify(s));
    localStorage.setItem('growop-legacy', JSON.stringify(l));
    localStorage.setItem('growop-vault', JSON.stringify(v));
  }, [SEED, LEGACY, VAULT]);

  const snapshot = () => page.evaluate(() => ({
    cash: document.getElementById('cash-val').textContent,
    act: document.getElementById('act-badge').textContent,
    picker: document.getElementById('diff-modal').classList.contains('open'),
    save: JSON.parse(localStorage.getItem('drug-lab-v1') || 'null'),
    legacy: JSON.parse(localStorage.getItem('growop-legacy') || 'null'),
    vault: JSON.parse(localStorage.getItem('growop-vault') || 'null'),
  }));

  await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(1200);
  const loaded = await snapshot();
  ok(loaded.cash === '$4.3k' && /ACT II/.test(loaded.act) && /👑/.test(loaded.act) && !loaded.picker,
     `the seeded Kingpin run was read: HUD ${loaded.cash}, ${loaded.act}, no difficulty picker`);

  // Control: the autosave that the old reset lost to is live. A plain
  // reload must keep the run — this is not a test of "reloads forget".
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const kept = await snapshot();
  ok(kept.save && kept.save.cash === 4321 && kept.save.difficulty === 'kingpin' && kept.cash === '$4.3k',
     'a plain reload keeps the run (the unload autosave is live, so the guard below is doing real work)');

  // A cancelled confirm is not a reset.
  page.once('dialog', d => d.dismiss());
  await page.click('#restart-btn');
  await page.waitForTimeout(600);
  const cancelled = await snapshot();
  ok(cancelled.save && cancelled.save.cash === 4321 && cancelled.cash === '$4.3k' && !cancelled.picker,
     'cancelling the confirm leaves the run exactly where it was');

  // The reset itself.
  page.once('dialog', d => d.accept());
  const reloaded = page.waitForEvent('load', { timeout: 15000 });
  await page.click('#restart-btn');
  await reloaded;
  await page.waitForTimeout(1200);
  const fresh = await snapshot();
  ok(fresh.save === null,
     'Reset Game: the save key is gone after the reload — the unload save did not write it back');
  ok(fresh.picker,
     'Reset Game: the difficulty picker opens, as it does for any run with no save');
  ok(fresh.cash === '$50' && /ACT I\b/.test(fresh.act) && !/👑/.test(fresh.act),
     `Reset Game: the HUD is a fresh garage (${fresh.cash}, ${fresh.act})`);
  ok(fresh.legacy && fresh.legacy.points === 2 && fresh.legacy.runs === 3
     && fresh.vault && fresh.vault.bal === 900,
     'the cross-run keys are untouched: the legacy record and the floor safe both stand');
  const sub = await page.$eval('.diff-sub', el => el.textContent).catch(() => '');
  ok(/Legacy: \+8%/.test(sub) && /3 past lives/.test(sub),
     'the picker cites the surviving legacy (+8% from 3 past lives)');

  // And the reset reaches the fresh-start path for real: a Kingpin run
  // starts on Kingpin money plus whatever the safe held.
  // (No picker means the reset failed above; do not wait 30s on a button
  // that is not there — fail the two pick assertions and move on.)
  if (fresh.picker) { await page.click('#diff-kingpin'); await page.waitForTimeout(600); }
  const king = fresh.picker ? await snapshot() : { save: null, vault: null, picker: false, act: '' };
  ok(king.save && king.save.difficulty === 'kingpin' && king.save.cash === 150 + 900
     && king.save.totalEarned === 0 && !king.picker && /👑/.test(king.act),
     `picking Kingpin starts a Kingpin run: $${king.save && king.save.cash} in pocket ($150 + the $900 safe), nothing earned yet`);
  ok(king.vault && king.vault.bal === 0 && king.vault.life === 900,
     'the floor safe paid out into the new run and its lifetime tally stands');

  ok(errs.length === 0, `no page errors across the seed, the reload, the reset and the pick${errs.length ? ' — ' + errs.join(' | ') : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

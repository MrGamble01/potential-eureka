/* HV-61 — Keys in Hand must come back after a reload.
 *
 * The Case Worker arc is the one storyline with an exit. checkArc()
 * advances 2 → 3, saveGame()s, then showGraduation(). That save is
 * written BEFORE the player picks Keep building or Start a new camp.
 * checkArc() has no stage-3 branch, and boot only resumes game-over
 * (health<=0). A reload, crash, or closed tab at that moment leaves
 * arcStage:3 / arcDone:false and no overlay — the ending is gone,
 * while the hub already reads arcStage>=3 as 🔑 housed.
 *
 * Hook-free: seed the real save key, load the real page, look for the
 * real #hv-graduation node. Reverting the boot resume fails the named
 * assertion; the live checkArc path and the Keep-building isolation
 * are the other direction of the ticket.
 *
 * A. checkArc() still opens Keys in Hand when stage 2 graduates.
 * B. A save left at stage 3 / not-done re-shows the overlay on boot.
 * C. Keep building marks the sandbox; a later reload stays quiet.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
// Boot resume sits next to the health<=0 game-over resume — same class
// of "the overlay died with the tab."
ok(/arcStage\s*>=\s*3[\s\S]{0,80}!G\.arcDone[\s\S]{0,40}showGraduation\s*\(/.test(main)
  || /if\s*\(\s*G\.health\s*<=\s*0\s*\)\s*showGameOver\s*\(\s*\)\s*;[\s\S]{0,400}showGraduation\s*\(/.test(main),
  'HV-61: boot resumes Keys in Hand next to the game-over resume');
ok(/arcStage\s*===?\s*3[\s\S]{0,80}showGraduation\s*\(/.test(loop)
  || /arcStage\s*>=\s*3[\s\S]{0,80}showGraduation\s*\(/.test(loop),
  'HV-61: checkArc() no longer treats stage 3 as a dead end');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // --- A + B. live graduation, then a reload of that save ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(() => {
      localStorage.setItem('hv-intro-seen', '1');
      if (!sessionStorage.getItem('hvarc-init')) {
        sessionStorage.setItem('hvarc-init', '1');
        localStorage.removeItem('homeless_village_v1');
      }
    });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    const live = await page.evaluate(() => {
      G.arcStage = 2;
      G.arcDone = false;
      G.goodwill = 30;
      G.morale = 70;
      G.days = 18;
      G.health = 80;
      checkArc();
      return {
        stage: G.arcStage,
        done: G.arcDone,
        modal: !!document.getElementById('hv-graduation'),
        title: (document.getElementById('hv-graduation') || {}).innerText || '',
      };
    });
    ok(live.stage === 3 && live.modal && /KEYS IN HAND/.test(live.title),
      `A. checkArc() still opens Keys in Hand (${live.stage}, modal=${live.modal})`);
    ok(!live.done, 'A. the overlay is shown before Keep building marks the sandbox');

    // B — the named assertion. Reload the save checkArc() just wrote.
    // Revert the boot `showGraduation()` and this is the line that goes red.
    await page.reload({ waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);
    const resumed = await page.evaluate(() => ({
      stage: G.arcStage,
      done: G.arcDone,
      modal: !!document.getElementById('hv-graduation'),
      title: (document.getElementById('hv-graduation') || {}).innerText || '',
    }));
    ok(resumed.stage === 3 && !resumed.done && resumed.modal && /KEYS IN HAND/.test(resumed.title),
      'HV-61: a stage-3 save re-shows Keys in Hand after reload');

    // C. Keep building, then reload — the sandbox must stay quiet.
    // Only reachable when B held; otherwise skip so a failing resume
    // still reports instead of hanging on a button that isn't there.
    if (resumed.modal) {
      await page.click('#hv-grad-stay');
      await page.waitForTimeout(400);
      const stayed = await page.evaluate(() => ({
        done: G.arcDone,
        modal: !!document.getElementById('hv-graduation'),
      }));
      ok(stayed.done && !stayed.modal, 'Keep building marks the sandbox and dismisses the overlay');

      await page.reload({ waitUntil: 'load', timeout: 25000 });
      await page.waitForTimeout(2200);
      const quiet = await page.evaluate(() => ({
        done: G.arcDone,
        modal: !!document.getElementById('hv-graduation'),
      }));
      ok(quiet.done && !quiet.modal,
        'HV-61: a finished sandbox does not get Keys in Hand again');
    } else {
      ok(false, 'Keep building marks the sandbox and dismisses the overlay');
      ok(false, 'HV-61: a finished sandbox does not get Keys in Hand again');
    }

    ok(errs.length === 0, `live path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // --- seeded save, no live checkArc --------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(() => {
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.setItem('homeless_village_v1', JSON.stringify({
        arcStage: 3,
        arcDone: false,
        days: 20,
        goodwill: 30,
        morale: 70,
        health: 80,
        peakPopulation: 4,
        totalScavenged: 12,
        totalCrafted: 6,
        fridgeSeeded: true,
      }));
    });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);
    const seeded = await page.evaluate(() => ({
      stage: G.arcStage,
      modal: !!document.getElementById('hv-graduation'),
    }));
    ok(seeded.stage === 3 && seeded.modal,
      'HV-61: a cold-loaded stage-3 save opens Keys in Hand without waiting for dawn');

    ok(errs.length === 0, `seeded path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

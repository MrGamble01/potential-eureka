/* HV-66 — Escape does not dismiss Keys in Hand.
 *
 * HV-58 wired Escape for The Bridge. The intro already had it. Keys in
 * Hand (#hv-graduation) is the same class of full-screen card — two
 * buttons, no keyboard way out. A player who finished the Case Worker
 * arc and hit Escape (the key that just closed every other overlay)
 * stayed stuck on KEYS IN HAND until they used the mouse.
 *
 * Keep Building is the non-destructive dismiss (Start a New Camp wipes
 * the save). Escape should take that path — click #hv-grad-stay — not
 * invent a third closer. closeIntro() must not run.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the main.js Escape handler still closes The Bridge, now
 *    also clicks #hv-grad-stay, and still does not call closeIntro().
 *    ui.js is not touched.
 * B. Behaviour: showGraduation(), press Escape, the card is gone and
 *    arcDone is set. The Bridge Escape path still works. The intro
 *    Escape path still works.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const escAt = main.indexOf("if(e.key === 'Escape')");
const esc = escAt >= 0 ? main.slice(escAt, escAt + 700) : '';

ok(escAt >= 0, 'the Escape handler still lives in main.js — guards the guard');
ok(/chain-modal/.test(esc) && /classList\.remove\(\s*['"]open['"]\s*\)/.test(esc),
   'HV-58: Escape still removes open from #chain-modal');
ok(/hv-grad-stay/.test(esc),
   'HV-66: that same handler clicks #hv-grad-stay — Keep Building, not a third closer');
ok(!/closeIntro\s*\(/.test(esc),
   'the handler still does not call closeIntro()');
ok(/id="hv-grad-stay"/.test(ui) && /function showGraduation/.test(ui),
   'ui.js still owns showGraduation and the stay button — this ticket does not rewrite them');
ok(!/function showGraduation/.test(main),
   'showGraduation stays in ui.js; the key lives in main.js');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);

  // --- A. intro Escape still works ---------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    const shown = await page.$eval('#intro-modal', el => el.classList.contains('open')).catch(() => false);
    ok(shown, 'a brand-new camp is met by the crash course');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const gone = await page.$eval('#intro-modal', el => el.classList.contains('open'));
    ok(!gone, 'Escape still dismisses the crash course');

    ok(errs.length === 0, `intro path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // --- B. Keys in Hand ---------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(() => { localStorage.setItem('hv-intro-seen', '1'); });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    const boot = await page.evaluate(() => {
      showGraduation();
      return {
        card: !!document.getElementById('hv-graduation'),
        stay: !!document.getElementById('hv-grad-stay'),
        done: !!G.arcDone,
      };
    });
    ok(boot.card && boot.stay && !boot.done,
       'showGraduation() puts Keys in Hand up with Keep Building, sandbox not yet marked');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      card: !!document.getElementById('hv-graduation'),
      done: !!G.arcDone,
    }));
    ok(!after.card && after.done,
       'HV-66: Escape dismisses Keys in Hand the Keep Building way (card gone, arcDone set)');

    ok(errs.length === 0, `keys path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // --- C. The Bridge still closes ----------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(() => { localStorage.setItem('hv-intro-seen', '1'); });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    await page.click('#chain-btn');
    await page.waitForSelector('#chain-modal.open', { timeout: 10000 });
    await page.evaluate(() => localStorage.removeItem('hv-intro-seen'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const bridge = await page.evaluate(() => ({
      open: document.getElementById('chain-modal').classList.contains('open'),
      intro: document.getElementById('intro-modal').classList.contains('open'),
      seen: localStorage.getItem('hv-intro-seen'),
    }));
    ok(!bridge.open, 'HV-58: Escape still closes The Bridge');
    ok(!bridge.intro && bridge.seen !== '1',
       'Escape on The Bridge still does not dismiss or mark the intro seen');

    ok(errs.length === 0, `bridge path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

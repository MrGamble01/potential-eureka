/* AOW — the Pause button, and the shortcut nobody was ever told about.
 *
 * Every "extra" action in Age of War's action bar documents its own
 * keyboard shortcut in its own tooltip — "Sign the Fletcher (F)", "Hire
 * the Drillmaster (D)", and eighteen more like them. The three "core"
 * actions (Age Up, Special, Hero) skip the tooltip because their keys
 * are taught up front, in the always-visible hint bar at the foot of the
 * page and in the welcome modal's own tutorial steps.
 *
 * Pause falls through both nets. `#aow-pause-btn` had no `title` at all,
 * its key never appeared in the hint bar, and it is not in the welcome
 * modal's five steps either. The shortcut is real and works —
 * `setUserPaused` is wired to the `P` key — but the ONLY place that ever
 * said so was the pause overlay's own text ("Press P, click here, or hit
 * Resume to continue"), which by definition a player only sees after
 * they have already found some other way to pause. A control with a
 * working shortcut and zero discoverability is, for a first-time
 * player, indistinguishable from one that doesn't have a shortcut at
 * all — the same class of gap HV-56 found in Homeless Village's opening
 * (a real mechanic, invisible until you already know to look for it).
 *
 * This suite is source-driven, not hardcoded, so it can't go stale the
 * way a quoted number can (AOW-58's 22-second Veteran bar promised
 * against a 22.5-second constant is exactly that failure mode): the key
 * is extracted from the actual `keydown` handler in ageofwar.js and
 * checked against the button's tooltip and the hint bar's copy, then
 * driven for real to prove the shortcut still works.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const js = fs.readFileSync(path.join(ROOT, 'ageofwar/ageofwar.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'ageofwar/index.html'), 'utf8');

// Pull the pause key straight out of the keydown handler rather than
// assuming 'P' — if a future round rebinds it, this suite should fail
// on the drift, not quietly keep asserting the old key.
const keyMatch = /e\.key === '([a-z])' \|\| e\.key === '([A-Z])'\) \{\s*setUserPaused/.exec(js);
const pauseKey = keyMatch ? keyMatch[2] : null; // the uppercase form, as shown to players

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // --- A. static: the key was actually found, and the copy names it ---
  ok(pauseKey === 'P', `the pause shortcut is extracted from the real keydown handler (got ${JSON.stringify(pauseKey)})`);

  const pauseBtnHtml = /<button id="aow-pause-btn"[^>]*>/.exec(html);
  ok(!!pauseBtnHtml, 'the pause button markup was found');
  const pauseTitle = pauseBtnHtml && /title="([^"]*)"/.exec(pauseBtnHtml[0]);
  ok(!!pauseTitle, `the pause button has a tooltip at all — it shipped with none${pauseBtnHtml ? ' (' + pauseBtnHtml[0] + ')' : ''}`);
  ok(!!(pauseTitle && pauseKey && new RegExp('\\(' + pauseKey + '\\)').test(pauseTitle[1])),
    `the tooltip names the real shortcut key${pauseTitle ? ' — "' + pauseTitle[1] + '"' : ''}`);

  const hintMatch = /<div class="aow-hint">([\s\S]*?)<\/div>/.exec(html);
  const hintText = hintMatch ? hintMatch[1].replace(/<[^>]+>/g, ' ') : '';
  ok(!!(pauseKey && new RegExp('\\b' + pauseKey + '\\b').test(hintText) && /pause/i.test(hintText)),
    `the always-visible hint bar now teaches the pause key too — "${hintText.trim().replace(/\s+/g, ' ')}"`);

  // --- B. behaviour: the shortcut actually still works ------------------
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 150)));
  await page.addInitScript(() => { try { localStorage.setItem('aow-welcome-seen', '1'); } catch (e) {} });
  await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  // userPaused itself lives in the game's closure, unreachable from
  // page.evaluate — so behaviour is read off the DOM it drives instead:
  // the button's own label ("Pause"/"Resume") and the overlay it shows.
  const readState = () => page.evaluate(() => ({
    overlayShown: getComputedStyle(document.getElementById('aow-overlay')).display !== 'none',
    overlayText: document.getElementById('aow-overlay').textContent,
    label: document.querySelector('#aow-pause-btn .aow-action-lbl').textContent,
  }));

  const before = await readState();
  ok(before.label === 'Pause' && !before.overlayShown, `a fresh run starts unpaused (label="${before.label}")`);

  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const afterPress = await readState();
  ok(afterPress.overlayShown && /PAUSED/i.test(afterPress.overlayText),
    'pressing P actually pauses the run — the PAUSED overlay appears, the same one that quotes the P key back at the player');
  ok(afterPress.label === 'Resume', `the button's own label flips to Resume (got "${afterPress.label}")`);

  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const afterSecond = await readState();
  ok(afterSecond.label === 'Pause', 'pressing P again resumes it (label back to Pause)');
  ok(!afterSecond.overlayShown, 'the overlay clears on resume');

  // Clicking the button itself must still work too — the fix only added
  // a tooltip, it must not have touched the click wiring.
  await page.click('#aow-pause-btn');
  await page.waitForTimeout(150);
  const afterClick = await readState();
  ok(afterClick.overlayShown && afterClick.label === 'Resume',
    'the button itself still pauses on click, unchanged by the tooltip addition');
  await page.click('#aow-pause-btn');
  await page.waitForTimeout(150);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();

  // --- C. guard the guard -------------------------------------------
  ok(/id="aow-pause-btn"/.test(html) && /id="aow-hint"|class="aow-hint"/.test(html),
    'both the button and the hint bar were actually found in the source — a selector drift would fail silently otherwise');

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

/* AOW-60 — Escape closes The Line (and Awards / Settings).
 *
 * The Line (#aow-chain-modal) is a browsing-only dialog. × and
 * backdrop already dismiss it. The game keydown handler returned
 * the instant modalPaused was set, so Escape never ran a close.
 * Awards (#aow-ach-modal) and Settings (#aow-settings-modal) have
 * the same CLOSE+backdrop pattern and the same miss.
 *
 * Hook-free, same shape as focus.js / wall.js: load the Age of War
 * page (which hosts #view-ageofwar), open the real control, press
 * the real key, read the real style.display. Reverting the Escape
 * branch fails the named assertion below. Welcome keeps its own
 * one-shot listener; userPaused and modalPaused keep composing.
 *
 * A. The Line opens from the action bar.
 * B. Escape closes The Line.          ← named; revert fails this
 * C. Escape closes Awards.
 * D. Escape closes Settings.
 * E. Escape while P-paused closes The Line but does not resume.
 * F. Welcome still closes via its own listener (welcome-seen set).
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function isOpen(display) {
  return !!(display && display !== 'none');
}

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errs = [];

  // Returning soldier: skip the first-run welcome so the browsing
  // dialogs are what Escape is measured against.
  {
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await page.addInitScript(() => {
      try { localStorage.setItem('aow-welcome-seen', '1'); } catch (e) {}
    });
    await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load' });
    await page.waitForSelector('#view-ageofwar.active', { timeout: 25000 });
    await page.waitForSelector('#aow-chain-btn', { timeout: 25000 });

    // A — The Line opens the way a player opens it.
    await page.click('#aow-chain-btn');
    await page.waitForSelector('#aow-chain-modal .aow-chain-row', { state: 'visible', timeout: 10000 });
    const lineOpen = await page.evaluate(() =>
      document.getElementById('aow-chain-modal').style.display);
    ok(isOpen(lineOpen), 'The Line opens from the action bar');

    // B — the named assertion. Revert the Escape branch that sets
    // #aow-chain-modal display to none and this is the line that goes red.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const lineClosed = await page.evaluate(() =>
      document.getElementById('aow-chain-modal').style.display);
    ok(!isOpen(lineClosed), 'AOW-60: Escape closes The Line');

    // C — Awards, same CLOSE+backdrop miss.
    await page.click('#aow-ach-btn');
    await page.waitForFunction(() => {
      const m = document.getElementById('aow-ach-modal');
      return m && m.style.display && m.style.display !== 'none';
    }, null, { timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const achClosed = await page.evaluate(() =>
      document.getElementById('aow-ach-modal').style.display);
    ok(!isOpen(achClosed), 'AOW-60: Escape closes Awards');

    // D — Settings, same miss.
    await page.click('#aow-settings-btn');
    await page.waitForFunction(() => {
      const m = document.getElementById('aow-settings-modal');
      return m && m.style.display && m.style.display !== 'none';
    }, null, { timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const setClosed = await page.evaluate(() =>
      document.getElementById('aow-settings-modal').style.display);
    ok(!isOpen(setClosed), 'AOW-60: Escape closes Settings');

    // E — P-pause and a browsing modal compose. Escape must close
    // The Line without dropping the pause overlay the player asked for.
    await page.keyboard.press('p');
    await page.waitForFunction(() => {
      const ov = document.getElementById('aow-overlay');
      return ov && ov.style.display === 'flex';
    }, null, { timeout: 10000 });
    await page.click('#aow-chain-btn');
    await page.waitForSelector('#aow-chain-modal .aow-chain-row', { state: 'visible', timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const afterEsc = await page.evaluate(() => {
      const line = document.getElementById('aow-chain-modal').style.display;
      const ov = document.getElementById('aow-overlay').style.display;
      const lbl = document.querySelector('#aow-pause-btn .aow-action-lbl');
      return { line, ov, resume: lbl && lbl.textContent === 'Resume' };
    });
    ok(!isOpen(afterEsc.line) && afterEsc.ov === 'flex' && afterEsc.resume,
      'AOW-60: Escape does not resume a game the player paused with P');

    await page.context().close();
  }

  // F — first-run welcome already has its own Escape listener, which
  // is also the one that writes aow-welcome-seen. The game handler
  // must not steal that close (bindControls registers first, so a
  // stolen close would hide the modal without setting the flag).
  {
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await page.addInitScript(() => {
      try { localStorage.removeItem('aow-welcome-seen'); } catch (e) {}
    });
    await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load' });
    await page.waitForSelector('#view-ageofwar.active', { timeout: 25000 });
    await page.waitForFunction(() => {
      const m = document.getElementById('aow-welcome-modal');
      return m && m.style.display && m.style.display !== 'none';
    }, null, { timeout: 15000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const welcome = await page.evaluate(() => ({
      display: document.getElementById('aow-welcome-modal').style.display,
      seen: localStorage.getItem('aow-welcome-seen'),
    }));
    ok(!isOpen(welcome.display) && welcome.seen === '1',
      'AOW-60: Escape still lets the welcome listener close (welcome-seen set)');
    await page.context().close();
  }

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

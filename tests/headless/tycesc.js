/* TYC-60 — Escape closes The Wall and Founder Shop.
 * Hook-free: real browsing controls and keyboard input. DOM-open controls
 * cover the existing dismissals and forced Board Meeting without waiting
 * for progression or invoking game internals.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};

(async () => {
  const launch = { args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
    await page.click('#welcome-start-btn');
    const isOpen = id => page.$eval('#' + id, el => el.classList.contains('open'));

    for (const [name, button, modal, close] of [
      ['The Wall', 'open-wall-btn', 'wall-modal', 'wall-close'],
      ['Founder Shop', 'open-founder-btn', 'founder-modal', 'founder-close'],
    ]) {
      await page.click('#' + button);
      await page.waitForSelector('#' + modal + '.open');
      ok(await isOpen(modal), `${name} opens via its real control`);
      await page.keyboard.press('Escape');
      ok(!(await isOpen(modal)), `TYC-60: Escape closes ${name}`);
      // Let both named assertions run against the unfixed page.
      if (await isOpen(modal)) await page.click('#' + close);
    }

    for (const modal of ['tip-modal', 'ipo-modal', 'elevator-modal', 'achievements-modal',
      'win-modal', 'dash-modal', 'theme-modal', 'help-modal']) {
      await page.$eval('#' + modal, el => el.classList.add('open'));
      ok(await isOpen(modal), `${modal}: DOM control opens`);
      await page.keyboard.press('Escape');
      ok(!(await isOpen(modal)), `Escape still closes ${modal}`);
    }

    const source = fs.readFileSync(path.resolve(__dirname, '../../tycoon/play.html'), 'utf8');
    const boardOpen = source.match(/function openBoardMeeting\(m\) \{([\s\S]*?)\n\}/);
    ok(!!boardOpen && /boardModalEl\(\)\.classList\.add\('open'\)/.test(boardOpen[1]),
      'Board DOM control matches the production opening mechanism');
    await page.$eval('#board-modal', el => el.classList.add('open'));
    ok(await isOpen('board-modal'), 'Board Meeting control is open before Escape');
    await page.keyboard.press('Escape');
    ok(await isOpen('board-modal'), 'Escape leaves the forced Board Meeting open');
    await page.click('#board-no');
    ok(!(await isOpen('board-modal')), 'Board Meeting still closes via its real No control');
    ok(errors.length === 0, `zero page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  } finally {
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });

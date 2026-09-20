/* Hook-free: reselecting the current difficulty must not discard a war. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  try {
    for (const width of [1280, 768]) {
      for (const surface of width === 1280 ? ['settings', 'hud'] : ['settings']) {
        for (const difficulty of ['normal', 'hard']) {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          const page = await context.newPage();
          page.on('pageerror', e => errors.push(String(e)));
          await page.addInitScript(difficulty => {
            localStorage.setItem('aow-welcome-seen', '1');
            localStorage.setItem('aow-difficulty', difficulty);
            localStorage.setItem('aow-session', JSON.stringify({
              v: 2, difficulty, waveNum: 4, gold: 1234, xp: 321,
              runStats: { time: 90 }, specialReadyT: 30,
            }));
          }, difficulty);
          await page.goto(BASE + '/ageofwar/');
          await page.click('#aow-resume-cta');
          // Establish the queue through the real action bar.
          await page.locator('.aow-spawn-btn').first().click();
          if (surface === 'settings') await page.click('#aow-settings-btn');
          else await page.click('#aow-pause-btn');
          const root = surface === 'settings' ? '#aow-diff-modal' : '#aow-diff';
          const label = `${width} ${surface} ${difficulty}`;
          const snapshot = () => page.evaluate(() => {
            window.dispatchEvent(new Event('pagehide'));
            return localStorage.getItem('aow-session');
          });
          const before = await snapshot();
          const queued = await page.locator('.aow-train-slot:not(.aow-train-empty)').count();
          ok(queued > 0 && JSON.parse(before).waveNum === 4, `${label}: established war has a training queue`);
          await page.click(`${root} [data-diff="${difficulty}"]`);
          ok(await snapshot() === before, `${label}: clicking selected difficulty preserves the entire saved war`);
          ok(await page.locator('.aow-train-slot:not(.aow-train-empty)').count() === queued,
            `${label}: queue remains intact`);
          const held = surface === 'settings'
            ? await page.locator('#aow-settings-modal').isVisible()
            : await page.locator('#aow-resume-cta').isVisible();
          ok(held, `${label}: existing pause/sheet remains in place`);
          if (held) {
            await page.locator(`${root} [data-diff="${difficulty}"]`).focus();
            await page.keyboard.press('Enter');
            ok(await snapshot() === before, `${label}: keyboard reselection also preserves the war`);
          }
          if (surface === 'settings' && !(await page.locator('#aow-settings-modal').isVisible())) {
            await page.click('#aow-settings-btn');
          }
          const next = difficulty === 'normal' ? 'hard' : 'easy';
          await page.click(`${root} [data-diff="${next}"]`);
          ok(await page.locator('.aow-train-slot:not(.aow-train-empty)').count() === 0,
            `${label}: a different difficulty still starts a new war`);
          ok(await page.evaluate(next => localStorage.getItem('aow-difficulty') === next, next),
            `${label}: changed difficulty persists`);
          ok(await page.locator(`${root} [data-diff="${next}"]`).evaluate(b => b.classList.contains('active')),
            `${label}: changed difficulty is selected`);
          await context.close();
        }
      }
    }
  } finally { await browser.close(); }
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

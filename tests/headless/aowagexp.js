/* Hook-free: Age Up XP feedback through supported saves, real Q input,
 * rendered canvas text, live button attributes and persisted state. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  for (const width of [1280, 768]) {
    for (const scenario of [
      { name: 'short', xp: 60, playerEra: 0 },
      { name: 'ready', xp: 100, playerEra: 0 },
      { name: 'locked', xp: 25000, playerEra: 4 },
      { name: 'max', xp: 100, playerEra: 5 },
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.clock.install();
      await page.addInitScript(seed => {
        localStorage.setItem('aow-welcome-seen', '1');
        localStorage.setItem('aow-session', JSON.stringify({
          v: 2, waveNum: 1, gold: 1000, xp: seed.xp, playerEra: seed.playerEra,
        }));
        window.renderedText = [];
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          window.renderedText.push(String(text));
          return fillText.call(this, text, ...args);
        };
      }, scenario);
      await page.goto(BASE + '/ageofwar/');
      await page.click('#aow-resume-cta');
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await page.evaluate(() => document.activeElement.blur());
      const age = page.locator('#aow-ageup-btn');
      const snapshot = () => page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        return JSON.parse(localStorage.getItem('aow-session'));
      });
      const label = `${width}/${scenario.name}`;
      if (scenario.name === 'short' || scenario.name === 'ready') {
        const expected = scenario.name === 'short'
          ? 'Need 40 more XP for Castle Age' : 'Ready to age up to Castle Age';
        ok(await age.getAttribute('title') === expected &&
          await age.getAttribute('aria-label') === expected, `${label}: live title and accessible label`);
        ok(await age.isDisabled() === (scenario.name === 'short'), `${label}: affordability controls disabled state`);
      }
      const before = await snapshot();
      await page.evaluate(() => { window.renderedText = []; });
      await page.keyboard.press('q');
      await page.clock.runFor(48);
      const after = await snapshot();
      const texts = await page.evaluate(() => window.renderedText);
      if (scenario.name === 'ready') {
        ok(after.playerEra === 1 && after.xp === 0, `${label}: Q ages up exactly once and spends exactly 100 XP`);
        ok(texts.includes('Welcome to the Castle Age'), `${label}: successful welcome unchanged`);
        ok(await age.getAttribute('title') === 'Need 480 more XP for Renaissance' &&
          await age.getAttribute('aria-label') === 'Need 480 more XP for Renaissance',
        `${label}: next-era shortfall replaces ready attributes`);
      } else {
        ok(after.xp === before.xp && after.playerEra === before.playerEra,
          `${label}: Q preserves XP and era`);
        if (scenario.name === 'short') {
          ok(texts.includes('Need 40 more XP for Castle Age'), `${label}: refused Q renders XP shortfall`);
          await page.clock.runFor(2600);
          await page.evaluate(() => { window.renderedText = []; });
          await page.clock.runFor(48);
          ok(!(await page.evaluate(() => window.renderedText.includes('Need 40 more XP for Castle Age'))),
            `${label}: shortfall banner expires`);
        } else if (scenario.name === 'locked') {
          ok(texts.includes('🔒 SINGULARITY — reach the Future Age once to unlock the sixth era'),
            `${label}: Singularity gate copy unchanged`);
        } else {
          ok(await age.isDisabled() && (await age.innerText()).includes('Max Age'),
            `${label}: Max Age stays disabled`);
          ok(!texts.some(text => /Need .*XP/.test(text)), `${label}: Max Age has no XP refusal`);
        }
      }
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

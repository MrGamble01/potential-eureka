/* Mason monument: supported saves and real minimap/canvas clicks, no hooks. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};
const stages = [
  { at: 12, name: 'The plinth is laid in the square' },
  { at: 30, name: 'The base is dressed and set' },
  { at: 55, name: 'The figure takes shape under the chisel' },
  { at: 90, name: 'The Monument is unveiled' },
];
const expected = cycles => {
  const next = stages.find(stage => cycles < stage.at);
  return next ? `${cycles} / ${next.at} cycles — next: ${next.name}` : stages[3].name;
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  for (const width of [1280, 768]) {
    const cases = [0, 11, 12, 20, 29, 30, 54, 55, 89, 90, 100].map(cycles => ({ cycles }));
    cases.push({ cycles: 20, type: 'quarry' }, { cycles: 20, done: false },
      { cycles: 11, live: true }, { cycles: 89, live: true });
    for (const { cycles, type = 'mason', done = true, live = false } of cases) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(({ cycles, type, done, live }) => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 1, time: 8, _prodAbs: live ? 27 : 32,
          seenIntro: true, muted: true, townName: 'Carvers', _nextId: 3,
          res: { wood: 40, stone: 40, food: 40, gold: 25 }, masonCycles: cycles,
          villagers: live ? [{ id: 2, jobId: 1, tx: 24, ty: 18, name: 'Mason' }] : [],
          buildings: [{ id: 1, type, tx: 28, ty: 21, done,
            buildTotal: done ? 0 : 100, buildLeft: done ? 0 : 100 }],
        }));
      }, { cycles, type, done, live });
      await page.goto(BASE + '/hearthvale.html');
      const snapshot = () => page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        const s = JSON.parse(localStorage.getItem('hearthvale-v1'));
        return { cycles: s.masonCycles, gold: s.res.gold };
      });
      const before = await snapshot();
      const mini = await page.locator('#minimap').boundingBox();
      await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
      await page.mouse.click(width / 2, 450);
      await page.locator('#panel.show').waitFor();
      const label = `${width} ${type} ${cycles}${done ? '' : ' construction'}${live ? ' live' : ''}`;
      ok(await page.locator('#p-name').textContent() === (type === 'mason' ? 'Stonemason' : 'Quarry'), `${label}: real clicks select building`);
      ok(JSON.stringify(await snapshot()) === JSON.stringify(before) && before.cycles === cycles && before.gold === 25,
        `${label}: opening inspector preserves cycles and gold`);
      if (type === 'mason' && done) {
        ok(await page.locator('#p-monument').textContent() === expected(cycles), `${label}: exact next threshold/stage or unveiled copy`);
        if (live) {
          const row = await page.locator('#p-monument').elementHandle();
          await page.waitForFunction(text => document.getElementById('p-monument')?.textContent === text, expected(cycles + 1));
          ok(await row.evaluate(el => el.isConnected), `${label}: cycle updates the open row without rebuilding panel`);
          ok((await snapshot()).cycles === cycles + 1, `${label}: displayed progress follows a real worked cycle`);
        }
      } else {
        ok(await page.locator('#p-monument').count() === 0 && !(await page.locator('#p-stats').textContent()).includes('Monument'),
          `${label}: no monument row`);
        if (!done) ok(await page.locator('#p-sub').textContent() === 'Under construction' &&
          await page.locator('#p-demolish').textContent() === 'Cancel', `${label}: construction view unchanged`);
      }
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `zero page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

/* Beacon inspector: supported saves, real minimap/canvas clicks, no game hooks. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  for (const width of [1280, 768]) {
    for (const scenario of [
      ...[0, 1, 3, 12].map(warns => ({ type: 'beacon', done: true, warns })),
      { type: 'well', done: true, warns: 3 },
      { type: 'beacon', done: false, warns: 3 },
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(({ type, done, warns }) => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 1, time: 8, seenIntro: true, muted: true,
          townName: 'Watchfire', _nextId: 2, beaconWarns: warns,
          res: { wood: 40, stone: 20, food: 30, gold: 25 }, villagers: [],
          buildings: [{ id: 1, type, tx: 28, ty: 21, level: 1,
            done, buildTotal: done ? 0 : 300, buildLeft: done ? 0 : 300 }],
        }));
      }, scenario);
      await page.clock.install();
      await page.goto(BASE + '/hearthvale.html');
      // Freeze browser time so construction cannot advance between snapshots.
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      const snapshot = () => page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        const s = JSON.parse(localStorage.getItem('hearthvale-v1'));
        return { beaconWarns: s.beaconWarns, gold: s.res.gold, buildings: s.buildings };
      });
      const before = await snapshot();
      const mini = await page.locator('#minimap').boundingBox();
      await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
      await page.mouse.click(width / 2, 450);
      const label = `${width} ${scenario.type} ${scenario.done ? 'finished' : 'site'} warns=${scenario.warns}`;
      ok(await page.locator('#panel').evaluate(el => el.classList.contains('show')) &&
        (await page.locator('#p-name').textContent()).includes(scenario.type === 'beacon' ? 'Beacon Tower' : 'Well'),
      `${label}: real clicks select the building`);
      const stats = await page.locator('#p-stats').textContent();
      if (scenario.type === 'beacon' && scenario.done) {
        ok(stats.includes('High roadCaravans are waylaid half as often'), `${label}: high road halves waylays`);
        const expected = scenario.warns === 0 ? 'Spots wolf packs a day out' :
          `Spotted ${scenario.warns} pack${scenario.warns === 1 ? '' : 's'} a night early`;
        ok(stats.includes('Watchfire' + expected), `${label}: watchfire shows current count or zero-state`);
      } else {
        ok(!/High road|Watchfire|waylaid|Spotted .*pack|Spots wolf packs/.test(stats), `${label}: no beacon rows`);
        if (!scenario.done) ok(await page.locator('#p-sub').textContent() === 'Under construction', `${label}: construction view preserved`);
      }
      ok(JSON.stringify(await snapshot()) === JSON.stringify(before), `${label}: inspection preserves warnings, gold and buildings`);
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

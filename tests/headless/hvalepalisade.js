/* Palisade inspector: supported saves and real minimap/canvas clicks, no hooks. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const source = fs.readFileSync(path.join(__dirname, '../../hearthvale.html'), 'utf8');
// Run the shipped watch helpers outside the page; no instrumentation or game hooks.
const watchCode = ['palisadeBuilt', 'guardStrength'].map(name => {
  const match = source.match(new RegExp(`  function ${name}\\(\\) \\{[\\s\\S]*?\\n  \\}`));
  if (!match) throw new Error(`Missing ${name}`);
  return match[0];
}).join('\n');
const definitions = Object.fromEntries(['palisade', 'watchtower', 'well'].map(type => {
  const line = source.match(new RegExp(`^    ${type}:.*$`, 'm'))[0];
  return [type, { guard: /guard: true/.test(line), palisade: /palisade: true/.test(line) }];
}));
const strength = save => vm.runInNewContext(watchCode + '\nguardStrength()', {
  BUILDINGS: definitions,
  state: { buildings: save.buildings.map(b => ({ ...b,
    staffed: save.jobs.some(v => v.jobId === b.id) })) },
});
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
      { type: 'palisade', done: true, towers: false, keepers: false, expected: 1 },
      { type: 'palisade', done: true, towers: true, keepers: false, expected: 1 },
      { type: 'palisade', done: true, towers: true, keepers: true, expected: 5 },
      { type: 'palisade', done: false, towers: false, keepers: false, expected: 0 },
      { type: 'well', done: true, towers: false, keepers: false, expected: 0 },
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(({ type, done, towers, keepers }) => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 1, time: 8, seenIntro: true, muted: true,
          townName: 'Sleepless', _nextId: 10, wallRaids: 2, raidsRepelled: 3,
          raidsSuffered: 1, nextRaidDay: 9, raidTonight: false, pelts: 4,
          res: { wood: 40, stone: 20, food: 30, gold: 25 },
          villagers: keepers ? [
            { id: 5, name: 'Ash', jobId: 2, tx: 20, ty: 21 },
            { id: 6, name: 'Elm', jobId: 3, tx: 24, ty: 21 },
          ] : [],
          buildings: [{ id: 1, type, tx: 28, ty: 21, level: 1,
            done, buildTotal: done ? 0 : 300, buildLeft: done ? 0 : 300 },
          ...(towers ? [
            { id: 2, type: 'watchtower', tx: 20, ty: 21, level: 1, done: true },
            { id: 3, type: 'watchtower', tx: 24, ty: 21, level: 3, done: true },
          ] : [])],
        }));
      }, scenario);
      await page.clock.install();
      const response = await page.goto(BASE + '/hearthvale.html');
      if (await response.text() !== source) throw new Error('Server must serve this working tree');
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      const snapshot = () => page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        const s = JSON.parse(localStorage.getItem('hearthvale-v1'));
        return { buildings: s.buildings, gold: s.res.gold,
          jobs: s.villagers.map(v => ({ id: v.id, jobId: v.jobId })),
          wallRaids: s.wallRaids, raidsRepelled: s.raidsRepelled,
          raidsSuffered: s.raidsSuffered, raidTonight: s.raidTonight,
          nextRaidDay: s.nextRaidDay, pelts: s.pelts, bellSaves: s.bellSaves,
          beaconWarns: s.beaconWarns };
      });
      const before = await snapshot();
      const mini = await page.locator('#minimap').boundingBox();
      await page.mouse.click(mini.x + mini.width * 28.5 / 56, mini.y + mini.height * 21.5 / 42);
      await page.mouse.click(width / 2, 450);
      const label = `${width} ${scenario.type} ${scenario.done ? 'finished' : 'site'} towers=${scenario.towers} keepers=${scenario.keepers}`;
      ok(await page.locator('#panel').evaluate(el => el.classList.contains('show')) &&
        await page.locator('#p-name').textContent() === (scenario.type === 'palisade' ? 'Palisade' : 'Well'),
      `${label}: real clicks select the building`);
      const watch = strength(before);
      ok(watch === scenario.expected, `${label}: seeded watch is ${scenario.expected}`);
      const stats = await page.locator('#p-stats').textContent();
      if (scenario.type === 'palisade' && scenario.done) {
        ok(stats.includes('Sleepless watch+1 guard that never sleeps — needs no keeper'), `${label}: sleepless watch needs no keeper`);
        ok(stats.includes(`Town watch${watch} — includes this finished wall’s +1`), `${label}: town watch matches guardStrength with wall counted`);
      } else {
        ok(!/Sleepless watch|Town watch|needs no keeper|finished wall/.test(stats), `${label}: no finished palisade rows`);
        if (!scenario.done) ok(await page.locator('#p-sub').textContent() === 'Under construction' &&
          /Progress.*Builder/.test(stats) && await page.locator('#p-demolish').textContent() === 'Cancel',
        `${label}: construction view preserved`);
      }
      ok(JSON.stringify(await snapshot()) === JSON.stringify(before), `${label}: inspection preserves buildings, gold and watch state`);
      await context.close();
    }
  }
  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

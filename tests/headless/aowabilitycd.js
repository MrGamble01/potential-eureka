/* Hook-free: production session saves, real buttons/keys, clock and canvas text. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};
const abilities = [
  ['warcry', 'w', 'warcryCd', 'warcries', '🎺 Horns cooling'],
  ['trench', 't', 'trenchCd', 'trenches', '⛏️ Trench cooling'],
  ['merc', 'm', 'mercCd', 'mercs', '🪖 Mercs cooling'],
  ['repair', 'r', 'sapperCd', 'repairs', '🛠️ Sappers cooling'],
  ['bolt', 'b', 'boltCd', 'bolts', '🏹 Ballista cooling'],
];
const enemy = { side: 'enemy', key: 'swordsman', x: 950, hp: 10000, hpMax: 10000, dmg: 0 };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  for (const width of [1280, 768]) {
    let context, page;
    const seed = async (extra = {}) => {
      if (context) await context.close();
      context = await browser.newContext({ viewport: { width, height: 900 } });
      page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000));
      await page.addInitScript(snap => {
        localStorage.setItem('aow-welcome-seen', '1');
        localStorage.setItem('aow-session', JSON.stringify(snap));
        window.renderedText = [];
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          window.renderedText.push(String(text));
          return fillText.call(this, text, ...args);
        };
      }, {
        v: 2, waveNum: 1, waveBreatherT: 8, gold: 10000, playerEra: 2,
        // Existing Warcry timers tick inside the Special-cooling branch.
        specialReadyT: 60, playerBaseHp: 800, playerBaseMax: 1500, units: [enemy], ...extra,
      });
      await page.goto(BASE + '/ageofwar/');
      await page.click('#aow-resume-cta');
      await page.clock.runFor(100);
      await page.evaluate(() => document.activeElement.blur());
    };
    const snapshot = () => page.evaluate(() => {
      window.dispatchEvent(new Event('beforeunload'));
      return JSON.parse(localStorage.getItem('aow-session'));
    });
    const act = async (id, key, mode) => {
      await page.evaluate(() => { window.renderedText = []; });
      if (mode === 'click') await page.click(`#aow-${id}-btn`);
      else await page.keyboard.press(key);
    };
    const textHas = text => page.evaluate(text => window.renderedText.includes(text), text);
    const unchanged = (before, after) => {
      const stats = s => Object.fromEntries(Object.entries(s.runStats).filter(([key]) => key !== 'time'));
      return before.gold === after.gold && before.playerBaseHp === after.playerBaseHp &&
        JSON.stringify(stats(before)) === JSON.stringify(stats(after)) &&
        before.units.length === after.units.length &&
        JSON.stringify(before.trainingQueue) === JSON.stringify(after.trainingQueue) &&
        ['warcryT', 'trenchT', ...abilities.map(a => a[2])].every(key =>
          after[key] <= before[key] && before[key] - after[key] < 0.1);
    };
    for (const [id, key, cd, stat, label] of abilities) {
      await seed({ [cd]: 4.6 });
      let previousSeconds = Infinity;
      for (const mode of ['click', 'key']) {
        const before = await snapshot();
        await act(id, key, mode);
        const immediate = await snapshot();
        ok(unchanged(before, immediate), `${width}/${id}/${mode}: refusal immediately preserves resources, stats and timers`);
        await page.clock.runFor(48);
        const after = await snapshot();
        const seconds = Math.ceil(before[cd]);
        ok(await textHas(`${label} — ${seconds}s`), `${width}/${id}/${mode}: rounded-up ${seconds}s on field`);
        ok(unchanged(before, after) && after[cd] < before[cd], `${width}/${id}/${mode}: only natural tick after refusal`);
        ok(seconds < previousSeconds, `${width}/${id}/${mode}: countdown decreases`);
        previousSeconds = seconds;
        await page.clock.runFor(1500);
      }
      // Let the seeded cooldown expire, then exercise each ready input independently.
      await page.clock.runFor(1600);
      for (const mode of ['click', 'key']) {
        if (mode === 'key') await seed();
        const before = await snapshot();
        await act(id, key, mode);
        await page.clock.runFor(48);
        const after = await snapshot();
        ok(after.runStats[stat] === (before.runStats[stat] || 0) + 1 && after[cd] > 10,
          `${width}/${id}/${mode}: ready cast fires once and rearms`);
        ok(!await page.evaluate(() => window.renderedText.some(t => /cooling|Warcry roaring/.test(t))),
          `${width}/${id}/${mode}: ready cast has no refusal`);
        ok(id === 'merc' ? after.units.length === before.units.length + 2 && after.gold < before.gold
          : id === 'repair' ? after.playerBaseHp === before.playerBaseHp + 375 && after.gold === before.gold - 375
          : id === 'bolt' ? after.gold === before.gold - 200 && after.units[0].hp === before.units[0].hp - 120
          : after.gold === before.gold && after[id === 'warcry' ? 'warcryT' : 'trenchT'] > 0,
        `${width}/${id}/${mode}: normal cast effect and price`);
      }
    }
    for (const cd of [0, 12]) {
      await seed({ warcryT: 4.6, warcryCd: cd });
      for (const mode of ['click', 'key']) {
        const before = await snapshot();
        await act('warcry', 'w', mode);
        await page.clock.runFor(48);
        ok(await textHas(`🎺 Warcry roaring — ${Math.ceil(before.warcryT)}s`) && unchanged(before, await snapshot()),
          `${width}/active/${cd}/${mode}: active wait takes priority, no restart`);
        await page.clock.runFor(1500);
      }
    }
    const priority = [
      ['warcry', 'w', { playerEra: 0, warcryCd: 12, warcryT: 3 }, '🎺 The horns are forged in Age II'],
      ['trench', 't', { playerEra: 0, trenchCd: 12 }, '⛏️ Trenchworks come with Age II'],
      ['repair', 'r', { playerEra: 0, sapperCd: 12 }, '🛠️ The sapper corps musters in Age II'],
      ['bolt', 'b', { playerEra: 1, boltCd: 12 }, '🏹 The ballista is winched in Age III'],
      ['merc', 'm', { gold: 0, mercCd: 12 }, /The mercs want \d+ gold/],
      ['merc', 'm', { mercCd: 12, units: Array.from({ length: 150 }, () => ({ ...enemy, side: 'player', x: 100 })) }, '🪖 The ranks are full'],
      ['repair', 'r', { playerBaseHp: 1500, sapperCd: 12 }, '🛠️ The walls stand whole'],
      ['repair', 'r', { gold: 0, sapperCd: 12 }, '🛠️ The sappers want 375 gold'],
      ['bolt', 'b', { units: [], boltCd: 12 }, '🏹 No line to skewer'],
      ['bolt', 'b', { gold: 0, boltCd: 12 }, '🏹 The bolt costs 200 gold'],
    ];
    for (const [id, key, extra, expected] of priority) {
      await seed(extra);
      const before = await snapshot();
      await act(id, key, 'key');
      await page.clock.runFor(48);
      const texts = await page.evaluate(() => window.renderedText);
      ok(texts.some(t => expected instanceof RegExp ? expected.test(t) : t === expected) &&
        !texts.some(t => /cooling|Warcry roaring/.test(t)) && unchanged(before, await snapshot()),
      `${width}/${id}: existing refusal wins: ${expected}`);
    }
    await context.close();
  }
  await browser.close();
  ok(errors.length === 0, `zero page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

/* Hook-free: supported session saves, real controls/keys, page clock and canvas output. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const riding = '🎲 A wager already rides this clash';
const absent = '⚔ No warlord on the field to challenge';
const warlord = { side: 'enemy', key: 'club', x: 950, hp: 1000, hpMax: 1000,
  warlord: 'Gorlok the Brute' };
const champion = { side: 'player', key: 'club', x: 200, hp: 1000, hpMax: 1000 };
const cases = [
  { name: 'riding wager', control: 'iron', key: 'u', seed: { ironBet: { stake: 200, hpAtBet: 1500 } }, text: riding },
  { name: 'absent warlord', control: 'duel', key: 'c', seed: { units: [champion] }, text: absent },
  { name: 'first wager', control: 'iron', seed: {}, text: '🎲 200 gold says the walls hold this wave', cost: 200 },
  { name: 'wager age gate', control: 'iron', key: 'u', keyOnly: true, seed: { playerEra: 0, ironBet: { stake: 200, hpAtBet: 1500 } }, text: '🎲 The herald takes wagers from Age II' },
  { name: 'wager short gold', control: 'iron', seed: { gold: 0 }, text: '🎲 The wager is 200 gold' },
  { name: 'absent champion', control: 'duel', seed: { gold: 0, units: [warlord] }, text: '⚔ No champion stands to answer' },
  { name: 'duel short gold', control: 'duel', seed: { gold: 0, units: [warlord, champion] }, text: '⚔ The duel purse is 250 gold' },
  { name: 'funded duel', control: 'duel', seed: { units: [warlord, champion] }, cost: 250 },
];
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  let passed = 0;
  try {
    for (const width of [1280, 768]) for (const test of cases) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.clock.install();
      await page.addInitScript(seed => {
        localStorage.setItem('aow-welcome-seen', '1');
        localStorage.setItem('aow-session', JSON.stringify({
          v: 2, waveNum: 1, gold: 1000, playerEra: 2, units: [], ...seed,
        }));
        window.renderedText = [];
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          window.renderedText.push(String(text));
          return fillText.call(this, text, ...args);
        };
      }, test.seed);
      await page.goto(BASE + '/ageofwar/');
      await page.click('#aow-resume-cta');
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      const snapshot = () => page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        return JSON.parse(localStorage.getItem('aow-session'));
      });
      for (const input of test.keyOnly ? ['key'] : test.key ? ['click', 'key'] : ['click']) {
        const control = page.locator(`#aow-${test.control}-btn`);
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= width, 'control visible');
        await page.evaluate(() => { window.renderedText = []; document.activeElement.blur(); });
        const before = await snapshot();
        if (input === 'click') {
          assert(await control.isEnabled(), 'real control accepts refusal clicks');
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        } else await page.keyboard.press(test.key);
        // Read immediately while time is frozen: passive income cannot mask a charge.
        const after = await snapshot();
        assert.equal(after.gold, before.gold - (test.cost || 0), 'exact purse change');
        if (test.cost === 200) assert.deepEqual(after.ironBet, { stake: 200, hpAtBet: before.playerBaseHp });
        else assert.deepEqual(after.ironBet, before.ironBet, 'existing wager unchanged');
        assert.equal(after.runStats.duels, before.runStats.duels + (test.cost === 250 ? 1 : 0));
        if (test.cost === 250) assert(after.units.some(unit => unit.warlord && unit.dueled), 'warlord answers once');
        await page.clock.runFor(48);
        const texts = await page.evaluate(() => window.renderedText);
        if (test.text) assert(texts.includes(test.text), `renders ${test.text}`);
        if (test.text !== riding) assert(!texts.includes(riding), 'no incorrect wager refusal');
        if (test.text !== absent) assert(!texts.includes(absent), 'no incorrect duel refusal');
        console.log(`PASS ${width}/${test.name}/${input}: feedback and state`);
        passed++;
        await page.clock.runFor(1500);
      }
      await context.close();
    }
    assert.deepEqual(errors, [], 'zero page errors');
    console.log(`${passed} cases passed; zero page errors`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

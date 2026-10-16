/* Hearthvale's first goal used to say "Build a second cottage" while the
 * valley still had zero houses. A new town has no cottage to add a second
 * one onto, and the panel never printed the count, so the bar sat empty
 * with no way to see 0/2. Hook-free: real welcome, one placement click,
 * and ordinary saves.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};

function town(extra) {
  return JSON.stringify(Object.assign({
    seed: 12345, day: 1, time: 8, seenIntro: true, muted: true,
    townName: 'Goaltest', goalIndex: 0, _nextId: 10,
    res: { wood: 40, stone: 20, food: 30, gold: 25 },
    villagers: [], buildings: [],
  }, extra));
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];

  // Fresh valley: the words and the count both start at zero houses.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load' });
    await page.click('#welcome-close');
    const goal = (await page.locator('#goal-text').innerText()).replace(/\s+/g, ' ').trim();
    ok(goal === 'Build two cottages (0/2)', 'fresh valley asks for two cottages at 0/2, got: ' + goal);
    ok(!/second cottage/i.test(goal), 'fresh valley does not ask for a second cottage');
    const wood0 = Number(await page.locator('#r-wood').innerText());
    await page.click('#buildbar button[data-type="house"]');
    const box = await page.locator('#view canvas, canvas').first().boundingBox();
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.35);
    await page.waitForTimeout(400);
    const wood1 = Number(await page.locator('#r-wood').innerText());
    ok(wood0 - wood1 === 12, 'one click spends 12 wood on a cottage (' + wood0 + ' → ' + wood1 + ')');
    const whileBuilding = (await page.locator('#goal-text').innerText()).replace(/\s+/g, ' ').trim();
    ok(whileBuilding === 'Build two cottages (0/2)', 'an unfinished site does not count, got: ' + whileBuilding);
    await page.click('#speedctl button[data-sp="3"]');
    let finished = '';
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(500);
      finished = (await page.locator('#goal-text').innerText()).replace(/\s+/g, ' ').trim();
      if (finished.includes('(1/2)')) break;
    }
    const pop = await page.locator('#r-pop').innerText();
    ok(finished === 'Build two cottages (1/2)', 'the first finished cottage is 1/2, got: ' + finished);
    ok(pop === '2', 'the finished cottage houses 2 villagers, got: ' + pop);
    await context.close();
  }

  // Two finished cottages already standing: the reward pays and the farm is next.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(saved => localStorage.setItem('hearthvale-v1', saved), town({
      buildings: [
        { id: 1, type: 'house', tx: 10, ty: 20, done: true, level: 1 },
        { id: 2, type: 'house', tx: 14, ty: 20, done: true, level: 1 },
      ],
    }));
    await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const goal = (await page.locator('#goal-text').innerText()).replace(/\s+/g, ' ').trim();
    const gold = Number(await page.locator('#r-gold').innerText());
    ok(goal === 'Build a farm to grow food (0/1)', 'two cottages advance the goal to a farm, got: ' + goal);
    ok(gold === 45, 'the cottage goal pays 20 gold (25 → 45), got: ' + gold);
    await context.close();
  }

  await browser.close();
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

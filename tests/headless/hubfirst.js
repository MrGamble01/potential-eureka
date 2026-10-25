const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function names(page) {
  return page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForSelector('#view-arcade.active .arcade-hero-kicker');
    const cold = await names(page);
    ok(!cold.some((n) => n.includes('/js/snake.js')), 'hub does not fetch Snake');
    ok(!cold.some((n) => n.includes('games.css')), 'hub does not fetch the game sheet');
    ok(!cold.some((n) => n.includes('dashboard.css')), 'hub does not fetch the dashboard sheet');
    const found = await page.evaluate(() => {
      const search = document.getElementById('card-search');
      const r = search.getBoundingClientRect();
      search.value = 'snake';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const cards = [...document.querySelectorAll('.arcade-grid .arcade-card')].filter((c) => c.style.display !== 'none');
      const snake = cards.find((c) => (c.getAttribute('href') || '') === '#snake');
      search.value = 'ashmarch';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const again = [...document.querySelectorAll('.arcade-grid .arcade-card')].filter((c) => c.style.display !== 'none');
      const ash = again.find((c) => /ashmarch/i.test(c.getAttribute('href') || ''));
      search.value = 'snip';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const hidden = [...document.querySelectorAll('.arcade-grid .arcade-card')].filter((c) => c.style.display !== 'none');
      return {
        onScreen: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 40,
        snake: !!(snake && cards.length === 1),
        ash: !!(ash && again.length === 1),
        snip: hidden.length,
        cards: document.querySelectorAll('#view-arcade .arcade-card').length,
      };
    });
    ok(found.cards === 8, 'catalogue lists the eight keepers (' + found.cards + ')');
    ok(found.onScreen, 'search sits on the first screen');
    ok(found.snake, 'search finds Snake');
    ok(found.ash, 'search finds Ashmarch');
    ok(found.snip === 0, 'search does not list Snip');
    const verbs = await page.evaluate(() => {
      const search = document.getElementById('card-search');
      const hit = (q) => {
        search.value = q;
        search.dispatchEvent(new Event('input', { bubbles: true }));
        return [...document.querySelectorAll('.arcade-grid .arcade-card')]
          .filter((c) => c.style.display !== 'none')
          .map((c) => c.getAttribute('href') || '');
      };
      return {
        tetris: hit('tetris'),
        mine: hit('mine'),
        snip: hit('snip'),
        ledger: hit('ledger'),
        grow: hit('hearthvale'),
      };
    });
    ok(verbs.tetris.length === 1 && verbs.tetris[0] === '#tetris', 'search finds Tetris by name');
    ok(verbs.mine.length === 1 && verbs.mine[0] === '#minesweeper', 'search finds Minefield by mine');
    ok(verbs.snip.length === 0 && verbs.ledger.length === 0 && verbs.grow.length === 0,
      'search hides the unlisted games');

    const deep = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    deep.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await deep.goto(BASE + '/#snake', { waitUntil: 'load' });
    await deep.waitForSelector('#view-snake.active #snake-canvas', { timeout: 15000 });
    const snakeJs = await names(deep);
    ok(snakeJs.some((n) => n.includes('/js/snake.js')), 'deep link fetches Snake');
    ok(snakeJs.some((n) => n.includes('games.css')), 'deep link fetches the game sheet');
    await deep.goto(BASE + '/#snip', { waitUntil: 'load' });
    await deep.waitForSelector('#view-snip.active #snip-canvas', { timeout: 15000 });
    ok((await deep.locator('#snip-score').innerText()).trim() === '0', 'Snip deep link opens at zero');
    await deep.close();
    await page.close();
  } finally {
    await browser.close();
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

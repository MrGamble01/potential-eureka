/*
 * Blur parks a live clock. Focus lets it run. A pause the player
 * chose stays paused, and the score's playing flag stays put.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function cashOf(text) {
  return Number(String(text || '').replace(/\D/g, '')) || 0;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    const ledger = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    ledger.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    ledger.setDefaultTimeout(15000);
    await ledger.addInitScript(() => localStorage.removeItem('ledger-v1'));
    await ledger.goto(BASE + '/games/ledger/index.html', { waitUntil: 'load' });
    await ledger.locator('#haul').selectOption('mara');
    await ledger.locator('#drop').selectOption('ivo');
    await ledger.waitForFunction(() => {
      const cash = document.getElementById('cash');
      return cash && Number((cash.textContent || '').replace(/\D/g, '')) > 100;
    });
    const mid = cashOf(await ledger.locator('#cash').innerText());
    await ledger.evaluate(() => window.dispatchEvent(new Event('blur')));
    await ledger.waitForTimeout(1000);
    const frozen = cashOf(await ledger.locator('#cash').innerText());
    const held = await ledger.evaluate(() => window.EurekaFocus.held());
    const label = (await ledger.locator('#pause').innerText()).trim();
    ok(frozen === mid && held && label === 'Pause',
      'blur freezes the book without arming Resume (' + mid + ' → ' + frozen + ', ' + label + ')');
    await ledger.evaluate(() => window.dispatchEvent(new Event('focus')));
    await ledger.waitForFunction((floor) => {
      const cash = document.getElementById('cash');
      return cash && Number((cash.textContent || '').replace(/\D/g, '')) > floor;
    }, mid);
    ok(!(await ledger.evaluate(() => window.EurekaFocus.held())), 'focus lets the book pay again');

    await ledger.locator('#pause').click();
    const pausedAt = cashOf(await ledger.locator('#cash').innerText());
    await ledger.evaluate(() => window.dispatchEvent(new Event('blur')));
    await ledger.waitForTimeout(700);
    await ledger.evaluate(() => window.dispatchEvent(new Event('focus')));
    await ledger.waitForTimeout(900);
    const still = cashOf(await ledger.locator('#cash').innerText());
    ok(still === pausedAt && (await ledger.locator('#pause').innerText()).trim() === 'Resume',
      'a chosen pause survives focus (' + pausedAt + ')');
    await ledger.locator('#pause').click();
    await ledger.waitForFunction((floor) => {
      const cash = document.getElementById('cash');
      return cash && Number((cash.textContent || '').replace(/\D/g, '')) > floor;
    }, pausedAt);
    ok((await ledger.locator('#pause').innerText()).trim() === 'Pause', 'Resume starts the book again');

    await ledger.locator('#restart').click();
    await ledger.locator('#restart').click();
    ok(cashOf(await ledger.locator('#cash').innerText()) === 100, 'restart returns the founder to $100');
    await ledger.close();

    const snake = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    snake.on('pageerror', (e) => errs.push('snake ' + String(e).slice(0, 200)));
    await snake.goto(BASE + '/#snake', { waitUntil: 'load' });
    await snake.waitForSelector('#snake-canvas');
    await snake.keyboard.press('ArrowRight');
    await snake.waitForTimeout(250);
    const before = await snake.evaluate(() => {
      const c = document.getElementById('snake-canvas');
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 64) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    });
    await snake.evaluate(() => window.dispatchEvent(new Event('blur')));
    await snake.waitForTimeout(600);
    const parked = await snake.evaluate(() => {
      const c = document.getElementById('snake-canvas');
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 64) hash = Math.imul(hash ^ data[i], 16777619);
      return { hash: hash >>> 0, held: window.EurekaFocus.held() };
    });
    ok(parked.held && parked.hash === before, 'blur holds the snake board');
    await snake.evaluate(() => window.dispatchEvent(new Event('focus')));
    await snake.waitForTimeout(500);
    const moved = await snake.evaluate(() => {
      const c = document.getElementById('snake-canvas');
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 64) hash = Math.imul(hash ^ data[i], 16777619);
      return { hash: hash >>> 0, held: window.EurekaFocus.held() };
    });
    ok(!moved.held && moved.hash !== before, 'focus lets the snake move');
    await snake.close();

    const tycoon = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    tycoon.on('pageerror', (e) => errs.push('tycoon ' + String(e).slice(0, 200)));
    await tycoon.addInitScript(() => {
      localStorage.setItem('tycoon:tipsEnabled', '0');
      localStorage.setItem('tycoon:welcomeSeen-v1', '1');
    });
    await tycoon.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
    await tycoon.waitForFunction(() => window.EurekaFocus && window.EurekaAudio, null, { timeout: 20000 });
    const score = await tycoon.evaluate(() => {
      const a = window.EurekaAudio;
      a.start('calm');
      const before = a.playing();
      window.dispatchEvent(new Event('blur'));
      const mid = a.playing();
      const held = window.EurekaFocus.held();
      window.dispatchEvent(new Event('focus'));
      return { before: before, mid: mid, after: a.playing(), held: held, back: window.EurekaFocus.held() };
    });
    ok(score.before && score.mid && score.after && score.held && !score.back,
      'blur parks the office score without clearing play (' + JSON.stringify(score) + ')');
    const canvases = await tycoon.evaluate(() => document.querySelectorAll('body > canvas').length);
    ok(canvases === 1, 'the office still has one body canvas (' + canvases + ')');
    await tycoon.close();
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

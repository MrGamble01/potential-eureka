/* Hook-free: Ink Board coats the starter-room whiteboard.
 * A bare office keeps the white slab on the west wall.
 * Shown cash and the deal prices stay on the same numbers.
 * The string lights and the war-room budget are different things.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ROOT = path.join(__dirname, '..', '..');

(async () => {
  const play = fs.readFileSync(path.join(ROOT, 'tycoon/play.html'), 'utf8');
  const board = play.slice(play.indexOf('// Whiteboard on the west wall'), play.indexOf('// Whiteboard on the west wall') + 2200);
  assert.match(play, /engCostScale:\s+1\.45/, 'engineer cost scale stays 1.45');
  assert.match(play, /featurePriceBase:\s+8/, 'feature price stays 8');
  assert.match(play, /ceoDeskRange:\s+2\.0/, 'CEO desk range stays 2.0');
  assert.match(play, /id: 'left', gx: -1, gz: 0, cost: 150/, 'engineering pod still costs 150');
  assert.match(play, /WAR_SECS = 90/, 'war room still runs 90 seconds');
  assert.match(play, /WAR_WORK_MULT = 1\.5/, 'war room multiplier stays 1.5');
  assert.match(play, /color: 0xffdd66, emissive: 0xffcc44/, 'the north-wall string lights stay gold');
  assert.match(board, /color: 0xf8f8f5/, 'a bare whiteboard is still the white slab');
  assert.match(board, /name = 'starter-board-ink'/, 'the shop coat is built with the starter board');
  assert.doesNotMatch(play, /window\.__/, 'no test hook on the office');
  console.log('PASS deal numbers and the bare slab stay put');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    async function office(wear) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.addInitScript((seed) => {
        localStorage.setItem('startup-tycoon-v7', JSON.stringify({
          cash: 0,
          allTimeCash: 1,
          v: 7,
          savedAt: Date.now(),
          offlineRatePerSec: 0,
          ownedRooms: ['starter'],
        }));
        localStorage.setItem('tycoon:tipsEnabled', '0');
        if (seed.wear) {
          localStorage.setItem('eureka-progress', JSON.stringify({
            v: 1,
            games: {},
            career: {
              sparks: 80,
              owned: { 'board-ink': 1 },
              equipped: { board: 'board-ink' },
            },
          }));
        } else {
          localStorage.removeItem('eureka-progress');
        }
      }, { wear: wear });
      await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
      await page.waitForSelector('canvas[data-engine]');
      await page.waitForFunction(() => {
        const n = parseInt(document.querySelector('#cash-val').textContent, 10);
        return n >= 100;
      });
      const shown = await page.evaluate(() => ({
        cash: parseInt(document.querySelector('#cash-val').textContent, 10),
        board: window.EurekaCosmetics && window.EurekaCosmetics.look().board,
      }));
      await page.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden !important}' });
      await page.waitForTimeout(400);
      const png = await page.locator('canvas[data-engine]').screenshot({ type: 'png' });
      const count = await page.evaluate(async (url) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          // Unlit shop coat #ff4fd8. The capture keeps that hex.
          if (r >= 240 && g >= 55 && g <= 105 && b >= 190 && b <= 235 && r > g + 130) n++;
        }
        return n;
      }, 'data:image/png;base64,' + png.toString('base64'));
      return { page: page, shown: shown, count: count };
    }

    const bare = await office(false);
    const worn = await office(true);
    console.log('bare', bare.count, 'worn', worn.count);
    console.log('cash', bare.shown.cash, worn.shown.cash, 'look', worn.shown.board && worn.shown.board.id);

    assert.equal(bare.shown.board, null, 'bare office wears no ink board');
    assert.equal(worn.shown.board && worn.shown.board.id, 'board-ink', 'worn office reads ink board');
    assert.equal(worn.shown.board.accent, '#ff4fd8', 'worn board keeps the shop accent');
    assert.equal(bare.count, 0, 'bare whiteboard has no shop coat');
    assert.ok(worn.count >= 20, 'the starter board shows the coat (' + worn.count + ')');
    assert.equal(bare.shown.cash, worn.shown.cash, 'wearing the coat does not change the purse');
    assert.ok(bare.shown.cash >= 100 && bare.shown.cash < 1000, 'cash stays an integer purse');
    assert.deepEqual(errors, [], 'zero page errors');
    console.log('PASS ink board ' + worn.count + ' coat pixels, cash ' + bare.shown.cash);
    await bare.page.close();
    await worn.page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

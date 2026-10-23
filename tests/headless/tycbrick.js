/* Hook-free: Kiln Course tints the dark accent bricks on the starter
 * north wall. A bare office keeps 0x5a2a1a. The gold string lights,
 * the wall body, and the grout stay on their own colors.
 * Shown cash and the deal prices stay on the same numbers.
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
  const course = play.slice(
    play.indexOf('// A few accent "dark bricks" scattered'),
    play.indexOf('// A few accent "dark bricks" scattered') + 1800
  );
  const lights = play.slice(
    play.indexOf('// String lights along the north wall'),
    play.indexOf('// String lights along the north wall') + 700
  );
  assert.match(play, /engCostScale:\s+1\.45/, 'engineer cost scale stays 1.45');
  assert.match(play, /featurePriceBase:\s+8/, 'feature price stays 8');
  assert.match(play, /ceoDeskRange:\s+2\.0/, 'CEO desk range stays 2.0');
  assert.match(play, /id: 'left', gx: -1, gz: 0, cost: 150/, 'engineering pod still costs 150');
  assert.match(play, /brickWallG\.position\.set\(0, 1\.6, -7\.85\)/, 'the accent wall stays on the north side');
  assert.match(play, /color: 0x7a3a26/, 'the wall body stays the same brick');
  assert.match(play, /color: 0x2a1a10/, 'the grout stays dark');
  assert.match(course, /new THREE\.MeshLambertMaterial\(\{ color: 0x5a2a1a \}\)/, 'a bare course is still the dark accent');
  assert.match(course, /new THREE\.BoxGeometry\(0\.6, 0\.18, 0\.04\)/, 'the accent bricks stay the same size');
  assert.match(course, /\(Math\.random\(\) - 0\.5\) \* 14, \(Math\.random\(\) - 0\.5\) \* 2\.6, 0\.03/, 'the accent bricks stay scattered');
  assert.match(course, /name = 'starter-brick-shop'/, 'the shop face is built on the accent course');
  assert.match(lights, /color: 0xffdd66, emissive: 0xffcc44, emissiveIntensity: 0\.75/, 'the string lights stay the gold bulbs');
  assert.match(lights, /-7 \+ i \* 1\.27, 2\.85 \+ Math\.sin\(i \* 0\.9\) \* 0\.12, -7\.6/, 'the bulbs stay on the north wall');
  assert.doesNotMatch(lights, /festoon|MeshBasicMaterial/, 'this slice does not retint the string lights');
  assert.doesNotMatch(play, /festoon-fair|note-booth|board-ink|stand-hearth|lamp-founder|pendant-tide|tarp-ward|kitchen-supper|tent-lantern|glass-amber/, 'this slice does not add the other shop looks');
  assert.doesNotMatch(play, /window\.__/, 'no test hook on the office');
  console.log('PASS deal numbers, the bare course, and the gold string stay put');

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
              owned: { 'brick-kiln': 1 },
              equipped: { brick: 'brick-kiln' },
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
        brick: window.EurekaCosmetics && window.EurekaCosmetics.look().brick,
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
          // Unlit shop face #46f0ff. The capture keeps that hex.
          if (r >= 45 && r <= 100 && g >= 220 && b >= 240 && b > r + 140 && g > r + 120) n++;
        }
        return n;
      }, 'data:image/png;base64,' + png.toString('base64'));
      return { page: page, shown: shown, count: count };
    }

    const bare = await office(false);
    const worn = await office(true);
    console.log('bare', bare.count, 'worn', worn.count);
    console.log('cash', bare.shown.cash, worn.shown.cash, 'look', worn.shown.brick && worn.shown.brick.id);

    assert.equal(bare.shown.brick, null, 'bare office wears no kiln course');
    assert.equal(worn.shown.brick && worn.shown.brick.id, 'brick-kiln', 'worn office reads the kiln course');
    assert.equal(worn.shown.brick.accent, '#46f0ff', 'worn course keeps the shop accent');
    assert.equal(bare.count, 0, 'bare north wall has no shop face');
    assert.ok(worn.count >= 200, 'the accent course shows the shop face (' + worn.count + ')');
    assert.equal(bare.shown.cash, worn.shown.cash, 'wearing the course does not change the purse');
    assert.ok(bare.shown.cash >= 100 && bare.shown.cash < 1000, 'cash stays an integer purse');
    assert.deepEqual(errors, [], 'zero page errors');
    console.log('PASS kiln course ' + worn.count + ' face pixels, cash ' + bare.shown.cash);
    await bare.page.close();
    await worn.page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

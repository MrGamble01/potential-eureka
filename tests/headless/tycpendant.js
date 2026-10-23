/* Hook-free: Tide Glass tints the ceiling pendant buildRoom hangs
 * in every Startup Tycoon room. A bare office keeps the brass cone.
 * Shown cash and the room prices stay on the same numbers.
 * The desk lamp is a different slot and is not this look.
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
  const room = play.slice(play.indexOf('function buildRoom'), play.indexOf('function buildRoom') + 6500);
  assert.match(play, /engCostScale:\s+1\.45/, 'engineer cost scale stays 1.45');
  assert.match(play, /featurePriceBase:\s+8/, 'feature price stays 8');
  assert.match(play, /ceoDeskRange:\s+2\.0/, 'CEO desk range stays 2.0');
  assert.match(play, /id: 'left', gx: -1, gz: 0, cost: 150/, 'engineering pod still costs 150');
  assert.match(play, /id: 'front', gx: 0, gz: 1, cost: 1200/, 'open plan still costs 1200');
  assert.match(play, /new THREE\.PointLight\(0xfff9f0, 0\.35, 24\)/, 'the room light stays the same lamp');
  assert.match(room, /color: 0xf2c47a, emissive: 0xf2b05a, emissiveIntensity: 0\.35/, 'a bare pendant is still the brass cone');
  assert.match(room, /name = 'room-pendant-glass'/, 'the shop rim is built with the room');
  assert.doesNotMatch(play, /lamp-founder|ceo-lamp/, 'this slice does not add the desk lamp');
  assert.doesNotMatch(play, /window\.__/, 'no test hook on the office');
  console.log('PASS deal numbers and the bare cone stay put');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    async function office(wear, rooms) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.addInitScript((seed) => {
        localStorage.setItem('startup-tycoon-v7', JSON.stringify({
          cash: 0,
          allTimeCash: 1,
          v: 7,
          savedAt: Date.now(),
          offlineRatePerSec: 0,
          ownedRooms: seed.rooms,
        }));
        localStorage.setItem('tycoon:tipsEnabled', '0');
        if (seed.wear) {
          localStorage.setItem('eureka-progress', JSON.stringify({
            v: 1,
            games: {},
            career: {
              sparks: 80,
              owned: { 'pendant-tide': 1 },
              equipped: { pendant: 'pendant-tide' },
            },
          }));
        } else {
          localStorage.removeItem('eureka-progress');
        }
      }, { wear: wear, rooms: rooms });
      await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
      await page.waitForSelector('canvas[data-engine]');
      await page.waitForFunction(() => {
        const n = parseInt(document.querySelector('#cash-val').textContent, 10);
        return n >= 100;
      });
      const shown = await page.evaluate(() => ({
        cash: parseInt(document.querySelector('#cash-val').textContent, 10),
        pendant: window.EurekaCosmetics && window.EurekaCosmetics.look().pendant,
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
          // Unlit shop rim #2ee6c7. The capture keeps that hex.
          if (r >= 30 && r <= 70 && g >= 210 && g <= 245 && b >= 175 && b <= 220 && g > r + 120) n++;
        }
        return n;
      }, 'data:image/png;base64,' + png.toString('base64'));
      return { page: page, shown: shown, count: count };
    }

    const bare = await office(false, ['starter']);
    const worn = await office(true, ['starter']);
    const wider = await office(true, ['starter', 'front']);
    console.log('bare', bare.count, 'worn', worn.count, 'two rooms', wider.count);
    console.log('cash', bare.shown.cash, worn.shown.cash, wider.shown.cash, 'look', worn.shown.pendant && worn.shown.pendant.id);

    assert.equal(bare.shown.pendant, null, 'bare office wears no pendant glass');
    assert.equal(worn.shown.pendant && worn.shown.pendant.id, 'pendant-tide', 'worn office reads tide glass');
    assert.equal(worn.shown.pendant.accent, '#2ee6c7', 'worn glass keeps the shop accent');
    assert.equal(bare.count, 0, 'bare ceiling has no shop rim');
    assert.ok(worn.count >= 20, 'the starter pendant shows the rim (' + worn.count + ')');
    assert.ok(wider.count > worn.count + 10, 'a second room hangs its own rim (' + wider.count + ' vs ' + worn.count + ')');
    assert.equal(bare.shown.cash, worn.shown.cash, 'wearing the glass does not change the purse');
    assert.equal(wider.shown.cash, worn.shown.cash, 'an already-owned room does not charge when the glass is worn');
    assert.ok(bare.shown.cash >= 100 && bare.shown.cash < 1000, 'cash stays an integer purse');
    assert.deepEqual(errors, [], 'zero page errors');
    console.log('PASS tide glass ' + worn.count + ' / ' + wider.count + ' rim pixels, cash ' + bare.shown.cash);
    await bare.page.close();
    await worn.page.close();
    await wider.page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/* Hook-free: Booth Notes tint the sticky notes on every desk.
 * A bare office keeps the yellow and pink paper.
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
  const notes = play.slice(
    play.indexOf('// A pair of accent sticky notes'),
    play.indexOf('// A pair of accent sticky notes') + 1600
  );
  assert.match(play, /engCostScale:\s+1\.45/, 'engineer cost scale stays 1.45');
  assert.match(play, /featurePriceBase:\s+8/, 'feature price stays 8');
  assert.match(play, /ceoDeskRange:\s+2\.0/, 'CEO desk range stays 2.0');
  assert.match(play, /id: 'left', gx: -1, gz: 0, cost: 150/, 'engineering pod still costs 150');
  assert.match(notes, /const noteColors = \[0xffeb3b, 0xff80ab\]/, 'a bare desk still pins yellow and pink');
  assert.match(notes, /new THREE\.MeshLambertMaterial\(\{ color: noteColors\[ni\] \}\)/, 'the bare paper stays on its own material');
  assert.match(notes, /new THREE\.BoxGeometry\(0\.22, 0\.22, 0\.02\)/, 'the notes stay the same size');
  assert.match(notes, /-0\.7 \+ ni \* 1\.4, 2\.2, -0\.66/, 'the notes stay on the top corners');
  assert.match(notes, /name = 'desk-sticky-shop'/, 'the shop face is built with every desk');
  assert.match(play, /function createPlot\(def\)/, 'desks still share one builder');
  assert.doesNotMatch(play, /window\.__/, 'no test hook on the office');
  console.log('PASS deal numbers and the bare notes stay put');

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
              owned: { 'note-booth': 1 },
              equipped: { note: 'note-booth' },
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
        note: window.EurekaCosmetics && window.EurekaCosmetics.look().note,
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
          // Unlit shop face #3dffc8. The capture keeps that hex.
          if (r >= 40 && r <= 90 && g >= 240 && b >= 175 && b <= 225 && g > r + 140 && g > b + 20) n++;
        }
        return n;
      }, 'data:image/png;base64,' + png.toString('base64'));
      return { page: page, shown: shown, count: count };
    }

    const bare = await office(false);
    const worn = await office(true);
    console.log('bare', bare.count, 'worn', worn.count);
    console.log('cash', bare.shown.cash, worn.shown.cash, 'look', worn.shown.note && worn.shown.note.id);

    assert.equal(bare.shown.note, null, 'bare office wears no booth notes');
    assert.equal(worn.shown.note && worn.shown.note.id, 'note-booth', 'worn office reads booth notes');
    assert.equal(worn.shown.note.accent, '#3dffc8', 'worn notes keep the shop accent');
    assert.equal(bare.count, 0, 'bare desks have no shop face');
    assert.ok(worn.count >= 40, 'the desks show the shop face (' + worn.count + ')');
    assert.equal(bare.shown.cash, worn.shown.cash, 'wearing the notes does not change the purse');
    assert.ok(bare.shown.cash >= 100 && bare.shown.cash < 1000, 'cash stays an integer purse');
    assert.deepEqual(errors, [], 'zero page errors');
    console.log('PASS booth notes ' + worn.count + ' face pixels, cash ' + bare.shown.cash);
    await bare.page.close();
    await worn.page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

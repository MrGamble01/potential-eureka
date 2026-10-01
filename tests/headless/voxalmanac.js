/* Voxel Isle — the open Almanac follows the running town.
 * Hook-free: seed a saved town, click the real Almanac button, and let
 * production frames cross dawn and finish a bakery cycle. No render/update
 * functions are called by the test. Also guard scroll, idle DOM, closed
 * sheets, and the Tide Tablet's once-per-consultation achievement.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const launch = { args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage({ viewport: { width: 768, height: 700 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 1, savedAt: Date.now(),
        state: { helpSeen: true, muted: true, musicOff: true, day: 1, time: 0,
          buildings: { market: { x: 8, z: 8 }, bakery: { x: 10, z: 8 } }, goods: {}, loaves: 0 },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
      localStorage.setItem('vox-lantern', JSON.stringify({ lit: true, isles: 3 }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.click('#almanacBtn');
    const market = () => page.locator('#almBody .alm-stat').filter({ hasText: 'Today' }).innerText();
    const loaves = () => page.locator('.alm-stat').filter({ has: page.locator('.l', { hasText: 'Loaves baked' }) }).locator('.v').innerText();
    const before = await market();
    ok(before.includes('pig') && await loaves() === '🍞 0', 'day-one demand and initial bakery total shown');
    ok(await page.evaluate(() => loadVtab().opens === 1), 'opening consults the Tide Tablet once');
    const scroll = await page.evaluate(() => {
      const card = document.querySelector('#almanacOv .card');
      card.scrollTop = 180;
      return card.scrollTop;
    });
    // Put existing simulation timers just before their thresholds, then wait for
    // ordinary frames to do the work while the sheet remains open.
    await page.evaluate(() => { state.time = CYCLE - .05; state.goods.crop = 1; bakeT = 8.95; });
    await page.waitForFunction(() => state.day === 2 && state.loaves === 1);
    await page.waitForTimeout(1600);
    const after = await market();
    const expected = await page.evaluate(() => {
      const key = demandGoodKey();
      return 'Today ' + goodDef(key).product + ' ' + key + ' sells for +50%';
    });
    ok(after !== before && after.startsWith(expected), 'open Almanac follows actual demand across dawn');
    ok(await loaves() === '🍞 1', 'automatic baking updates the open Almanac total');
    ok(await page.evaluate(() => document.querySelector('#almanacOv .card').scrollTop) === scroll && scroll > 0,
      'live update keeps the reader’s scroll position');
    ok(await page.evaluate(() => loadVtab().opens === 1 && !state.ach.tablet3),
      'live updates neither count consultations nor award Written in Tide');
    // An idle refresh must not replace the content the reader is using.
    const body = await page.locator('#almBody .alm-grid').elementHandle();
    await page.waitForTimeout(1600);
    ok(await body.evaluate(node => node.isConnected), 'unchanged content retains its DOM nodes');
    await page.keyboard.press('Escape');
    const closed = await page.locator('#almBody').innerText();
    await page.evaluate(() => { state.goods.crop = 1; bakeT = 8.95; });
    await page.waitForFunction(() => state.loaves === 2);
    await page.waitForTimeout(1600);
    ok(await page.locator('#almBody').innerText() === closed, 'closed Almanac is not refreshed');
    await page.click('#almanacBtn');
    ok(await loaves() === '🍞 2' && await page.evaluate(() => loadVtab().opens === 2 && !state.ach.tablet3),
      'reopening shows current totals and counts exactly one new consultation');
    await page.locator('#almClose').click();
    await page.click('#almanacBtn');
    ok(await page.evaluate(() => loadVtab().opens === 3 && !!state.ach.tablet3),
      'third deliberate opening still awards Written in Tide');
    ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join('; ') : ''}`);
  } finally {
    await browser.close();
  }
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

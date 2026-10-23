/* Startup Tycoon office windows share the living-world sky.
 * Dawn, night, and rain change the glass. The chip stays
 * "open sky". Cash and per-ship stay on the deal sheet.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const root = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const office = fs.readFileSync(path.join(root, 'tycoon/play.html'), 'utf8');
ok(office.indexOf('/js/living-world.js') >= 0, 'the office loads the shared clock');
ok(office.indexOf("profile: 'tycoon'") >= 0, 'the office opts into the visual profile');
ok(office.indexOf('officeWorld.saleValue') < 0, 'saleValue is not called from the office');
ok(office.indexOf('officeWorld.heatGain') < 0, 'heatGain is not called from the office');
ok(office.indexOf('officeWorld.growSeconds') < 0, 'growSeconds is not called from the office');
ok(office.indexOf('officeWorld.unitDamage') < 0, 'unitDamage is not called from the office');
ok(office.indexOf('officeWorld.moveStep') < 0, 'moveStep is not called from the office');

function sampleExpr() {
  return `(() => {
    const c = document.getElementById('office-sky-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, b = 0, n = 0, bright = 0;
    for (let i = 0; i < d.length; i += 16) {
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      if (d[i] > 210 && d[i + 1] > 210 && d[i + 2] > 210) bright++;
    }
    const cx = (48 * c.width + 64) * 4;
    return {
      r: r / n, g: g / n, b: b / n,
      cr: d[cx], cg: d[cx + 1], cb: d[cx + 2],
      lum: (r + g + b) / n / 3,
      bright: bright,
      chip: document.getElementById('tyc-sky').textContent,
      key: document.getElementById('tyc-sky').dataset.world,
    };
  })()`;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('tycoon:welcomeSeen-v1', '1');
    localStorage.setItem('tycoon:tipsEnabled', '0');
  });
  await page.goto(BASE + '/tycoon/play.html?world=day-clear', { waitUntil: 'load' });
  await page.waitForFunction(() => window.TYC_WORLD && window.TYC_PAINT && window.TYC_WINDOWS && window.TYC_WINDOWS.length >= 3 && document.getElementById('tyc-sky').textContent);
  if (await page.locator('#welcome-start-btn').isVisible().catch(() => false)) {
    await page.click('#welcome-start-btn');
  }

  const booked = await page.evaluate(() => ({
    cash: document.getElementById('cash-val').textContent,
    ship: document.getElementById('m-pership').textContent,
    arr: document.getElementById('m-arr').textContent,
    shipped: document.getElementById('m-shipped').textContent,
    ver: document.getElementById('m-version').textContent,
  }));

  const day = await page.evaluate((expr) => {
    window.TYC_WORLD.force({ phase: 'day', weather: 'clear' });
    window.TYC_PAINT(0.016, false);
    return eval(expr);
  }, sampleExpr());
  ok(/Day/.test(day.chip) && /Clear/.test(day.chip) && /open sky/.test(day.chip), `clear day reads as open sky (${day.chip})`);
  ok(day.cb > day.cr + 30 && day.lum > 140, `clear day glass is bright blue (${Math.round(day.cr)},${Math.round(day.cg)},${Math.round(day.cb)})`);

  const dawn = await page.evaluate((expr) => {
    window.TYC_WORLD.force({ phase: 'dawn', weather: 'clear' });
    window.TYC_PAINT(0.016, false);
    return eval(expr);
  }, sampleExpr());
  ok(/Dawn/.test(dawn.chip) && /open sky/.test(dawn.chip), `dawn stays an open sky (${dawn.chip})`);
  ok(dawn.cr > dawn.cb + 20 && dawn.cr > day.cr + 40, `dawn glass is warmer than day (${Math.round(dawn.cr)},${Math.round(dawn.cb)} vs ${Math.round(day.cr)})`);

  const night = await page.evaluate((expr) => {
    window.TYC_WORLD.force({ phase: 'night', weather: 'clear' });
    window.TYC_PAINT(0.016, false);
    return eval(expr);
  }, sampleExpr());
  ok(/Night/.test(night.chip) && /open sky/.test(night.chip), `night stays an open sky (${night.chip})`);
  ok(night.lum < 50 && night.lum < day.lum / 3, `night glass is dark (${Math.round(night.lum)} vs day ${Math.round(day.lum)})`);

  const rain = await page.evaluate((expr) => {
    window.TYC_WORLD.force({ phase: 'day', weather: 'clear' });
    window.TYC_PAINT(0.016, false);
    const c = document.getElementById('office-sky-canvas');
    const before = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    window.TYC_WORLD.force({ phase: 'day', weather: 'rain' });
    window.TYC_PAINT(0.05, false);
    window.TYC_PAINT(0.05, false);
    const after = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let diff = 0;
    for (let i = 0; i < before.length; i += 16) {
      if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) > 18) diff++;
    }
    const sky = eval(expr);
    sky.diff = diff;
    return sky;
  }, sampleExpr());
  ok(/Rain/.test(rain.chip) && /open sky/.test(rain.chip), `rain stays an open sky (${rain.chip})`);
  ok(rain.diff > 40, `rain changes the window glass (${rain.diff} samples)`);

  const snow = await page.evaluate((expr) => {
    window.TYC_WORLD.force({ phase: 'day', weather: 'snow' });
    window.TYC_PAINT(0.05, false);
    window.TYC_PAINT(0.05, false);
    return eval(expr);
  }, sampleExpr());
  ok(/Snow/.test(snow.chip) && /open sky/.test(snow.chip), `snow stays an open sky (${snow.chip})`);
  ok(snow.bright > 3, `snow leaves white on the glass (${snow.bright})`);

  const storm = await page.evaluate(() => {
    const before = {
      cash: document.getElementById('cash-val').textContent,
      ship: document.getElementById('m-pership').textContent,
      arr: document.getElementById('m-arr').textContent,
      shipped: document.getElementById('m-shipped').textContent,
      ver: document.getElementById('m-version').textContent,
    };
    const snap = window.TYC_WORLD.force({ phase: 'night', weather: 'storm' });
    window.TYC_PAINT(0.05, false);
    const after = {
      cash: document.getElementById('cash-val').textContent,
      ship: document.getElementById('m-pership').textContent,
      arr: document.getElementById('m-arr').textContent,
      shipped: document.getElementById('m-shipped').textContent,
      ver: document.getElementById('m-version').textContent,
    };
    const wins = window.TYC_WINDOWS;
    const map = wins[0].panes[0].material.map;
    const shared = wins.every((w) => w.panes.every((p) => p.material.map === map && p.material.map.image === window.TYC_SKY));
    const east = wins.some((w) => w.panes[0].position.x > 8.1);
    return {
      chip: document.getElementById('tyc-sky').textContent,
      price: snap.mods.price,
      foe: snap.mods.foe,
      same: JSON.stringify(before) === JSON.stringify(after),
      before: before,
      after: after,
      panes: wins.reduce((n, w) => n + w.panes.length, 0),
      shared: shared,
      east: east,
    };
  });
  ok(/Storm/.test(storm.chip) && /open sky/.test(storm.chip) && !/foes|street|heat|crops/.test(storm.chip), `a night storm is not a deal (${storm.chip})`);
  ok(storm.price > 1 && storm.foe > 1, `the clock still has night-storm numbers (${storm.price}, ${storm.foe})`);
  ok(storm.same, `pinning the sky does not move the books (${storm.before.ship} / ${storm.before.cash})`);
  ok(storm.panes >= 6 && storm.shared && storm.east, `the exterior windows share one sky (${storm.panes} panes, east ${storm.east})`);
  ok(storm.after.ship === booked.ship && storm.after.cash === booked.cash, `per-ship stayed ${booked.ship} and cash stayed ${booked.cash}`);

  await page.waitForTimeout(400);
  const later = await page.evaluate(() => ({
    ship: document.getElementById('m-pership').textContent,
    arr: document.getElementById('m-arr').textContent,
    shipped: document.getElementById('m-shipped').textContent,
  }));
  ok(later.ship === booked.ship && later.arr === booked.arr && later.shipped === booked.shipped, `a beat later the deal sheet is still ${booked.ship}`);

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });

/* Grow Op sky — the shared clock on the corner.
 * Rain shortens a grow and cools the block. Night
 * pays more. A storm slows the walk. Snow stalls
 * the plants. A clear morning matches the old rates.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('growop-intro-seen', '1'));
  await page.goto(BASE + '/drug-lab.html?world=day-clear', { waitUntil: 'load' });
  await page.waitForFunction(() => window.LAB_SKY && window.LAB_WORLD && document.getElementById('lab-sky').textContent);

  const clear = await page.evaluate(() => ({
    chip: document.getElementById('lab-sky').textContent,
    grow: LAB_SKY.growTime(),
    price: LAB_SKY.salePrice(),
    speed: LAB_SKY.playerSpeed(),
    drain: LAB_SKY.heatDrain(),
    buyers: LAB_SKY.buyers(),
    bg: document.getElementById('lab-sky').dataset.bg,
  }));
  ok(/Day/.test(clear.chip) && /Clear/.test(clear.chip), `clear morning is labeled (${clear.chip})`);
  ok(clear.bg === '0d1108', `a clear morning keeps the old room color (${clear.bg})`);

  await page.evaluate(() => LAB_WORLD.force({ phase: 'day', weather: 'rain' }));
  await page.waitForFunction(() => document.getElementById('lab-sky').dataset.world === 'day|rain');
  const rain = await page.evaluate(() => ({
    chip: document.getElementById('lab-sky').textContent,
    grow: LAB_SKY.growTime(),
    drain: LAB_SKY.heatDrain(),
    bg: document.getElementById('lab-sky').dataset.bg,
  }));
  ok(/Rain/.test(rain.chip) && /crops/.test(rain.chip), `rain names the crop (${rain.chip})`);
  ok(rain.grow < clear.grow * 0.8, `rain shortens a grow (${rain.grow} vs ${clear.grow})`);
  ok(rain.drain > clear.drain * 1.3, `rain cools the block (${rain.drain} vs ${clear.drain})`);
  ok(rain.bg !== clear.bg, `rain changes the room light (${rain.bg})`);

  await page.evaluate(() => LAB_WORLD.force({ phase: 'night', weather: 'clear' }));
  await page.waitForFunction(() => document.getElementById('lab-sky').dataset.world === 'night|clear');
  const night = await page.evaluate(() => ({
    chip: document.getElementById('lab-sky').textContent,
    price: LAB_SKY.salePrice(),
    buyers: LAB_SKY.buyers(),
  }));
  ok(/Night/.test(night.chip), `night is labeled (${night.chip})`);
  ok(night.price > clear.price, `night pays more (${night.price} vs ${clear.price})`);
  ok(night.buyers < clear.buyers, `buyers come sooner after dark (${night.buyers} vs ${clear.buyers})`);

  await page.evaluate(() => LAB_WORLD.force({ phase: 'day', weather: 'storm' }));
  await page.waitForFunction(() => document.getElementById('lab-sky').dataset.world === 'day|storm');
  const storm = await page.evaluate(() => ({
    chip: document.getElementById('lab-sky').textContent,
    speed: LAB_SKY.playerSpeed(),
  }));
  ok(/Storm/.test(storm.chip), `the storm is labeled (${storm.chip})`);
  ok(storm.speed < clear.speed * 0.8, `a storm slows the walk (${storm.speed} vs ${clear.speed})`);

  await page.evaluate(() => LAB_WORLD.force({ phase: 'day', weather: 'snow' }));
  await page.waitForFunction(() => document.getElementById('lab-sky').dataset.world === 'day|snow');
  const snow = await page.evaluate(() => ({
    chip: document.getElementById('lab-sky').textContent,
    grow: LAB_SKY.growTime(),
  }));
  ok(/Snow/.test(snow.chip), `snow is labeled (${snow.chip})`);
  ok(snow.grow > clear.grow * 1.4, `snow stalls a grow (${snow.grow} vs ${clear.grow})`);

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });

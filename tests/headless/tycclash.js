/* Hostile takeover on the office floor, and the yard raid on Beagle Sim.
 * The fight itself is covered in hvclimax.js. This checks the button,
 * the charter, the cash, and the career trophy. */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  async function boot(path) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript((prefix) => {
      localStorage.setItem(prefix + 'welcomeSeen-v1', '1');
      localStorage.setItem(prefix + 'tipsEnabled', '0');
    }, path.indexOf('beagle') >= 0 ? 'beagle:' : 'tycoon:');
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
    await page.waitForSelector('#clash-btn');
    return { context, page };
  }
  try {
    const desk = await boot('/tycoon/play.html');
    const page = desk.page;
    ok((await page.locator('#clash-btn').innerText()).includes('Hostile takeover'), 'the office offers the takeover');
    const before = await page.locator('#cash-val').innerText();
    await page.click('#clash-btn');
    await page.waitForSelector('#climax-root');
    const intro = await page.locator('#climax-call').innerText();
    ok(/Quinn:/.test(intro), 'Quinn calls the bid (' + intro + ')');
    const box = await page.locator('.cx-lane').first().boundingBox();
    ok(box && box.height >= 48, 'a counter is at least 48px tall');
    const end = await page.evaluate(() => document.getElementById('climax-root').__view.playout());
    ok(end.status === 'won', 'scripted counters break the bid');
    await page.waitForFunction(() => {
      const profile = window.EurekaProgress && EurekaProgress.profile();
      return profile && profile.unlocked && profile.unlocked['tycoon-takeover'] && profile.unlocked['cross-boss'];
    });
    const chip = await page.locator('#clash-chip').innerText();
    const feed = await page.locator('#feed-list').innerText();
    const num = (s) => Number(String(s).replace(/[^0-9.]/g, ''));
    const startCash = num(before);
    await page.waitForFunction((floor) => {
      const n = Number(document.getElementById('cash-val').textContent.replace(/[^0-9.]/g, ''));
      return n >= floor;
    }, startCash + 2500);
    const cash = await page.locator('#cash-val').innerText();
    ok(/5%/.test(chip) && /5%/.test(feed), 'the charter is on the floor (' + chip + ')');
    ok(num(cash) >= startCash + 2500, 'the purse arrives (' + before + ' -> ' + cash + ')');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('startup-tycoon-v7')));
    ok(saved.clash && saved.clash.charter === true, 'the charter survives a save');
    await page.click('#climax-close');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#clash-chip.on');
    ok(/5%/.test(await page.locator('#clash-chip').innerText()), 'a reloaded office still has the charter');
    await desk.context.close();

    const yard = await boot('/tycoon/play.html?theme=beagle');
    const yp = yard.page;
    ok((await yp.locator('#clash-btn').innerText()).includes('Yard raid'), 'the kennel offers the yard raid');
    await yp.click('#clash-btn');
    await yp.waitForSelector('#climax-root');
    const title = await yp.locator('.cx-title').innerText();
    const call = await yp.locator('#climax-call').innerText();
    ok(/Pug/.test(title) && /Biscuit:/.test(call), 'Biscuit calls Pug Ventures (' + call + ')');
    const won = await yp.evaluate(() => document.getElementById('climax-root').__view.playout());
    ok(won.status === 'won', 'the pack can hold the yard');
    await yp.waitForFunction(() => {
      const profile = window.EurekaProgress && EurekaProgress.profile();
      return profile && profile.unlocked && profile.unlocked['beagle-raid'] && !profile.unlocked['tycoon-takeover'];
    });
    ok(true, 'Yard Held does not take the Startup Tycoon trophy');
    await yard.context.close();
  } catch (e) {
    ok(false, 'takeover: ' + String(e && e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
  }
  ok(errors.length === 0, 'no page errors' + (errors.length ? ' — ' + errors[0] : ''));
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

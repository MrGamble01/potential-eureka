/* Hook-free: the office across the hall, a ghost of a previous season
 * stored in this browser. Real save, real goal readout. */
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
  async function open(ghost, save) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(seed => {
      localStorage.setItem('tycoon:welcomeSeen-v1', '1');
      localStorage.setItem('tycoon:tipsEnabled', '0');
      localStorage.setItem('tycoon-hall', JSON.stringify(seed.ghost));
      localStorage.setItem('startup-tycoon-v7', JSON.stringify({
        v: 7, cash: 500, allTimeCash: 1, savedAt: Date.now(), offlineRatePerSec: 0,
        ...seed.save,
      }));
    }, { ghost, save });
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
    await page.waitForSelector('#goal-hall-label');
    return page;
  }
  const behind = await open(
    { step: 15, samples: [8000, 12000] },
    { seasonRecurringRevenue: 500 },
  );
  await behind.waitForFunction(() => {
    const el = document.getElementById('goal-hall-label');
    return el && el.style.display !== 'none' && el.textContent.includes('behind');
  });
  const behindText = await behind.locator('#goal-hall-label').innerText();
  ok(behindText.includes('Hall') && behindText.includes('behind'), 'a richer saved season shows the hall ahead (' + behindText + ')');
  ok((await behind.locator('#goal-hall-label').getAttribute('title')).includes('browser'),
    'the label says the ghost lives in this browser');
  await behind.close();

  const ahead = await open(
    { step: 15, samples: [100, 200] },
    { seasonRecurringRevenue: 4000 },
  );
  await ahead.waitForFunction(() => document.getElementById('goal-hall-label').textContent.includes('you lead'));
  const leadText = await ahead.locator('#goal-hall-label').innerText();
  ok(leadText.includes('you lead'), 'passing the hall ghost flips the label (' + leadText + ')');
  ok(await ahead.locator('#goal-hall-label').evaluate(el => el.classList.contains('lead')), 'the lead gets the juice class');
  await ahead.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  phone.on('pageerror', e => errors.push(String(e)));
  await phone.addInitScript(() => {
    localStorage.setItem('tycoon:welcomeSeen-v1', '1');
    localStorage.setItem('tycoon:tipsEnabled', '0');
    localStorage.setItem('startup-tycoon-v7', JSON.stringify({
      v: 7, cash: 40000, allTimeCash: 1, totalFeaturesShipped: 25,
      savedAt: Date.now(), offlineRatePerSec: 0,
      upgrades: { cs: 1, impl: 2, partner: 1 },
      partnerChain: { beat: 1, tiger: false, books: false, logo: false, slowT: 0, waitT: 0, next: 0, renewalT: 0 },
    }));
  });
  await phone.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
  await phone.waitForSelector('#partner-modal.open');
  const yes = await phone.locator('#partner-yes').boundingBox();
  const modal = await phone.locator('#partner-modal .win-panel').boundingBox();
  ok(yes && yes.height >= 48, 'the phone meeting button is at least 48px tall');
  ok(modal && yes && yes.y + yes.height <= 844 + 2, 'the answer sits inside the phone screen');
  await phone.click('#partner-yes');
  ok((await phone.locator('#feed-list').innerText()).includes('Tiger team'), 'a thumb can staff the tiger team');
  await phone.close();

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

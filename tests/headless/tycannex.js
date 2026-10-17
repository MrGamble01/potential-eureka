/* Hook-free: the Annex, a new area with three AI companions and the Auditor.
 * Unlocks once the design partner is signed. Beating the Auditor pays +6% deals. */
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
  async function boot(viewport) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('tycoon:welcomeSeen-v1', '1');
      localStorage.setItem('tycoon:tipsEnabled', '0');
      if (localStorage.getItem('tycoon-annex-seeded')) return;
      localStorage.setItem('tycoon-annex-seeded', '1');
      localStorage.setItem('startup-tycoon-v7', JSON.stringify({
        v: 7, cash: 5000, allTimeCash: 1, savedAt: Date.now(), offlineRatePerSec: 0,
        totalFeaturesShipped: 25,
        upgrades: { partner: 1 },
        partnerChain: { beat: 6, tiger: true, books: true, logo: false, slowT: 0, waitT: 0, next: 0, renewalT: 0 },
      }));
    });
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
    await page.waitForSelector('#annex-btn.on');
    return { context, page };
  }
  const desk = await boot({ width: 1280, height: 800 });
  const page = desk.page;
  ok((await page.locator('#annex-btn').innerText()).includes('Annex'), 'a signed partner opens the annex');
  await page.click('#annex-btn');
  await page.waitForSelector('#annex-modal.open');
  const intro = await page.locator('#annex-modal').innerText();
  ok(intro.includes('Auditor') && intro.includes('Mira') && intro.includes('Sol') && intro.includes('Penn'),
    'the annex names the auditor and the three companions');
  ok(intro.includes('leading'), 'one companion is already leading the beat');
  const fought = await page.evaluate(() => {
    const cash = () => document.getElementById('cash-val').textContent;
    const before = cash();
    const btn = document.getElementById('annex-follow');
    const leads = [];
    for (let i = 0; i < 3; i++) {
      leads.push(btn.textContent);
      btn.click();
    }
    const chip = document.getElementById('annex-chip');
    return { before, after: cash(), leads, chip: chip ? chip.textContent : '', open: document.getElementById('annex-modal').classList.contains('open') };
  });
  ok(fought.leads.some(t => t.includes('Mira')) && fought.leads.some(t => t.includes('Sol')),
    'the lead rotates with the auditor (' + fought.leads.join(' | ') + ')');
  ok(!fought.open && fought.chip.includes('6%'), 'beating the auditor unlocks the annex (' + fought.chip + ')');
  ok(fought.before === fought.after, 'the fight does not spend cash');
  ok((await page.locator('#feed-list').innerText()).includes('Deals +6%'), 'the floor hears that deals moved');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('startup-tycoon-v7')));
  ok(saved.annex && saved.annex.live === true, 'the annex survives a save');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#annex-chip.on');
  ok((await page.locator('#annex-chip').innerText()).includes('6%'), 'a reloaded season still has the annex');
  await desk.context.close();

  const phoneBoot = await boot({ width: 390, height: 844 });
  const phone = phoneBoot.page;
  await phone.click('#annex-btn');
  await phone.waitForSelector('#annex-modal.open');
  const follow = await phone.locator('#annex-follow').boundingBox();
  const panel = await phone.locator('#annex-modal .win-panel').boundingBox();
  ok(follow && follow.height >= 48, 'the phone follow button is at least 48px');
  ok(panel && follow && follow.y + follow.height <= 846, 'the answer sits inside the phone screen');
  await phone.locator('#annex-follow').click();
  ok((await phone.locator('#annex-log').innerText()).includes('Mira'), 'a thumb can follow Mira');
  await phoneBoot.context.close();

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
/* Hook-free: Scale chain and design-partner term sheet through production
 * saves and real clicks. CDP only pauses the live event tick so a Hackathon
 * and Demo Day can be proven not to erase upgrade multipliers. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const source = fs.readFileSync(path.resolve(__dirname, '../../tycoon/play.html'), 'utf8');
let passed = 0;
function check(value, label) { assert.ok(value, label); console.log('PASS ' + label); passed++; }
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    async function open(save) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      page.setDefaultTimeout(15000);
      page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(p => {
        localStorage.setItem('startup-tycoon-v7', JSON.stringify(p));
        localStorage.setItem('tycoon:welcomeSeen-v1', '1');
        localStorage.setItem('tycoon:tipsEnabled', '0');
      }, { v: 7, cash: 0, allTimeCash: 1, savedAt: Date.now(), offlineRatePerSec: 0, ...save });
      await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
      await page.waitForSelector('.upg-btn[data-id="cs"]');
      if (await page.locator('#welcome-start-btn').isVisible()) await page.click('#welcome-start-btn');
      return page;
    }
    async function saved(page) {
      return page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('startup-tycoon-v7'));
      });
    }
    const upg = (page, id) => page.locator(`.upg-btn[data-id="${id}"]`);

    const locked = await open({ cash: 50000 });
    check(await upg(locked, 'cs').isDisabled(), 'customer success stays locked before 25 ships');
    check((await upg(locked, 'cs').innerText()).includes('Opens at 25'), 'lock copy names the ship gate');
    check((await upg(locked, 'impl').innerText()).includes('Customer Success'), 'implementation waits on customer success');
    check(await upg(locked, 'cs').evaluate(el => el.classList.contains('locked-chain')), 'locked scale row is marked');
    await locked.close();

    const page = await open({ cash: 40000, totalFeaturesShipped: 25 });
    check(await upg(page, 'cs').isEnabled(), '25 ships opens customer success');
    check((await upg(page, 'cs').innerText()).includes('$400'), 'customer success costs $400');
    await upg(page, 'cs').click();
    check(await upg(page, 'cs').evaluate(el => el.classList.contains('just-bought')), 'buying a scale upgrade pops the button');
    check(await upg(page, 'impl').isEnabled(), 'customer success unlocks implementation');
    await upg(page, 'impl').click();
    check(await upg(page, 'partner').isDisabled(), 'one implementation level does not open the partner');
    await upg(page, 'impl').click();
    check((await upg(page, 'impl').innerText()).includes('$1.3k') || (await upg(page, 'impl').innerText()).includes('Lv 2/4'),
      'second implementation level sticks');
    check(await upg(page, 'partner').isEnabled(), 'two implementation levels open the design partner');
    await upg(page, 'partner').click();
    const modal = page.locator('#partner-modal');
    await page.waitForSelector('#partner-modal.open');
    check((await page.locator('#partner-title').innerText()).includes('pilot'), 'buying the partner opens the pilot');
    check((await page.locator('#partner-chip').innerText()).includes('Pilot'), 'status bar shows the pilot step');
    check(await page.locator('.partner-dot.on').count() === 1, 'step dots mark the pilot');
    await page.click('#partner-yes');
    await page.waitForFunction(() => document.getElementById('partner-title').textContent.includes('security'));
    check((await page.locator('#feed-list').innerText()).includes('Tiger team'), 'tiger team lands in the feed');
    await page.click('#partner-yes');
    await page.waitForFunction(() => document.getElementById('partner-title').textContent.includes('term sheet'));
    const yes = await page.locator('#partner-yes').innerText();
    check(yes.includes('$4.2k') || yes.includes('4,158') || yes.includes('$4158'), 'tiger team and open books price the check at $4,158 (' + yes + ')');
    await page.click('#partner-yes');
    await page.waitForFunction(() => !document.getElementById('partner-modal').classList.contains('open'));
    check((await page.locator('#partner-chip').innerText()).includes('Signed') || (await page.locator('#partner-chip').innerText()).includes('$'),
      'signed partner stays on the status bar');
    check(await upg(page, 'refs').isEnabled(), 'the term sheet unlocks reference customers');
    await upg(page, 'refs').click();
    const snap = await saved(page);
    check(snap.cash === 39433 - 1800, 'check, chain, and first reference customer charge exactly (' + snap.cash + ')');
    check(snap.partnerChain && snap.partnerChain.beat === 6 && snap.partnerChain.tiger && snap.partnerChain.books && !snap.partnerChain.logo,
      'the signed choices persist');
    check(snap.upgrades.cs === 1 && snap.upgrades.impl === 2 && snap.upgrades.partner === 1 && snap.upgrades.refs === 1,
      'scale levels persist');
    check((await page.locator('#partner-chip').getAttribute('title')).includes('renew'), 'reference customers advertise the renewal');
    await page.close();

    const mid = await open({
      cash: 10000,
      totalFeaturesShipped: 25,
      upgrades: { cs: 1, impl: 2, partner: 1 },
      partnerChain: { beat: 2, tiger: true, books: false, logo: false, slowT: 0, waitT: 0, next: 0, renewalT: 0 },
    });
    await mid.waitForSelector('#partner-modal.open');
    check((await mid.locator('#partner-title').innerText()).includes('security'), 'a saved review reopens the meeting');
    await mid.click('#partner-no');
    await mid.waitForFunction(() => document.getElementById('partner-title').textContent.includes('term sheet'));
    await mid.click('#partner-no');
    const logo = await saved(mid);
    check(logo.partnerChain.logo === true && logo.partnerChain.beat === 6, 'taking the logo persists');
    check(logo.cash > 10000, 'the logo still pays a smaller check (' + logo.cash + ')');
    await mid.close();

    const season = await open({
      cash: 0,
      prestigeLevel: 1,
      prestigeMultiplier: 2,
      upgrades: { enterprise: 1 },
    });
    await season.waitForFunction(() => document.getElementById('m-pership').textContent !== '$5');
    check((await season.locator('#m-pership').innerText()) === '$58',
      'a reloaded season keeps Enterprise on top of the prestige multiplier');
    await season.close();

    const probe = await open({ cash: 1000 });
    const cdp = await probe.context().newCDPSession(probe);
    await cdp.send('Debugger.enable');
    const lineNumber = source.slice(0, source.indexOf('  nextEventIn -= dt;')).split('\n').length;
    const paused = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('event tick did not pause')), 15000);
      cdp.once('Debugger.paused', event => { clearTimeout(timer); resolve(event); });
    });
    await cdp.send('Debugger.setBreakpointByUrl', { url: BASE + '/tycoon/play.html', lineNumber });
    const event = await paused;
    const result = await cdp.send('Debugger.evaluateOnCallFrame', {
      callFrameId: event.callFrames[0].callFrameId,
      expression: `(() => {
        ideaSpeedMult = 2;
        const hack = EVENT_POOL.find(e => e.id === 'hackathon');
        hack.onStart();
        const during = { idea: ideaSpeedMult, event: eventIdeaMult, rate: ideaRateMult() };
        hack.onEnd();
        const after = { idea: ideaSpeedMult, event: eventIdeaMult, rate: ideaRateMult() };
        dealValueMult = 3;
        const demo = EVENT_POOL.find(e => e.id === 'demo');
        demo.onStart();
        const dealDuring = { deal: dealValueMult, event: eventDealMult, value: computeDealValue() };
        demo.onEnd();
        const dealAfter = { deal: dealValueMult, event: eventDealMult, value: computeDealValue() };
        corpDealMult = 1.5;
        const corp = { deal: dealValueMult, value: computeDealValue() };
        corpDealMult = 1;
        upgLevels.cs = 1;
        const scaled = { mult: scaleDealMult(), value: computeDealValue() };
        return JSON.stringify({ during, after, dealDuring, dealAfter, corp, scaled });
      })()`,
      returnByValue: true,
    });
    assert.ok(!result.exceptionDetails, 'event isolation probe ran: ' + JSON.stringify(result.exceptionDetails || ''));
    const got = JSON.parse(result.result.value);
    check(got.during.idea === 2 && got.during.event === 2.5 && got.during.rate === 5, 'hackathon multiplies on top of ideation upgrades');
    check(got.after.idea === 2 && got.after.event === 1 && got.after.rate === 2, 'hackathon end restores the upgrade, not a flat 1×');
    check(got.dealDuring.deal === 3 && got.dealDuring.event === 2.25 && got.dealDuring.value === 54, 'demo day multiplies on top of enterprise');
    check(got.dealAfter.deal === 3 && got.dealAfter.event === 1 && got.dealAfter.value === 24, 'demo day end leaves the enterprise multiplier');
    check(got.corp.deal === 3 && got.corp.value === 36, 'corp dev handshake does not overwrite enterprise');
    check(got.scaled.mult === 1.04 && got.scaled.value === 25, 'customer success adds 4% on top of the deal');
    await cdp.send('Debugger.resume');
    await cdp.detach();
    await probe.close();

    check(errors.length === 0, 'zero page errors: ' + errors.join('; '));
    console.log(`${passed} passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

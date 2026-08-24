/* P4-A11Y-1 focus management: tycoon Founder Shop focuses its first
   control on open, Tab wraps inside, and closing restores the opener;
   hub calendar modal (display-based) gets the same. */
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  // Tycoon Founder Shop
  {
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await page.goto('http://127.0.0.1:8099/tycoon/play.html', { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    await page.evaluate(() => {
      localStorage.setItem('tycoon:tipsEnabled', '0');
      localStorage.setItem('tycoon:welcomeSeen-v1', '1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(4000);

    await page.click('#open-founder-btn');
    await page.waitForTimeout(400);
    const focused = await page.evaluate(() => ({
      inModal: document.getElementById('founder-modal').contains(document.activeElement),
      tag: document.activeElement.tagName,
    }));
    ok(focused.inModal, `open focuses inside the modal (${focused.tag})`);

    // Tab cycles within the modal only
    const seen = new Set();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const at = await page.evaluate(() => ({
        inModal: document.getElementById('founder-modal').contains(document.activeElement),
        id: document.activeElement.id || document.activeElement.textContent.slice(0, 12),
      }));
      ok !== null;
      if (!at.inModal) { seen.add('ESCAPED'); break; }
      seen.add(at.id);
    }
    ok(!seen.has('ESCAPED'), `Tab stays trapped (cycled: ${[...seen].join(', ').slice(0, 60)})`);

    await page.click('#founder-close');
    await page.waitForTimeout(300);
    const restored = await page.evaluate(() => document.activeElement.id);
    ok(restored === 'open-founder-btn', `close restores the opener (${restored})`);
    ok(errs.length === 0, `tycoon: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await page.context().close();
  }

  // Hub calendar modal (Utils.openModal path)
  {
    const page = await (await browser.newContext()).newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(1500);
    const opened = await page.evaluate(() => {
      const btn = document.getElementById('calendar-settings-btn') || document.querySelector('[onclick*="calendar"], #calendar-config-btn');
      if (btn) { btn.click(); return 'btn'; }
      Utils.openModal('calendar-modal');
      return 'direct';
    });
    await page.waitForTimeout(400);
    const inCal = await page.evaluate(() =>
      document.getElementById('calendar-modal') &&
      document.getElementById('calendar-modal').contains(document.activeElement));
    ok(inCal, `hub modal focuses inside on open (${opened})`);
    ok(errs.length === 0, `hub: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await page.context().close();
  }

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

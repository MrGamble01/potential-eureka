/*
 * The Ledger is a sandbox of crates, two legs, and a heat bar.
 * A full bar hands the book to an heir. The city does not stop.
 *
 *  A. Staffing haul and drop pays cash.
 *  B. Pause holds the cash. Resume pays again.
 *  C. Lay low cools heat and holds the chain.
 *  D. Heat at the top names an heir, and the chain can be staffed again.
 *  E. Restart puts the founder back at $100.
 *  Z. Zero page errors. Phone controls stay hittable.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function cashOf(text) {
  return Number(String(text || '').replace(/\D/g, '')) || 0;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    async function book(width, height) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
      page.setDefaultTimeout(15000);
      await page.addInitScript(() => localStorage.removeItem('ledger-v1'));
      await page.goto(BASE + '/games/ledger/index.html', { waitUntil: 'load', timeout: 30000 });
      ok((await page.locator('#boss').innerText()).trim() === 'The Founder', width + ' opens on the founder');
      ok(cashOf(await page.locator('#cash').innerText()) === 100, width + ' opens with $100');
      ok(/Staff both legs/.test(await page.locator('#now').innerText()),
        width + ' an empty book says to staff both legs');
      const pauseHit = await page.evaluate(() => {
        const el = document.getElementById('pause');
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { id: top && top.id, h: Math.round(r.height) };
      });
      ok(pauseHit.id === 'pause' && pauseHit.h >= 44,
        width + ' pause is a thumb target (' + pauseHit.id + ', ' + pauseHit.h + 'px)');
      await page.locator('#haul').selectOption('mara');
      await page.locator('#drop').selectOption('ivo');
      const movingNow = await page.locator('#now').innerText();
      ok(/Mara Voss is hauling/.test(movingNow) && /Ivo Quill is selling/.test(movingNow),
        width + ' the board names who is hauling and who is selling');
      await page.waitForFunction(() => {
        const n = Number((document.getElementById('cash').textContent || '').replace(/\D/g, ''));
        return n > 100;
      });
      ok(true, width + ' both legs pay');
      const moving = cashOf(await page.locator('#cash').innerText());
      await page.locator('#pause').click();
      ok(/Paused/.test(await page.locator('#now').innerText()), width + ' pause says the crates are waiting');
      await page.waitForTimeout(1000);
      const held = cashOf(await page.locator('#cash').innerText());
      ok(held === moving && (await page.locator('#pause').innerText()).trim() === 'Resume',
        width + ' pause holds the cash (' + held + ')');
      await page.locator('#pause').click();
      await page.waitForFunction((floor) => {
        const n = Number((document.getElementById('cash').textContent || '').replace(/\D/g, ''));
        return n > floor;
      }, held);
      ok(true, width + ' resume pays again');
      await page.waitForFunction(() => Number(document.getElementById('heat-num').textContent) > 0);
      const hot = Number(await page.locator('#heat-num').innerText());
      await page.locator('#laylow').click();
      ok(/Laying low/.test(await page.locator('#now').innerText()), width + ' lay low says the routes are holding');
      await page.waitForFunction((was) => Number(document.getElementById('heat-num').textContent) < was, hot);
      const cooled = Number(await page.locator('#heat-num').innerText());
      const flat = cashOf(await page.locator('#cash').innerText());
      await page.waitForTimeout(500);
      ok(cooled < hot && cashOf(await page.locator('#cash').innerText()) === flat,
        width + ' lay low cools heat and holds the chain (' + hot + ' → ' + cooled + ')');
      await page.waitForFunction(() => (document.getElementById('laylow').textContent || '') === 'Lay low', null, { timeout: 8000 });
      await page.waitForFunction(() => /takes the book/.test(document.getElementById('log').textContent || ''), null, { timeout: 20000 });
      const heir = (await page.locator('#boss').innerText()).trim();
      ok(heir !== 'The Founder', width + ' an heir takes the book (' + heir + ')');
      const after = cashOf(await page.locator('#cash').innerText());
      const options = await page.locator('#haul option').evaluateAll((els) => els.map((el) => el.value).filter(Boolean));
      ok(options.length >= 2, width + ' two people are still on the book (' + options.join(', ') + ')');
      await page.locator('#haul').selectOption(options[0]);
      await page.locator('#drop').selectOption(options[1]);
      await page.waitForFunction((floor) => {
        const n = Number((document.getElementById('cash').textContent || '').replace(/\D/g, ''));
        return n > floor;
      }, after);
      ok(true, width + ' the chain pays again after the heir');
      await page.locator('#restart').click();
      await page.locator('#restart').click();
      ok((await page.locator('#boss').innerText()).trim() === 'The Founder'
        && cashOf(await page.locator('#cash').innerText()) === 100,
        width + ' restart restores the founder');
      await page.close();
    }

    await book(1280, 800);
    await book(390, 844);
    ok(errs.length === 0, 'zero page errors' + (errs[0] ? ' — ' + errs[0] : ''));
  } finally {
    await browser.close();
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  if (fail) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

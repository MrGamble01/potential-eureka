/* The crash course hid Open up shop below the fold.
 *
 * #intro-go lived inside the scrolling card, so at 390×844 and at
 * 1280×800 the first view stopped on the copy and the button was past
 * the card. The card now keeps the button in view and scrolls the copy.
 * The × still closes it. Hook-free.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const VIEWS = [
  { width: 390, height: 844, label: '390x844', mobile: true },
  { width: 1280, height: 800, label: '1280x800', mobile: false },
];

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);

  for (const view of VIEWS) {
    const ctx = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      isMobile: view.mobile,
      hasTouch: view.mobile,
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    await page.addInitScript(() => {
      localStorage.removeItem('drug-lab-v1');
      localStorage.removeItem('growop-intro-seen');
    });
    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
    await page.click('#diff-careful');
    await page.waitForFunction(() => document.getElementById('intro-modal').classList.contains('open'));

    const geo = await page.evaluate(() => {
      const go = document.getElementById('intro-go');
      const panel = document.querySelector('#intro-modal .diff-panel');
      const body = document.getElementById('intro-body');
      const close = document.getElementById('intro-close');
      const gr = go.getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      const cr = close.getBoundingClientRect();
      const x = gr.left + gr.width / 2, y = gr.top + gr.height / 2;
      const top = document.elementFromPoint(x, y);
      const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      const ctop = document.elementFromPoint(cx, cy);
      const inside = (r, box) => r.top >= box.top - 1 && r.bottom <= box.bottom + 1
        && r.left >= box.left - 1 && r.right <= box.right + 1;
      return {
        scroll: panel.scrollTop,
        bodyScrolls: body.scrollHeight > body.clientHeight + 4,
        go: { top: gr.top, bottom: gr.bottom, left: gr.left, right: gr.right },
        inView: gr.top >= 0 && gr.bottom <= innerHeight && gr.left >= 0 && gr.right <= innerWidth,
        inPanel: inside(gr, pr),
        goHit: top && (top === go || go.contains(top)),
        goName: top && (top.id || top.className || top.tagName),
        closeHit: !!(ctop && (ctop === close || close.contains(ctop))),
        closeOnScreen: cr.top >= 0 && cr.bottom <= innerHeight && cr.width > 8,
      };
    });

    ok(geo.scroll === 0, `${view.label}: the card has not been scrolled`);
    ok(geo.inView && geo.inPanel && geo.goHit,
      `${view.label}: Open up shop is in the card (${geo.goName}, y${Math.round(geo.go.top)}–${Math.round(geo.go.bottom)})`);
    ok(geo.bodyScrolls, `${view.label}: the copy still scrolls inside the card`);
    ok(geo.closeHit && geo.closeOnScreen, `${view.label}: × is on screen`);
    await page.click('#intro-go');
    const closed = await page.evaluate(() => !document.getElementById('intro-modal').classList.contains('open')
      && localStorage.getItem('growop-intro-seen') === '1');
    ok(closed, `${view.label}: Open up shop closes the course`);
    ok(errs.length === 0, `${view.label}: page errors (${errs.join('; ')})`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

/* HV-68 — Escape closes the event banner.
 *
 * City Sweep / Kind Stranger / etc. land in #event-banner. The ×
 * (closeEvent) already dismisses it; it also auto-hides after 7s.
 * Escape was only wired for the HV-56 intro and HV-58's Bridge —
 * neither sees this banner. Same class of drift as TYC-60 / HV-58.
 *
 * Hook-free. Reverting the hide fails the named assertion. Intro
 * Escape and Bridge Escape stay the other direction of the ticket.
 *
 * A. Source: main.js Escape hides #event-banner and never calls closeIntro.
 * B. A live event banner dismisses on Escape.
 * C. That Escape does not mark the crash course seen.
 * D. Escape still closes The Bridge.
 * Z. Zero page errors. ui.js untouched.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const evHandler = /document\.addEventListener\(\s*['"]keydown['"][\s\S]{0,500}event-banner[\s\S]{0,280}(display\s*=\s*['"]none['"]|closeEvent\s*\()/.exec(main);
ok(!!evHandler,
  'HV-68: main.js Escape handler hides #event-banner');
ok(evHandler ? !/closeIntro\s*\(/.test(evHandler[0]) : false,
  'HV-68: that handler does not call closeIntro()');
ok(/function closeEvent\(/.test(ui) && !/function closeEvent\(/.test(main),
  'ui.js still owns the × — we only added Escape in main.js');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(() => { localStorage.setItem('hv-intro-seen', '1'); });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    const shown = await page.evaluate(() => {
      const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
      showEvent(ev, true);
      const b = document.getElementById('event-banner');
      return !!(b && b.style.display === 'block');
    });
    ok(shown, 'Kind Stranger opens #event-banner');

    await page.evaluate(() => localStorage.removeItem('hv-intro-seen'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    const after = await page.evaluate(() => {
      const b = document.getElementById('event-banner');
      return {
        hidden: !b || b.style.display === 'none' || b.style.display === '',
        display: b ? b.style.display : '',
        intro: document.getElementById('intro-modal').classList.contains('open'),
        seen: localStorage.getItem('hv-intro-seen'),
      };
    });
    ok(after.display === 'none',
      `HV-68: Escape closes the event banner (display=${after.display})`);
    ok(!after.intro && after.seen !== '1',
      'HV-68: Escape on the banner does not dismiss or mark the intro seen');

    ok(errs.length === 0, `banner path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { localStorage.setItem('hv-intro-seen', '1'); });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);
    await page.click('#chain-btn');
    await page.waitForSelector('#chain-modal.open', { timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const closed = await page.$eval('#chain-modal', el => !el.classList.contains('open'));
    ok(closed, 'Escape still closes The Bridge');
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

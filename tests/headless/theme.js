/* IDEA-SITE-6 — theme system.
   Cycle through all four themes: data-theme + persisted key + actual
   computed colors change; stored pick survives reload with no flash;
   prefers-color-scheme: light defaults to daylight when nothing stored. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const errs = [];
  {
    const page = await (await browser.newContext({ colorScheme: 'dark' })).newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    const probe = () => page.evaluate(() => ({
      theme: document.documentElement.dataset.theme || '',
      stored: localStorage.getItem('eureka-theme'),
      primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
      text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
      surface: getComputedStyle(document.documentElement).getPropertyValue('--color-black-surface').trim(),
    }));

    const t0 = await probe();
    ok(t0.theme === '' && /6C63FF/i.test(t0.primary),
       `dark system boots on default midnight (primary ${t0.primary})`);

    const seen = [t0.primary];
    const names = [];
    for (let i = 0; i < 3; i++) {
      await page.click('#nav-theme-toggle');
      await page.waitForTimeout(200);
      const t = await probe();
      names.push(t.theme);
      seen.push(t.primary);
      ok(t.stored === t.theme, `pick persisted (${t.theme || 'default'})`);
    }
    ok(names.join(',') === 'crt,synthwave,daylight', `cycle order crt → synthwave → daylight (${names.join(',')})`);
    ok(new Set(seen).size === 4, `each theme has a distinct primary (${seen.join(' | ')})`);

    // Daylight actually goes light
    const day = await probe();
    ok(/^#[ef]/i.test(day.surface), `daylight surface token is light (${day.surface})`);

    // Survives reload
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(600);
    const re = await probe();
    ok(re.theme === 'daylight', 'stored theme survives reload');

    // Cycle wraps back to default
    await page.click('#nav-theme-toggle');
    await page.waitForTimeout(200);
    const back = await probe();
    ok(back.theme === '' && back.stored === '', 'cycle wraps back to default');
    await page.context().close();
  }

  // prefers-color-scheme: light default
  {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const t = await page.evaluate(() => document.documentElement.dataset.theme || '');
    ok(t === 'daylight', `light-preferring system defaults to daylight (${t})`);
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

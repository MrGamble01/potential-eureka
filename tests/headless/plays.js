const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const GAMES = [
  ['gutterlight', 'Gutterlight'],
  ['crateescape', 'Crate Escape'],
  ['tetris', 'Tetris'],
];
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 20000 });
    for (const [id, title] of GAMES) {
      await page.evaluate((name) => { location.hash = '#' + name; }, id);
      await page.waitForTimeout(1500);
      await page.evaluate(() => { location.hash = '#arcade'; });
      await page.waitForTimeout(500);
      const book = await page.evaluate((name) => {
        const stats = JSON.parse(localStorage.getItem('eureka-stats') || '{}');
        const chip = document.querySelector('#jump-back-in .resume-chip');
        return {
          launches: stats.launches ? stats.launches[name] || 0 : 0,
          seconds: stats.seconds ? stats.seconds[name] || 0 : 0,
          chip: chip ? chip.textContent.replace(/\s+/g, ' ').trim() : '',
        };
      }, id);
      ok(book.launches === 1 && book.seconds >= 1,
        title + ' records a play (' + book.launches + ' launches, ' + book.seconds + 's)');
      ok(book.chip.indexOf(title) === 0, title + ' shows on Jump back in (' + book.chip + ')');
    }
    ok(errs.length === 0, 'no page errors' + (errs[0] ? ' - ' + errs[0] : ''));
  } finally {
    await browser.close();
  }
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

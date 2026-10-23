const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  try {
    await page.goto(BASE + '/tycoon/play.html?theme=beagle', { waitUntil: 'load', timeout: 45000 });
    const start = page.locator('#welcome-start-btn');
    if (await start.count()) await start.click();
    await page.waitForSelector('#bgl-act-howl');
    await page.evaluate(() => {
      const panel = document.getElementById('left-panel');
      if (panel) panel.classList.remove('open');
      const backdrop = document.getElementById('drawer-backdrop');
      if (backdrop) backdrop.classList.remove('open');
    });
    await page.waitForTimeout(250);
    const canvases = await page.evaluate(() => document.querySelectorAll('body > canvas').length);
    ok(canvases === 1, 'one body canvas (' + canvases + ')');

    const pushed = await page.evaluate(() => {
      const body = document.getElementById('bgl-body');
      const spacer = document.createElement('div');
      spacer.style.cssText = 'height:280px;flex:none';
      body.insertBefore(spacer, document.getElementById('bgl-actions'));
      const el = document.getElementById('bgl-act-howl');
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const yard = document.getElementById('bgl-yard').getBoundingClientRect();
      return {
        inside: !!(hit && el.contains(hit)),
        hit: hit && (hit.id || hit.className || hit.tagName),
        y: Math.round(r.top + r.height / 2),
        yardTop: Math.round(yard.top),
        yardBottom: Math.round(yard.bottom),
      };
    });
    ok(pushed.inside && pushed.y > pushed.yardTop && pushed.y < pushed.yardBottom,
      'a tall yard still hits Howl (' + pushed.hit + ' @' + pushed.y + ')');

    const grown = await page.evaluate(() => {
      const mh = document.getElementById('metrics-hud');
      mh.style.maxHeight = 'none';
      mh.style.height = '400px';
      mh.style.width = '220px';
      const cash = document.getElementById('cash-hud');
      cash.style.width = '300px';
      cash.style.height = '80px';
      const el = document.getElementById('bgl-act-howl');
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { inside: !!(hit && el.contains(hit)), hit: hit && (hit.id || hit.className || hit.tagName) };
    });
    ok(grown.inside, 'grown cash and metrics still hit Howl (' + grown.hit + ')');
  } finally {
    await browser.close();
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ' - ' + errs[0] : ''));
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

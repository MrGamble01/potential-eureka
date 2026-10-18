/* Phone: THE CORNER was under the Wait button.
 *
 * #lab-tray is bottom-right and wraps. At 390px the wrap lands
 * #chain-toggle on top of #next-step, and the dock (z-index 45) wins
 * the hit test, so the corner tap harvests instead. The tray keeps a
 * left edge past the dock. Hook-free.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function overlapArea(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
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
  await page.click('#intro-go');

  const geo = await page.evaluate(() => {
    const box = id => {
      const el = document.getElementById(id);
      const b = el.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      const top = document.elementFromPoint(x, y);
      const self = !!(top && (top === el || el.contains(top) || top.contains(el)));
      return {
        id,
        left: b.left, top: b.top, right: b.right, bottom: b.bottom,
        width: b.width, height: b.height,
        self,
        hit: top && (top.id || top.className || top.tagName),
      };
    };
    const tray = document.getElementById('lab-tray').getBoundingClientRect();
    const kids = [...document.querySelectorAll('#lab-tray > *')].map(el => {
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return null;
      return {
        id: el.id,
        width: Math.round(b.width),
        clipped: el.scrollWidth > el.clientWidth + 1,
        past: b.right > tray.right + 1 || b.left < tray.left - 1,
      };
    }).filter(Boolean);
    return {
      corner: box('chain-toggle'),
      step: box('next-step'),
      stick: box('stick'),
      sfx: box('sfx-btn'),
      alley: box('alley-btn'),
      manage: box('manage-btn'),
      help: box('lab-help-btn'),
      kids,
    };
  });

  ok(geo.corner.self && geo.corner.hit === 'chain-toggle',
    `THE CORNER owns its centre (${geo.corner.hit})`);
  ok(geo.step.self, `Wait owns its centre (${geo.step.hit})`);
  ok(overlapArea(geo.corner, geo.step) <= 4, 'THE CORNER and Wait do not share a box');
  ok(geo.corner.top >= 0 && geo.corner.bottom <= 844 && geo.corner.left >= 0 && geo.corner.right <= 390,
    'THE CORNER is on the 390px screen');
  for (const row of [geo.stick, geo.sfx, geo.alley, geo.manage, geo.help]) {
    ok(row.self, `${row.id} owns its centre (${row.hit})`);
  }
  const bad = geo.kids.filter(k => k.clipped || k.past);
  ok(bad.length === 0, `tray buttons stay inside the tray${bad.length ? ' — ' + JSON.stringify(bad) : ''}`);
  ok(errs.length === 0, `page errors (${errs.join('; ')})`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

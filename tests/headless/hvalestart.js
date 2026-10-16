/* Hearthvale welcome — the start of the valley stays clickable.
 *
 * The welcome card scrolled as one piece. On a short laptop (1024×640)
 * Begin building sat entirely below the card, and on a 700px-tall phone
 * its centre landed on the backdrop. At 1280×800 the Games link did the
 * same. A click there never started the town.
 *
 * Hook-free. Real clicks, no test hooks.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const VIEWPORTS = [
  [1280, 800],
  [1280, 720],
  [1024, 640],
  [768, 700],
  [390, 844],
  [390, 700],
];

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errs = [];

  const open = async (width, height) => {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    await page.addInitScript(() => localStorage.removeItem('hearthvale-v1'));
    await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load' });
    await page.waitForTimeout(700);
    return { ctx, page };
  };

  const owns = (page, selector) => page.evaluate(sel => {
    const el = document.querySelector(sel);
    const card = document.querySelector('#welcome .trader-card');
    if (!el || !card) return { inside: false, owns: false };
    const b = el.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const inside = b.width > 2 && b.height > 2
      && b.top >= c.top - 1 && b.bottom <= c.bottom + 1
      && b.left >= c.left - 1 && b.right <= c.right + 1
      && b.top >= -1 && b.bottom <= innerHeight + 1
      && b.left >= -1 && b.right <= innerWidth + 1;
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { inside, owns: !!(hit && (hit === el || el.contains(hit))) };
  }, selector);

  for (const [w, h] of VIEWPORTS) {
    const { ctx, page } = await open(w, h);
    const welcome = await page.evaluate(() => document.getElementById('welcome').classList.contains('show'));
    ok(welcome, `${w}×${h}: a fresh valley opens on the welcome`);
    for (const [sel, name] of [['#welcome-close', 'Begin building'], ['#welcome a.ea-back', 'Games']]) {
      const box = await owns(page, sel);
      ok(box.inside && box.owns, `${w}×${h}: ${name} stays inside the card and owns its centre`);
    }
    await page.locator('#welcome .welcome-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const pinned = await owns(page, '#welcome-close');
    ok(pinned.inside && pinned.owns, `${w}×${h}: scrolling the tutorial does not unpin Begin building`);
    await page.locator('#diffsel [data-diff="normal"]').scrollIntoViewIfNeeded();
    const pace = await owns(page, '#diffsel [data-diff="normal"]');
    ok(pace.inside && pace.owns, `${w}×${h}: Wayfarer stays reachable in the tutorial`);
    await ctx.close();
  }

  // The viewport that used to hide the start button entirely.
  {
    const { ctx, page } = await open(1024, 640);
    await page.fill('#townname-input', 'Riverside');
    await page.click('#welcome-close');
    await page.waitForTimeout(200);
    const started = await page.evaluate(() => {
      const welcome = document.getElementById('welcome');
      const house = document.querySelector('#buildbar .btn[data-type="house"]');
      const hb = house && house.getBoundingClientRect();
      const hit = hb && document.elementFromPoint(hb.left + hb.width / 2, hb.top + hb.height / 2);
      const save = JSON.parse(localStorage.getItem('hearthvale-v1') || 'null');
      return {
        open: !!(welcome && welcome.classList.contains('show')),
        name: save && save.townName,
        wood: save && save.res && save.res.wood,
        houseOwns: !!(hit && (hit === house || house.contains(hit))),
      };
    });
    ok(!started.open && started.name === 'Riverside' && started.wood === 40 && started.houseOwns,
      '1024×640: Begin building names the town and leaves the cottage button clickable');
    await page.click('#buildbar .btn[data-type="house"]');
    // Starter clearing, camera {x: startX*16-200, y: startY*16-150, z: 3}.
    // Tile (19, 17) is open grass beside that lane; a cottage is 2×2.
    await page.mouse.click(768, 282);
    await page.waitForTimeout(250);
    const placed = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('hearthvale-v1') || 'null');
      const house = save && (save.buildings || []).find(b => b.type === 'house');
      return {
        wood: save && save.res && save.res.wood,
        tx: house && house.tx, ty: house && house.ty,
      };
    });
    ok(placed.wood === 28 && placed.tx === 19 && placed.ty === 17,
      '1024×640: clicking the clearing places a cottage and spends 12 wood');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

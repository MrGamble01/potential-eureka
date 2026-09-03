/* AOW-19b — the war-banner pill row in Age of War's HUD.

   The banner row was marked up with `class="aow-diff"`, the same class as
   the difficulty pill row. The Settings modal's difficulty handler fans out
   over `.aow-diff button` and clears `.active` on anything whose
   `data-diff` doesn't match — which swept the banner buttons too. Result:
   pick a banner, change difficulty from Settings, and the HUD showed no
   banner selected while the banner was still in force. Clicking it again to
   "re-select" it restarted the battle for nothing.

   The row now carries its own `.aow-banner-pills` class (styled identically),
   so difficulty code can't reach it. This suite pins the behaviour and the
   look. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const welcome = await page.$('#aow-welcome-close');
  if (welcome && await welcome.isVisible()) { await welcome.click(); await page.waitForTimeout(300); }

  const probe = () => page.evaluate(() => ({
    banner: localStorage.getItem('aow-banner'),
    difficulty: localStorage.getItem('aow-difficulty'),
    bannerOn: [...document.querySelectorAll('#aow-banner button')]
      .filter(b => b.classList.contains('active')).map(b => b.dataset.banner),
    hudDiffOn: [...document.querySelectorAll('#aow-diff button')]
      .filter(b => b.classList.contains('active')).map(b => b.dataset.diff),
    modalDiffOn: [...document.querySelectorAll('#aow-diff-modal button')]
      .filter(b => b.classList.contains('active')).map(b => b.dataset.diff),
  }));

  // The class swap must not leave the banner row reachable as a difficulty row.
  const collision = await page.evaluate(() =>
    document.querySelectorAll('#aow-banner.aow-diff, #aow-banner .aow-diff').length);
  ok(collision === 0, 'banner row no longer answers to the .aow-diff selector');

  await page.click('#aow-banner button[data-banner="charge"]');
  await page.waitForTimeout(400);
  let s = await probe();
  ok(s.banner === 'charge' && s.bannerOn.join() === 'charge',
     `picking a banner marks it and persists it (${s.banner} / [${s.bannerOn}])`);

  // The regression: difficulty from the Settings modal used to blank this row.
  await page.click('#aow-settings-btn');
  await page.waitForTimeout(300);
  await page.click('#aow-diff-modal button[data-diff="hard"]');
  await page.waitForTimeout(500);
  s = await probe();
  ok(s.bannerOn.join() === 'charge',
     `Settings-modal difficulty leaves the banner highlighted (in force: ${s.banner}, shown: [${s.bannerOn}])`);
  ok(s.banner === 'charge', 'the banner itself is still the one in force');
  ok(s.difficulty === 'hard' && s.hudDiffOn.join() === 'hard',
     `the difficulty change still lands in both places (${s.difficulty} / [${s.hudDiffOn}])`);

  // ...and so must the HUD difficulty row.
  await page.click('#aow-diff button[data-diff="insane"]');
  await page.waitForTimeout(500);
  s = await probe();
  ok(s.bannerOn.join() === 'charge' && s.banner === 'charge',
     `HUD difficulty leaves the banner highlighted ([${s.bannerOn}])`);
  ok(s.hudDiffOn.join() === 'insane', `HUD difficulty pill follows the click ([${s.hudDiffOn}])`);

  // Switching banners still moves the highlight (exactly one selected, always).
  await page.click('#aow-banner button[data-banner="toll"]');
  await page.waitForTimeout(500);
  s = await probe();
  ok(s.bannerOn.join() === 'toll' && s.banner === 'toll',
     `switching banners moves the highlight ([${s.bannerOn}])`);

  // Reopening Settings syncs its own pills without disturbing the banner.
  await page.click('#aow-settings-btn');
  await page.waitForTimeout(300);
  s = await probe();
  ok(s.modalDiffOn.join() === 'insane' && s.bannerOn.join() === 'toll',
     `reopening Settings syncs its pills and leaves the banner alone ([${s.modalDiffOn}] / [${s.bannerOn}])`);
  await page.click('#aow-settings-close');
  await page.waitForTimeout(200);

  // The banner still survives a reload as the selected one.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  s = await probe();
  ok(s.bannerOn.join() === 'toll', `saved banner boots highlighted ([${s.bannerOn}])`);

  // Look parity: the row is restyled, not re-skinned.
  const look = await page.evaluate(() => {
    const keys = ['display', 'backgroundColor', 'borderRadius', 'padding', 'gap', 'borderTopWidth'];
    const grab = el => { const cs = getComputedStyle(el); return keys.map(k => cs[k]).join('|'); };
    const btn = el => {
      const cs = getComputedStyle(el.querySelector('button'));
      return ['fontSize', 'fontWeight', 'letterSpacing', 'borderRadius', 'textTransform'].map(k => cs[k]).join('|');
    };
    const d = document.getElementById('aow-diff'), b = document.getElementById('aow-banner');
    return { rowSame: grab(d) === grab(b), btnSame: btn(d) === btn(b), row: grab(b), btn: btn(b) };
  });
  ok(look.rowSame, `banner row is styled like the difficulty row (${look.row})`);
  ok(look.btnSame, `banner buttons are styled like difficulty buttons (${look.btn})`);

  const activeLook = await page.evaluate(() => {
    const on = document.querySelector('#aow-banner button.active');
    const off = document.querySelector('#aow-banner button:not(.active)');
    if (!on || !off) return { differs: false, on: 'none' };
    const bg = el => getComputedStyle(el).backgroundColor;
    return { differs: bg(on) !== bg(off), on: bg(on) };
  });
  ok(activeLook.differs, `the selected banner reads as selected (${activeLook.on})`);

  // Phones hide both pill rows — the class swap must not resurrect one.
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(400);
  const hidden = await page.evaluate(() => ({
    diff: getComputedStyle(document.getElementById('aow-diff')).display,
    banner: getComputedStyle(document.getElementById('aow-banner')).display,
  }));
  ok(hidden.diff === 'none' && hidden.banner === 'none',
     `both pill rows stay hidden on a phone (diff ${hidden.diff}, banner ${hidden.banner})`);

  await ctx.close();
  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

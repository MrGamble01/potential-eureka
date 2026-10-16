/* AOW-19b — Age of War forgot which war banner you were flying.

   The HUD's war-banner row (#aow-banner) wears the same `.aow-diff` class
   as the difficulty pills, purely for the look. The Settings modal's
   difficulty handler repainted `.aow-diff button` — every pill on the page —
   toggling `.active` on `dataset.diff === difficulty`. No banner button has
   a data-diff, so all four went dark while the banner was still saved and
   still applied to every new unit. The only way to find out which banner
   was in force was to click one, and switching banners restarts the run.

   The handler now repaints `button[data-diff]` only. This suite drives the
   real page: pick a banner, change difficulty from Settings and from the
   HUD, switch banners, reopen Settings, reload — the banner highlight must
   track `warBanner` throughout, and each pill row must show exactly one
   selection. Against the old fan-out the Settings step and everything
   downstream of it fail by name. No `window.__` hooks (QA-23). */
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

  await page.addInitScript(() => { try { localStorage.setItem('aow-welcome-seen', '1'); } catch (e) {} });
  await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const welcome = await page.$('#aow-welcome-close');
  if (welcome && await welcome.isVisible()) { await welcome.click(); await page.waitForTimeout(300); }

  const probe = () => page.evaluate(() => {
    const on = sel => [...document.querySelectorAll(sel + ' button.active')];
    return {
      banner: localStorage.getItem('aow-banner'),
      difficulty: localStorage.getItem('aow-difficulty'),
      bannerOn: on('#aow-banner').map(b => b.dataset.banner),
      hudDiffOn: on('#aow-diff').map(b => b.dataset.diff),
      modalDiffOn: on('#aow-diff-modal').map(b => b.dataset.diff),
      settingsOpen: getComputedStyle(document.getElementById('aow-settings-modal')).display !== 'none',
    };
  });
  const oneEach = s => s.bannerOn.length === 1 && s.hudDiffOn.length === 1 && s.modalDiffOn.length === 1;

  // Fresh profile: no banner, Normal difficulty, one selection per row.
  let s = await probe();
  ok(s.bannerOn.join() === 'none' && s.hudDiffOn.join() === 'normal',
     `fresh boot shows no banner and Normal difficulty ([${s.bannerOn}] / [${s.hudDiffOn}])`);

  await page.click('#aow-banner button[data-banner="charge"]');
  await page.waitForTimeout(400);
  s = await probe();
  ok(s.banner === 'charge' && s.bannerOn.join() === 'charge',
     `picking a banner marks it and persists it (${s.banner} / [${s.bannerOn}])`);

  // The regression: difficulty from the Settings modal used to blank this row.
  await page.click('#aow-settings-btn');
  await page.waitForTimeout(300);
  await page.click('#aow-diff-modal button[data-diff="hard"]');
  await page.waitForTimeout(500);
  s = await probe();
  ok(s.bannerOn.join() === 'charge',
     `Settings difficulty leaves the banner highlighted (in force: ${s.banner}, shown: [${s.bannerOn}])`);
  ok(s.banner === 'charge', 'the banner in force is unchanged by a difficulty change');
  ok(s.difficulty === 'hard' && s.hudDiffOn.join() === 'hard' && s.modalDiffOn.join() === 'hard',
     `the difficulty change still lands in storage and both pill rows (${s.difficulty} / [${s.hudDiffOn}] / [${s.modalDiffOn}])`);
  ok(oneEach(s), 'every pill row shows exactly one selection after a Settings difficulty change');
  ok(!s.settingsOpen, 'Settings closes after picking a difficulty (the run restarts, as before)');

  // ...and the HUD difficulty row never had the bug; keep it that way.
  await page.click('#aow-diff button[data-diff="insane"]');
  await page.waitForTimeout(500);
  s = await probe();
  ok(s.bannerOn.join() === 'charge' && s.banner === 'charge',
     `HUD difficulty leaves the banner highlighted ([${s.bannerOn}])`);
  ok(s.hudDiffOn.join() === 'insane', `HUD difficulty pill follows the click ([${s.hudDiffOn}])`);

  // Switching banners still moves the highlight — exactly one selected.
  await page.click('#aow-banner button[data-banner="toll"]');
  await page.waitForTimeout(500);
  s = await probe();
  ok(s.bannerOn.join() === 'toll' && s.banner === 'toll',
     `switching banners moves the highlight ([${s.bannerOn}])`);

  // Reopening Settings syncs its own pills and leaves the banner alone.
  await page.click('#aow-settings-btn');
  await page.waitForTimeout(300);
  s = await probe();
  ok(s.modalDiffOn.join() === 'insane' && s.bannerOn.join() === 'toll',
     `reopening Settings syncs its pills and leaves the banner alone ([${s.modalDiffOn}] / [${s.bannerOn}])`);

  // A second Settings change, now with a non-default banner and difficulty
  // already in play — the row must still read the saved banner afterwards.
  await page.click('#aow-diff-modal button[data-diff="easy"]');
  await page.waitForTimeout(500);
  s = await probe();
  ok(s.bannerOn.join() === 'toll' && s.difficulty === 'easy' && oneEach(s),
     `a second Settings difficulty change keeps the banner lit ([${s.bannerOn}], ${s.difficulty})`);

  // The banner still survives a reload as the selected one.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  s = await probe();
  ok(s.bannerOn.join() === 'toll' && s.hudDiffOn.join() === 'easy',
     `saved banner and difficulty boot highlighted ([${s.bannerOn}] / [${s.hudDiffOn}])`);

  // The selected banner must still *read* as selected — the row keeps the
  // difficulty pills' look, so the active style has to differ from idle.
  const activeLook = await page.evaluate(() => {
    const on = document.querySelector('#aow-banner button.active');
    const off = document.querySelector('#aow-banner button:not(.active)');
    if (!on || !off) return { differs: false, on: 'none' };
    const bg = el => getComputedStyle(el).backgroundColor;
    return { differs: bg(on) !== bg(off), on: bg(on) };
  });
  ok(activeLook.differs, `the selected banner reads as selected (${activeLook.on})`);

  await ctx.close();
  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

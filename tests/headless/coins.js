/* IDEA-SITE-5 — coins + cosmetics.
   Achievements mint coins retroactively and exactly once; the shop
   sells and equips accents; the accent actually changes --primary and
   survives reload; unaffordable chips are disabled.

   COIN-1 (the last block): the coin pill and the achievement pill are the
   same fixed corner, and switchView() fires them together — check() then
   credit() — so the reward covered the trophy that earned it, and the
   message carried a second 🪙 on top of the one the pill already draws. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ colorScheme: 'dark' })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Seed 4 achievements → 40 coins on next credit
  await page.evaluate(() => {
    localStorage.setItem('arcade-achievements', JSON.stringify({
      'first-light': 1, 'snake-100': 2, 'regular': 3, 'rivalry': 4 }));
  });
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(800);
  const s1 = await page.evaluate(() => Coins.load());
  ok(s1.balance === 40, `4 trophies mint 40 coins retroactively (${s1.balance})`);
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => Coins.load().balance) === 40, 'minting is idempotent — no double pay');

  // Shop: gold (60) disabled at 40 coins; buy ember (30) → equips, accent applies
  const goldDisabled = await page.evaluate(() =>
    document.querySelector('.shop-chip[data-pal="gold"]').disabled);
  ok(goldDisabled, 'unaffordable palette is disabled');
  await page.click('.shop-chip[data-pal="ember"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    st: Coins.load(),
    accent: document.documentElement.dataset.accent,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
  }));
  ok(after.st.balance === 10 && after.st.owned.ember, `Ember bought (balance ${after.st.balance})`);
  ok(after.accent === 'ember' && /F0883E/i.test(after.primary), `accent applied (--primary ${after.primary})`);

  // Survives reload
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  const re = await page.evaluate(() => ({
    accent: document.documentElement.dataset.accent,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
  }));
  ok(re.accent === 'ember' && /F0883E/i.test(re.primary), 'equipped accent survives reload');

  // Back to indigo clears the attribute
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(600);
  await page.click('.shop-chip[data-pal="indigo"]');
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => ({
    accent: document.documentElement.dataset.accent || null,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
  }));
  ok(back.accent === null && /6C63FF/i.test(back.primary), 'indigo restores the default tokens');

  // ── COIN-1: the two pills that always arrive together ──────────────────
  // A fresh profile, one real unlock. Achievements.check() toasts the trophy
  // and Coins.credit() toasts the coins in the same switchView() tick, so
  // this is the ordinary path, not a contrived one.
  {
    const ctx2 = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await p2.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p2.waitForTimeout(1000);
    await p2.evaluate(() => { localStorage.setItem('snake-high', '120'); });   // First Light + Garden Menace
    await p2.evaluate(() => { location.hash = '#halloffame'; });
    await p2.waitForTimeout(600);

    const pills = await p2.evaluate(() => [...document.querySelectorAll('.ach-toast')].map(el => {
      const r = el.getBoundingClientRect();
      return { coin: el.id === 'coin-toast', text: el.innerText,
               top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }));
    const coin = pills.find(p => p.coin), trophy = pills.find(p => !p.coin);
    ok(!!coin && !!trophy, `both pills are up at once (${pills.length} on screen)`);

    // The message must not repeat the icon the pill already draws.
    const coins = coin ? (coin.text.match(/🪙/g) || []).length : -1;
    ok(coins === 1, `the coin pill shows one 🪙, not two — "${(coin || {}).text}"`);

    // Overlap is the bug: the trophy was fully behind the reward.
    const overlap = coin && trophy &&
      coin.left < trophy.right && coin.right > trophy.left &&
      coin.top < trophy.bottom && coin.bottom > trophy.top;
    ok(coin && trophy && !overlap,
      `the coin pill stacks clear of the trophy pill` +
      (overlap ? ` — they overlap (coin ${Math.round(coin.top)}–${Math.round(coin.bottom)}, ` +
                 `trophy ${Math.round(trophy.top)}–${Math.round(trophy.bottom)})` : ''));
    ok(coin && trophy && coin.bottom <= trophy.top,
      'the coin pill sits above the trophy, not off the bottom of the screen');
    ok(coin && coin.top >= 0, 'and the stack stays on screen');

    // Alone, the pill must fall back to the slot the stylesheet gives it —
    // stacking is a response to company, not a permanent offset.
    // Two trophies unlocked here and the achievement queue shows them one at
    // a time, so wait the queue out rather than a fixed beat.
    await p2.waitForFunction(
      () => ![...document.querySelectorAll('.ach-toast')].some(el => el.id !== 'coin-toast'),
      null, { timeout: 15000 });
    const solo = await p2.evaluate(() => {
      const st = Coins.load(); st.balance = 100;         // afford the accent this clicks
      localStorage.setItem('arcade-coins', JSON.stringify(st));
      Coins.renderInto('hof-shop');
      document.querySelector('.shop-chip[data-pal="ember"]').click();
      const el = document.getElementById('coin-toast');
      return { bottom: getComputedStyle(el).bottom, others: document.querySelectorAll('.ach-toast').length };
    });
    ok(solo.others === 1 && solo.bottom === '18px',
      `alone, the pill returns to the stylesheet's corner (bottom ${solo.bottom})`);
    await ctx2.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

/* IDEA-SITE-5 — coins + cosmetics.
   Achievements mint coins retroactively and exactly once; the shop
   sells and equips accents; the accent actually changes --primary and
   survives reload; unaffordable chips are disabled. */
const { chromium } = require('playwright');
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

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

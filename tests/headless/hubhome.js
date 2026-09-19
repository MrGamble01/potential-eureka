/*
 * SITE — homepage leftover polish after the Long/Quick split.
 *
 *  A. One primary path: Age of War is the only hero CTA.
 *  B. Snake is still a hop, not a second door the same size.
 *  C. The kicker still counts the catalogue the primer claims.
 *  D. Long / Quick / Studio scan: heads, counts, jump buttons.
 *  E. Search still filters across both catalogues.
 *  F. Challenge, primer and patch notes still live in the secondary nav.
 *  G. PLAY rows line up after the 16:10 normalize leftovers.
 *  H. ~900×700 lays out three long-game columns without overflowing.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production hub.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => localStorage.setItem('eureka-primer-seen', '1'));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1800);

  const hero = await page.evaluate(() => {
    const flag = document.querySelector('.arcade-flagship');
    const ctas = [...document.querySelectorAll('.hero-cta')];
    const quickDoor = document.querySelector('.hero-cta--quick');
    const snakeHop = document.querySelector('.hero-alt-link[data-view="snake"]');
    const kicker = (document.querySelector('.arcade-hero-kicker') || {}).textContent || '';
    return {
      flagHref: flag && flag.getAttribute('href'),
      ctaCount: ctas.length,
      flagCta: ctas.some(c => /Play Age of War/.test(c.textContent)),
      quickDoor: !!quickDoor,
      snakeHop: !!(snakeHop && /Snake/.test(snakeHop.textContent)),
      twentyOne: /\bTWENTY-ONE\b/.test(kicker),
    };
  });
  ok(hero.flagHref === 'ageofwar' && hero.flagCta && hero.ctaCount === 1,
    'the only hero CTA is Play Age of War, on the flagship billboard');
  ok(!hero.quickDoor && hero.snakeHop,
    'Snake is a text hop under the billboard, not a second primary door');
  ok(hero.twentyOne, 'the kicker still counts twenty-one games');

  const scan = await page.evaluate(() => {
    const long = document.querySelector('[data-section="long"]');
    const quick = document.querySelector('[data-section="quick"]');
    const studio = document.querySelector('[data-section="studio"]');
    const jumps = [...document.querySelectorAll('[data-jump]')].map(b => b.dataset.jump);
    return {
      longTitle: !!(long && /Long games/.test(long.textContent) && /6/.test((long.querySelector('.arcade-section-count') || {}).textContent || '')),
      quickTitle: !!(quick && /Quick games/.test(quick.textContent) && /15/.test((quick.querySelector('.arcade-section-count') || {}).textContent || '')),
      studio: !!(studio && /Studio/.test((studio.querySelector('.arcade-section-title') || {}).textContent || '')),
      jumps: ['long', 'quick', 'studio'].every(k => jumps.includes(k)),
      longCards: long ? long.querySelectorAll('.arcade-card').length : 0,
      quickCards: quick ? quick.querySelectorAll('.arcade-card').length : 0,
    };
  });
  ok(scan.longTitle && scan.longCards === 6, 'Long games is labeled, counted, and holds the six flagships');
  ok(scan.quickTitle && scan.quickCards === 15, 'Quick games is labeled, counted, and holds the fifteen arcade titles');
  ok(scan.studio && scan.jumps, 'Studio is labeled and the scan hops reach long, quick and studio');

  await page.click('.arcade-scan-link--quick');
  await page.waitForTimeout(1600);
  const jumped = await page.evaluate(() => {
    const q = document.querySelector('[data-section="quick"]');
    const r = q.getBoundingClientRect();
    return r.top >= 0 && r.top < window.innerHeight * 0.55;
  });
  ok(jumped, 'the Quick scan hop lands the Quick section on screen');

  await page.fill('#card-search', 'hours');
  await page.waitForTimeout(300);
  const filtered = await page.evaluate(() => ({
    count: document.getElementById('card-search-count').textContent,
    longHidden: document.querySelector('[data-section="long"]').hidden,
    quickHidden: document.querySelector('[data-section="quick"]').hidden,
    scanHidden: getComputedStyle(document.querySelector('.arcade-scan')).display === 'none',
  }));
  ok(filtered.count === '6 games' && !filtered.longHidden && filtered.quickHidden && filtered.scanHidden,
    'searching "hours" keeps Long, hides Quick, and tucks the scan bar');

  await page.fill('#card-search', '');
  await page.waitForTimeout(200);

  const secondary = await page.evaluate(() => ({
    primer: !!document.getElementById('primer-btn'),
    patch: !!document.getElementById('patch-notes-btn'),
    challenge: !!document.getElementById('challenge-jump-btn'),
    hof: !!document.querySelector('.arcade-secondary-nav [data-view="halloffame"]'),
  }));
  ok(secondary.primer && secondary.patch && secondary.challenge && secondary.hof,
    'How it works, Patch Notes, Challenge and Hall of Fame stay in the secondary nav');

  await page.click('#challenge-jump-btn');
  await page.waitForTimeout(400);
  const dailyOnScreen = await page.evaluate(() => {
    const b = document.getElementById('daily-banner');
    const r = b.getBoundingClientRect();
    return r.top >= 0 && r.top < window.innerHeight;
  });
  ok(dailyOnScreen, 'Challenge still scrolls to today\'s banner');

  const playLined = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.arcade-grid--long .arcade-card')];
    const rowTop = Math.round(cards[0].getBoundingClientRect().top);
    const bottoms = cards
      .filter(c => Math.round(c.getBoundingClientRect().top) === rowTop)
      .map(c => Math.round(c.querySelector('.arcade-card-play').getBoundingClientRect().bottom));
    return bottoms.length >= 2 && Math.max(...bottoms) - Math.min(...bottoms) <= 2;
  });
  ok(playLined, 'PLAY sits on one baseline across a Long-game row');

  const tablet = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const tp = await tablet.newPage();
  const errs2 = [];
  tp.on('pageerror', e => errs2.push(String(e).slice(0, 300)));
  await tp.addInitScript(() => localStorage.setItem('eureka-primer-seen', '1'));
  await tp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await tp.waitForTimeout(1800);
  const dense = await tp.evaluate(() => {
    const cards = [...document.querySelectorAll('.arcade-grid--long .arcade-card')];
    const tops = [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)))];
    const firstRow = cards.filter(c => Math.round(c.getBoundingClientRect().top) === tops[0]);
    return {
      cols: firstRow.length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      cta: document.querySelectorAll('.hero-cta').length,
      flagship: !!document.querySelector('.arcade-flagship'),
    };
  });
  ok(dense.cols === 3 && !dense.overflow,
    `900×700 shows the six long games three-across without overflow (${dense.cols} cols)`);
  ok(dense.cta === 1 && dense.flagship,
    'the tablet hero still has one Age of War path');

  await browser.close();
  ok(errs.length === 0 && errs2.length === 0,
    `no page errors${errs.length ? ' — ' + errs[0] : errs2.length ? ' — ' + errs2[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

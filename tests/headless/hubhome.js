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
 *  I. Empty filter is a state, not a blank catalogue.
 *  J. A Long hop during search clears the filter and lands.
 *  K. Studio stays one card wide after the 3-across density pass.
 *  L. Age of War's catalogue card shares the billboard's flagship mark.
 *  M. Clearing the filter drops the scan "you are here" mark.
 *  N. 720×700 keeps the compact flagship — not a 16:9 stack that
 *     pushes Long games off the fold.
 *  O. Filter mode tucks daily / resume / primer so a miss is the page.
 *  P. Challenge and a daily chip clear an armed filter.
 *  Q. Leaving a game drops the scan "you are here" mark.
 *  R. ~390 first-visit: Long games start on the fold (primer/daily
 *     no longer sit between scan and the catalogue).
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

  await page.fill('#card-search', 'zzzz');
  await page.waitForTimeout(200);
  const empty = await page.evaluate(() => {
    const box = document.getElementById('arcade-empty');
    const r = box.getBoundingClientRect();
    const daily = document.getElementById('daily-banner');
    return {
      shown: !box.hidden && r.height > 0,
      copy: /No games match/.test(box.textContent),
      count: document.getElementById('card-search-count').textContent,
      dailyHidden: getComputedStyle(daily).display === 'none',
    };
  });
  ok(empty.shown && empty.copy && empty.count === '0 games',
    'a miss shows an empty state instead of a blank catalogue');
  ok(empty.dailyHidden, 'a miss tucks the daily banner so the empty state is the page');

  await page.click('#arcade-empty-clear');
  await page.waitForTimeout(200);
  const cleared = await page.evaluate(() => ({
    q: document.getElementById('card-search').value,
    emptyHidden: document.getElementById('arcade-empty').hidden,
    longShown: !document.querySelector('[data-section="long"]').hidden,
    dailyShown: getComputedStyle(document.getElementById('daily-banner')).display !== 'none',
  }));
  ok(!cleared.q && cleared.emptyHidden && cleared.longShown && cleared.dailyShown,
    'Clear filter restores the catalogues and the daily banner');

  await page.fill('#card-search', 'snake');
  await page.waitForTimeout(200);
  await page.click('.hero-alt-link[data-jump="long"]');
  await page.waitForTimeout(1600);
  const hopFromFilter = await page.evaluate(() => {
    const long = document.querySelector('[data-section="long"]');
    const r = long.getBoundingClientRect();
    return {
      q: document.getElementById('card-search').value,
      longShown: !long.hidden,
      landed: r.top >= 0 && r.top < window.innerHeight * 0.55,
      here: long.classList.contains('is-landed'),
      scan: document.querySelector('.arcade-scan-link--long').getAttribute('aria-current') === 'true',
    };
  });
  ok(!hopFromFilter.q && hopFromFilter.longShown && hopFromFilter.landed,
    'the Long hop during a Quick filter clears search and lands Long');
  ok(hopFromFilter.here && hopFromFilter.scan,
    'the landed section and scan hop mark where you are');

  await page.fill('#card-search', 'hours');
  await page.waitForTimeout(200);
  await page.fill('#card-search', '');
  await page.waitForTimeout(200);
  const scanReset = await page.evaluate(() => ({
    landed: !!document.querySelector('.arcade-section.is-landed'),
    aria: !!document.querySelector('.arcade-scan-link[aria-current]'),
  }));
  ok(!scanReset.landed && !scanReset.aria,
    'clearing the filter drops the scan "you are here" mark');

  await page.click('.arcade-scan-link--quick');
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = '#snake'; });
  await page.waitForTimeout(600);
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(600);
  const trip = await page.evaluate(() => ({
    arcade: document.getElementById('view-arcade').classList.contains('active'),
    landed: !!document.querySelector('.arcade-section.is-landed'),
    aria: !!document.querySelector('.arcade-scan-link[aria-current]'),
  }));
  ok(trip.arcade && !trip.landed && !trip.aria,
    'coming back from a game drops the scan "you are here" mark');

  const flagCard = await page.evaluate(() => {
    const card = document.querySelector('.arcade-grid--long .arcade-card--flagship');
    const badge = card && card.querySelector('.arcade-card-flag');
    const tags = ((card && card.querySelector('.arcade-card-tags')) || {}).textContent || '';
    return !!(card && badge && /Flagship/.test(badge.textContent) && /Hours/.test(tags));
  });
  ok(flagCard, 'the Age of War catalogue card carries the billboard Flagship mark');

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

  await page.fill('#card-search', 'zzzz');
  await page.waitForTimeout(200);
  await page.click('#challenge-jump-btn');
  await page.waitForTimeout(400);
  const chalFromMiss = await page.evaluate(() => {
    const b = document.getElementById('daily-banner');
    const r = b.getBoundingClientRect();
    return {
      q: document.getElementById('card-search').value,
      dailyShown: getComputedStyle(b).display !== 'none',
      onScreen: r.top >= 0 && r.top < window.innerHeight,
      emptyHidden: document.getElementById('arcade-empty').hidden,
    };
  });
  ok(!chalFromMiss.q && chalFromMiss.dailyShown && chalFromMiss.onScreen && chalFromMiss.emptyHidden,
    'Challenge during a miss clears the filter and lands the banner');

  await page.fill('#card-search', 'zzzz');
  await page.waitForTimeout(200);
  await page.click('.daily-chip[data-game="snake"]');
  await page.waitForTimeout(800);
  const dailyChip = await page.evaluate(() => ({
    q: document.getElementById('card-search').value,
    snake: document.getElementById('view-snake').classList.contains('active'),
  }));
  ok(!dailyChip.q && dailyChip.snake,
    'a daily chip during a miss clears the filter before launching');
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(600);

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

  const studioWide = await tp.evaluate(() => {
    const card = document.querySelector('.arcade-grid--studio .arcade-card');
    const tags = card.querySelector('.arcade-card-tags');
    const w = card.getBoundingClientRect().width;
    return {
      width: w,
      tagsFit: tags.scrollWidth <= tags.clientWidth + 1,
    };
  });
  ok(studioWide.width >= 200 && studioWide.tagsFit,
    `900×700 Studio is one card wide, not a squeezed third (${Math.round(studioWide.width)}px)`);

  const chrome = await tp.evaluate(() => {
    const a = document.querySelector('.arcade-grid--long .arcade-card');
    const b = document.querySelector('.arcade-grid--quick .arcade-card');
    const as = getComputedStyle(a);
    const bs = getComputedStyle(b);
    const tagHeights = [...document.querySelectorAll('.arcade-card-tags')]
      .map(t => t.getBoundingClientRect().height);
    return {
      appear: bs.appearance === 'none',
      font: as.font === bs.font,
      tagsFlat: Math.max(...tagHeights) - Math.min(...tagHeights) <= 2,
    };
  });
  ok(chrome.appear && chrome.font,
    'Quick button cards inherit the same chrome as Long anchors');
  ok(chrome.tagsFlat,
    '900×700 tag pills stay one row after the 3-across squeeze');

  const narrow = await browser.newContext({ viewport: { width: 720, height: 700 } });
  const np = await narrow.newPage();
  const errs3 = [];
  np.on('pageerror', e => errs3.push(String(e).slice(0, 300)));
  await np.addInitScript(() => localStorage.setItem('eureka-primer-seen', '1'));
  await np.goto(BASE + '/index.html', { waitUntil: 'load' });
  await np.waitForTimeout(1800);
  const fold720 = await np.evaluate(() => {
    const flag = document.querySelector('.arcade-flagship');
    const first = document.querySelector('.arcade-grid--long .arcade-card');
    const studio = document.querySelector('.arcade-scan-link--studio');
    const cta = document.querySelector('.hero-cta--flagship');
    const fr = flag && flag.getBoundingClientRect();
    const cr = cta && cta.getBoundingClientRect();
    return {
      flagH: fr ? Math.round(fr.height) : 0,
      firstTop: first ? Math.round(first.getBoundingClientRect().top) : 0,
      onFold: first ? first.getBoundingClientRect().top < window.innerHeight : false,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      studioTint: studio ? getComputedStyle(studio).borderColor : '',
      ctaIn: !!(fr && cr && cr.bottom <= fr.bottom + 2 && cr.top >= fr.top - 2),
    };
  });
  ok(fold720.flagH > 0 && fold720.flagH <= 160 && fold720.ctaIn && !fold720.overflow,
    `720×700 keeps the compact flagship (${fold720.flagH}px), CTA inside, not a 16:9 stack`);
  ok(fold720.onFold,
    `720×700 first Long card stays on the fold (top ${fold720.firstTop})`);
  ok(/188,\s*140,\s*255|210,\s*180,\s*255|d2b4ff/i.test(fold720.studioTint),
    `Studio scan pill has the matching rail tint (${fold720.studioTint})`);

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await phone.newPage();
  const errs4 = [];
  pp.on('pageerror', e => errs4.push(String(e).slice(0, 300)));
  await pp.addInitScript(() => {
    localStorage.removeItem('eureka-primer-seen');
    localStorage.removeItem('eureka-stats');
  });
  await pp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await pp.waitForTimeout(1800);
  const fold390 = await pp.evaluate(() => {
    const first = document.querySelector('.arcade-grid--long .arcade-card');
    const hint = document.getElementById('primer-hint');
    const daily = document.getElementById('daily-banner');
    const fr = first.getBoundingClientRect();
    return {
      firstTop: Math.round(fr.top),
      onFold: fr.top < window.innerHeight - 40,
      hintOn: !hint.hidden && hint.getBoundingClientRect().height > 0,
      hintBelow: hint.getBoundingClientRect().top > fr.top,
      dailyBelow: daily.getBoundingClientRect().top > fr.top,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  ok(fold390.onFold && !fold390.overflow,
    `390 first-visit Long card starts on the fold (top ${fold390.firstTop})`);
  ok(fold390.hintOn && fold390.hintBelow && fold390.dailyBelow,
    '390 first-visit keeps primer and daily, but under the catalogue');

  await browser.close();
  ok(errs.length === 0 && errs2.length === 0 && errs3.length === 0 && errs4.length === 0,
    `no page errors${errs.length ? ' — ' + errs[0] : errs2.length ? ' — ' + errs2[0] : errs3.length ? ' — ' + errs3[0] : errs4.length ? ' — ' + errs4[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

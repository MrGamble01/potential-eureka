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
 *  Q. Leaving a game drops the scan mark; Games back restores the
 *     section you left (hash games and standalone Age of War).
 *  R. ~390 first-visit: Long games start on the fold (primer/daily
 *     no longer sit between scan and the catalogue).
 *  S. Secondary nav is site shell — still there on Hall of Fame.
 *  T. Daylight no longer paints midnight wash on the billboard / nav.
 *  U. 1280 Long games scan as two even rows of three.
 *  V. Search matches card descriptions (Studio "office").
 *  W. 1280 Studio stays one card wide (not a 1200px banner).
 *  X. 1280 Quick scans as five even rows of three.
 *  Y. HoF / resume / a stale hours filter still restore the
 *     catalogue you actually launched — not the hero.
 *  AA. Studio hop stays on the hero while the scan is tucked.
 *  AB. 390 scrolled: sticky shell sits under the wrapped nav.
 *  AC. HoF lists all six flagships (Hearthvale was missing) and
 *      groups Long / Quick the way the catalogue does.
 *  AD. A Hearthvale save fills the homepage badge and the HoF row;
 *      Reset my scores clears hearthvale-v1.
 *  AE. Daylight HoF chrome uses theme tokens, not midnight wash.
 *  AF. 390 HoF keeps the Hearthvale score on one card, not overflowing.
 *  AG. Opening HoF from a scrolled catalogue starts at the title,
 *      not mid-board with the leftover arcade offset.
 *  AH. HoF Quick ranks restart at 01 (the #994 split left 07–21).
 *  AI. Daylight Patch Notes / Primer sheets are light — not dark
 *      ink on a midnight modal after --text followed the theme.
 *  AJ. Daylight game-over overlay and catalogue PEAK chips follow
 *      the same tokens; Studio Crew chips are not a black wash.
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
  ok(hero.flagHref === 'ageofwar/' && hero.flagCta && hero.ctaCount === 1,
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
    dailyHidden: getComputedStyle(document.getElementById('daily-banner')).display === 'none',
  }));
  ok(filtered.count === '6 games' && !filtered.longHidden && filtered.quickHidden && filtered.scanHidden,
    'searching "hours" keeps Long, hides Quick, and tucks the scan bar');
  ok(filtered.dailyHidden, 'a hit filter tucks the daily banner so the matches come up');

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
  ok(!empty.dailyHidden, 'a miss keeps today\'s chips as a way out');

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
  const away = await page.evaluate(() => ({
    snake: document.getElementById('view-snake').classList.contains('active'),
    landed: !!document.querySelector('.arcade-section.is-landed'),
    aria: !!document.querySelector('.arcade-scan-link[aria-current]'),
  }));
  ok(away.snake && !away.landed && !away.aria,
    'leaving arcade drops the scan "you are here" mark');
  await page.click('#view-snake .game-back-btn');
  await page.waitForTimeout(800);
  const trip = await page.evaluate(() => {
    const q = document.querySelector('[data-section="quick"]');
    const r = q.getBoundingClientRect();
    return {
      arcade: document.getElementById('view-arcade').classList.contains('active'),
      onScreen: r.top >= 0 && r.top < window.innerHeight * 0.55,
      here: q.classList.contains('is-landed'),
      scan: document.querySelector('.arcade-scan-link--quick').getAttribute('aria-current') === 'true',
    };
  });
  ok(trip.arcade && trip.onScreen && trip.here && trip.scan,
    'Games back restores the Quick scan you left from');

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

  await page.fill('#card-search', 'office');
  await page.waitForTimeout(200);
  const descHit = await page.evaluate(() => ({
    count: document.getElementById('card-search-count').textContent,
    studio: !document.querySelector('[data-section="studio"]').hidden,
    empty: document.getElementById('arcade-empty').hidden,
    title: ((document.querySelector('.arcade-grid--studio .arcade-card-title') || {}).textContent || ''),
  }));
  ok(descHit.studio && descHit.empty && /studio/i.test(descHit.title) && descHit.count === '1 game',
    'search "office" matches the Studio card description');
  await page.fill('#card-search', '');
  await page.waitForTimeout(200);

  const playLined = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.arcade-grid--long .arcade-card')];
    const rowTop = Math.round(cards[0].getBoundingClientRect().top);
    const bottoms = cards
      .filter(c => Math.round(c.getBoundingClientRect().top) === rowTop)
      .map(c => Math.round(c.querySelector('.arcade-card-play').getBoundingClientRect().bottom));
    return bottoms.length >= 2 && Math.max(...bottoms) - Math.min(...bottoms) <= 2;
  });
  ok(playLined, 'PLAY sits on one baseline across a Long-game row');

  const desktopLong = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.arcade-grid--long .arcade-card')];
    const tops = [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)))];
    const first = cards.filter(c => Math.round(c.getBoundingClientRect().top) === tops[0]);
    const last = cards.filter(c => Math.round(c.getBoundingClientRect().top) === tops[tops.length - 1]);
    return {
      cols: first.length,
      rows: tops.length,
      last: last.length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  ok(desktopLong.cols === 3 && desktopLong.rows === 2 && desktopLong.last === 3 && !desktopLong.overflow,
    `1280 Long games scan as two even rows of three (${desktopLong.cols}+${desktopLong.last})`);

  const desktopStudio = await page.evaluate(() => {
    const card = document.querySelector('.arcade-grid--studio .arcade-card');
    const r = card.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  ok(desktopStudio.w >= 200 && desktopStudio.w <= 420,
    `1280 Studio is one card wide, not a stretched banner (${desktopStudio.w}px)`);

  const desktopQuick = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.arcade-grid--quick .arcade-card')];
    const tops = [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)))];
    const widths = tops.map(t => cards.filter(c => Math.round(c.getBoundingClientRect().top) === t).length);
    return {
      rows: tops.length,
      cols: widths[0],
      last: widths[widths.length - 1],
      even: widths.every(n => n === 3),
    };
  });
  ok(desktopQuick.cols === 3 && desktopQuick.rows === 5 && desktopQuick.even,
    `1280 Quick games scan as five even rows of three (${desktopQuick.cols}×${desktopQuick.rows})`);

  await page.click('.arcade-secondary-nav [data-view="halloffame"]');
  await page.waitForTimeout(400);
  const shellOnHof = await page.evaluate(() => {
    const primer = document.getElementById('primer-btn');
    const chal = document.getElementById('challenge-jump-btn');
    const patch = document.getElementById('patch-notes-btn');
    const vis = el => !!(el && el.getClientRects().length);
    return {
      hof: document.getElementById('view-halloffame').classList.contains('active'),
      primer: vis(primer),
      chal: vis(chal),
      patch: vis(patch),
    };
  });
  ok(shellOnHof.hof && shellOnHof.primer && shellOnHof.chal && shellOnHof.patch,
    'Hall of Fame still has How it works, Challenge and Patch Notes in the shell');
  await page.click('#view-halloffame .game-back-btn');
  await page.waitForTimeout(600);

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

  await pp.evaluate(() => window.scrollTo(0, 400));
  await pp.waitForTimeout(200);
  const phoneShell = await pp.evaluate(() => {
    const nav = document.querySelector('nav').getBoundingClientRect();
    const shell = document.querySelector('.arcade-shell').getBoundingClientRect();
    return {
      navBottom: Math.round(nav.bottom),
      shellTop: Math.round(shell.top),
      overlap: Math.round(nav.bottom - shell.top),
    };
  });
  ok(phoneShell.overlap <= 1,
    `390 scrolled: shell sits under the wrapped nav (overlap ${phoneShell.overlap}px)`);

  const day = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  const dp = await day.newPage();
  const errs5 = [];
  dp.on('pageerror', e => errs5.push(String(e).slice(0, 300)));
  await dp.addInitScript(() => {
    localStorage.setItem('eureka-theme', 'daylight');
    localStorage.setItem('eureka-primer-seen', '1');
  });
  await dp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await dp.waitForTimeout(1800);
  const light = await dp.evaluate(() => {
    const nav = getComputedStyle(document.querySelector('nav')).backgroundColor;
    const flag = getComputedStyle(document.querySelector('.arcade-flagship')).backgroundImage;
    const utils = getComputedStyle(document.querySelector('.nav-utils')).backgroundColor;
    const hof = getComputedStyle(document.querySelector('.hof-wrap')).backgroundColor;
    return {
      theme: document.documentElement.dataset.theme,
      nav,
      flag,
      utils,
      hof,
      themeColor: document.querySelector('meta[name="theme-color"]').content,
      midnightNav: /rgba\(6,\s*6,\s*8/.test(nav),
      midnightWash: /rgba\(6,\s*6,\s*8,\s*0\.55/.test(flag),
    };
  });
  ok(light.theme === 'daylight' && !light.midnightNav && !light.midnightWash,
    `daylight nav/billboard drop the midnight wash (nav ${light.nav})`);
  ok(/^#eef1f6$/i.test(light.themeColor),
    `theme-color follows daylight (${light.themeColor})`);
  await day.close();

  const aow = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const ap = await aow.newPage();
  const errs6 = [];
  ap.on('pageerror', e => errs6.push(String(e).slice(0, 300)));
  await ap.addInitScript(() => {
    localStorage.setItem('eureka-primer-seen', '1');
    localStorage.setItem('aow-welcome-seen', '1');
  });
  await ap.goto(BASE + '/index.html', { waitUntil: 'load' });
  await ap.waitForTimeout(1800);
  await ap.fill('#card-search', 'hours');
  await ap.waitForTimeout(200);
  await Promise.all([
    ap.waitForURL(/ageofwar/, { timeout: 20000 }),
    ap.click('.arcade-grid--long .arcade-card--flagship'),
  ]);
  await ap.waitForSelector('a.ea-back', { timeout: 20000 });
  await Promise.all([
    ap.waitForURL(url => {
      const u = String(url);
      return /\/$|index\.html/.test(u) && !/ageofwar/.test(u);
    }, { timeout: 20000 }),
    ap.click('a.ea-back'),
  ]);
  await ap.waitForTimeout(1600);
  const fromAow = await ap.evaluate(() => {
    const long = document.querySelector('[data-section="long"]');
    const r = long && long.getBoundingClientRect();
    return {
      q: (document.getElementById('card-search') || {}).value || '',
      count: (document.getElementById('card-search-count') || {}).textContent || '',
      onScreen: !!(r && r.top >= 0 && r.top < window.innerHeight * 0.7),
      here: !!(long && long.classList.contains('is-landed')),
    };
  });
  ok(fromAow.q === 'hours' && fromAow.count === '6 games' && fromAow.onScreen && fromAow.here,
    'Age of War GAMES back restores the hours filter and Long scan');
  await aow.close();

  const hof = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const hp = await hof.newPage();
  const errs7 = [];
  hp.on('pageerror', e => errs7.push(String(e).slice(0, 300)));
  await hp.addInitScript(() => localStorage.setItem('eureka-primer-seen', '1'));
  await hp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await hp.waitForTimeout(1800);
  await hp.fill('#card-search', 'hours');
  await hp.waitForTimeout(200);
  await hp.click('.arcade-secondary-nav [data-view="halloffame"]');
  await hp.waitForTimeout(400);
  await hp.locator('.hof-row', { hasText: 'Snake' }).click();
  await hp.waitForTimeout(700);
  await hp.click('#view-snake .game-back-btn');
  await hp.waitForTimeout(900);
  const fromHof = await hp.evaluate(() => {
    const q = document.querySelector('[data-section="quick"]');
    const r = q.getBoundingClientRect();
    return {
      q: document.getElementById('card-search').value,
      onScreen: r.top >= 0 && r.top < window.innerHeight * 0.55,
      here: q.classList.contains('is-landed'),
      scan: document.querySelector('.arcade-scan-link--quick').getAttribute('aria-current') === 'true',
    };
  });
  ok(!fromHof.q && fromHof.onScreen && fromHof.here && fromHof.scan,
    'HoF Snake → Games restores Quick, not a stale hours filter');
  await hof.close();

  const resu = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const rp = await resu.newPage();
  const errs8 = [];
  rp.on('pageerror', e => errs8.push(String(e).slice(0, 300)));
  await rp.addInitScript(() => {
    localStorage.setItem('eureka-primer-seen', '1');
    localStorage.setItem('eureka-stats', JSON.stringify({
      firstSeen: Date.now(), launches: { snake: 2 }, seconds: { snake: 90 }, days: {}, lastPlayed: 'snake',
    }));
  });
  await rp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await rp.waitForTimeout(1800);
  await rp.click('.resume-chip');
  await rp.waitForTimeout(700);
  await rp.click('#view-snake .game-back-btn');
  await rp.waitForTimeout(900);
  const fromResume = await rp.evaluate(() => {
    const q = document.querySelector('[data-section="quick"]');
    const r = q.getBoundingClientRect();
    return {
      onScreen: r.top >= 0 && r.top < window.innerHeight * 0.55,
      here: q.classList.contains('is-landed'),
    };
  });
  ok(fromResume.onScreen && fromResume.here,
    'Jump back in → Games restores the Quick scan');
  await resu.close();

  await page.fill('#card-search', 'snake');
  await page.waitForTimeout(200);
  await page.click('.hero-alt-link[data-jump="studio"]');
  await page.waitForTimeout(1600);
  const studioHop = await page.evaluate(() => {
    const s = document.querySelector('[data-section="studio"]');
    const r = s.getBoundingClientRect();
    return {
      q: document.getElementById('card-search').value,
      shown: !s.hidden,
      onScreen: r.top >= 0 && r.top < window.innerHeight * 0.55,
      here: s.classList.contains('is-landed'),
    };
  });
  ok(!studioHop.q && studioHop.shown && studioHop.onScreen && studioHop.here,
    'the Studio hop during a filter clears search and lands Studio');

  const board = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const bp = await board.newPage();
  const errs9 = [];
  bp.on('pageerror', e => errs9.push(String(e).slice(0, 300)));
  bp.on('dialog', d => d.accept());
  await bp.addInitScript(() => {
    localStorage.setItem('eureka-primer-seen', '1');
    localStorage.setItem('hearthvale-v1', JSON.stringify({ peakPop: 17, day: 12, seenIntro: true }));
  });
  await bp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await bp.waitForTimeout(1800);
  const valeBadge = await bp.evaluate(() => {
    const el = document.querySelector('.arcade-card-hi[data-hi="hearthvale"]');
    const r = el && el.getBoundingClientRect();
    return {
      text: (el && el.textContent) || '',
      shown: !!(el && r && r.height > 0 && getComputedStyle(el).display !== 'none'),
    };
  });
  ok(valeBadge.shown && /PEAK\s*17/.test(valeBadge.text),
    `Hearthvale catalogue badge fills from the save (${valeBadge.text})`);

  await bp.click('.arcade-secondary-nav [data-view="halloffame"]');
  await bp.waitForTimeout(500);
  const hofBoard = await bp.evaluate(() => {
    const rows = [...document.querySelectorAll('.hof-row')];
    const names = rows.map(r => (r.querySelector('.hof-name') || {}).textContent || '');
    const vale = rows.find(r => /Hearthvale/.test(r.textContent));
    const long = document.querySelector('.hof-lane--long');
    const quick = document.querySelector('.hof-lane--quick');
    return {
      rows: rows.length,
      names,
      vale: vale ? (vale.querySelector('.hof-score') || {}).textContent : '',
      longTitle: !!(long && /Long games/.test(long.textContent) && /6/.test((long.querySelector('.hof-lane-count') || {}).textContent || '')),
      quickTitle: !!(quick && /Quick games/.test(quick.textContent) && /15/.test((quick.querySelector('.hof-lane-count') || {}).textContent || '')),
      longRows: long ? long.querySelectorAll('.hof-row').length : 0,
      quickRows: quick ? quick.querySelectorAll('.hof-row').length : 0,
      longRanks: long ? [...long.querySelectorAll('.hof-rank')].map(el => el.textContent.trim()) : [],
      quickRanks: quick ? [...quick.querySelectorAll('.hof-rank')].map(el => el.textContent.trim()) : [],
      quickFirst: quick && ((quick.querySelector('.hof-row .hof-name') || {}).textContent || ''),
    };
  });
  ok(hofBoard.rows === 21 && hofBoard.longRows === 6 && hofBoard.quickRows === 15 && hofBoard.longTitle && hofBoard.quickTitle,
    `HoF board is 6 Long + 15 Quick (${hofBoard.longRows}+${hofBoard.quickRows})`);
  ok(hofBoard.names.includes('Hearthvale') && /17 villagers at peak/.test(hofBoard.vale),
    `HoF lists Hearthvale with the seeded peak (${hofBoard.vale})`);
  ok(hofBoard.longRanks.join() === '01,02,03,04,05,06'
    && hofBoard.quickRanks[0] === '01' && hofBoard.quickRanks[14] === '15'
    && /Snake/.test(hofBoard.quickFirst),
    `HoF ranks restart per lane (Quick ${hofBoard.quickRanks[0]}–${hofBoard.quickRanks[14]}, first ${hofBoard.quickFirst})`);

  await Promise.all([
    bp.waitForURL(/hearthvale/, { timeout: 20000 }),
    bp.locator('.hof-row', { hasText: 'Hearthvale' }).click(),
  ]);
  await bp.waitForSelector('a.ea-back', { timeout: 20000 });
  await Promise.all([
    bp.waitForURL(url => {
      const u = String(url);
      return /\/$|index\.html/.test(u) && !/hearthvale/.test(u);
    }, { timeout: 20000 }),
    bp.click('a.ea-back'),
  ]);
  await bp.waitForTimeout(1600);
  const fromVale = await bp.evaluate(() => {
    const long = document.querySelector('[data-section="long"]');
    const r = long && long.getBoundingClientRect();
    return {
      onScreen: !!(r && r.top >= 0 && r.top < window.innerHeight * 0.7),
      here: !!(long && long.classList.contains('is-landed')),
      scan: document.querySelector('.arcade-scan-link--long').getAttribute('aria-current') === 'true',
    };
  });
  ok(fromVale.onScreen && fromVale.here && fromVale.scan,
    'HoF Hearthvale → Games restores the Long scan');

  await bp.click('.arcade-secondary-nav [data-view="halloffame"]');
  await bp.waitForTimeout(400);
  await bp.click('#hof-reset');
  await bp.waitForTimeout(400);
  const afterReset = await bp.evaluate(() => {
    const vale = [...document.querySelectorAll('.hof-row')].find(r => /Hearthvale/.test(r.textContent));
    return {
      save: localStorage.getItem('hearthvale-v1'),
      score: ((vale && vale.querySelector('.hof-score')) || {}).textContent || '',
    };
  });
  ok(!afterReset.save && /not played/.test(afterReset.score),
    `Reset my scores clears hearthvale-v1 (${afterReset.score})`);
  await board.close();

  const dayHof = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  const dhp = await dayHof.newPage();
  const errs10 = [];
  dhp.on('pageerror', e => errs10.push(String(e).slice(0, 300)));
  await dhp.addInitScript(() => {
    localStorage.setItem('eureka-theme', 'daylight');
    localStorage.setItem('eureka-primer-seen', '1');
    localStorage.setItem('hearthvale-v1', JSON.stringify({ peakPop: 17 }));
  });
  await dhp.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
  await dhp.waitForTimeout(1800);
  const lightHof = await dhp.evaluate(() => {
    const input = getComputedStyle(document.querySelector('.hof-rival-input'));
    const out = getComputedStyle(document.getElementById('hof-share-out'));
    const wrap = getComputedStyle(document.querySelector('.hof-wrap'));
    const rgb = s => {
      const m = (s || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    };
    const lum = c => c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 0;
    return {
      theme: document.documentElement.dataset.theme,
      inputBg: input.backgroundColor,
      inputFg: input.color,
      wrapBg: wrap.backgroundColor,
      outColor: out.color,
      textDark: lum(rgb(input.color)) < 0.45,
      wrapLight: lum(rgb(wrap.backgroundColor)) > 0.7,
      inkTint: /15,\s*23,\s*42/.test(input.backgroundColor),
      midnightWash: /rgba\(255,\s*255,\s*255,\s*0\.0/.test(input.backgroundColor),
    };
  });
  ok(lightHof.theme === 'daylight' && lightHof.wrapLight && lightHof.textDark && lightHof.inkTint && !lightHof.midnightWash,
    `daylight HoF input/panel use light tokens (bg ${lightHof.inputBg}, fg ${lightHof.inputFg})`);

  await dhp.click('#patch-notes-btn');
  await dhp.waitForTimeout(300);
  const lightPatch = await dhp.evaluate(() => {
    const overlay = getComputedStyle(document.getElementById('patch-modal'));
    const sheet = getComputedStyle(document.querySelector('#patch-modal .modal-content'));
    const rgb = s => {
      const m = (s || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    };
    const lum = c => c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 0;
    return {
      overlayBg: overlay.backgroundColor,
      sheetBg: sheet.backgroundColor,
      sheetFg: sheet.color,
      sheetLight: lum(rgb(sheet.backgroundColor)) > 0.7,
      textDark: lum(rgb(sheet.color)) < 0.45,
      midnightSheet: /rgba\(10,\s*10,\s*15/.test(sheet.backgroundColor),
      midnightScrim: /rgba\(2,\s*2,\s*3/.test(overlay.backgroundColor),
    };
  });
  ok(lightPatch.sheetLight && lightPatch.textDark && !lightPatch.midnightSheet && !lightPatch.midnightScrim,
    `daylight Patch Notes is ink on a light sheet (bg ${lightPatch.sheetBg})`);
  await dhp.keyboard.press('Escape');
  await dhp.waitForTimeout(200);
  await dhp.click('#primer-btn');
  await dhp.waitForTimeout(300);
  const lightPrimer = await dhp.evaluate(() => {
    const sheet = getComputedStyle(document.querySelector('#primer-modal .modal-content'));
    return {
      sheetBg: sheet.backgroundColor,
      midnightSheet: /rgba\(10,\s*10,\s*15/.test(sheet.backgroundColor),
    };
  });
  ok(!lightPrimer.midnightSheet,
    `daylight How it works drops the midnight sheet (${lightPrimer.sheetBg})`);
  await dhp.keyboard.press('Escape');
  await dhp.waitForTimeout(200);
  await dhp.click('button.logo');
  await dhp.waitForTimeout(500);
  const lightHi = await dhp.evaluate(() => {
    const hi = document.querySelector('.arcade-card-hi[data-hi="hearthvale"]');
    return {
      bg: hi ? getComputedStyle(hi).backgroundColor : '',
      shown: !!(hi && getComputedStyle(hi).display !== 'none'),
      midnight: hi ? /rgba\(2,\s*2,\s*3/.test(getComputedStyle(hi).backgroundColor) : true,
    };
  });
  ok(lightHi.shown && !lightHi.midnight,
    `daylight PEAK chip is not a midnight pill (${lightHi.bg})`);
  await dhp.click('[data-view="snake"]');
  await dhp.waitForTimeout(600);
  const lightOver = await dhp.evaluate(() => {
    const ov = document.getElementById('snake-overlay');
    ov.style.display = 'flex';
    const bg = getComputedStyle(ov).backgroundColor;
    return { bg, midnight: /rgba\(2,\s*2,\s*3/.test(bg) };
  });
  ok(!lightOver.midnight,
    `daylight game-over overlay follows theme tokens (${lightOver.bg})`);
  await dhp.click('#nav-utils-toggle');
  await dhp.click('[data-view="orgchart"]');
  await dhp.waitForTimeout(500);
  const lightCrew = await dhp.evaluate(() => {
    const legend = getComputedStyle(document.querySelector('.orgchart-legend'));
    return {
      bg: legend.backgroundColor,
      midnight: /rgba\(6,\s*6,\s*8/.test(legend.backgroundColor),
    };
  });
  ok(!lightCrew.midnight,
    `daylight Studio Crew chips drop the midnight wash (${lightCrew.bg})`);
  await dayHof.close();

  const phoneHof = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const php = await phoneHof.newPage();
  const errs11 = [];
  php.on('pageerror', e => errs11.push(String(e).slice(0, 300)));
  await php.addInitScript(() => {
    localStorage.setItem('eureka-primer-seen', '1');
    localStorage.setItem('hearthvale-v1', JSON.stringify({ peakPop: 17 }));
  });
  await php.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
  await php.waitForTimeout(1800);
  const phoneBoard = await php.evaluate(() => {
    const vale = [...document.querySelectorAll('.hof-row')].find(r => /Hearthvale/.test(r.textContent));
    const score = vale && vale.querySelector('.hof-score');
    const name = vale && vale.querySelector('.hof-name');
    const vr = vale && vale.getBoundingClientRect();
    const sr = score && score.getBoundingClientRect();
    const nr = name && name.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      scoreIn: !!(sr && vr && sr.right <= vr.right + 2 && sr.left >= vr.left - 2),
      nameIn: !!(nr && vr && nr.right <= vr.right + 2 && nr.left >= vr.left - 2),
      score: score ? score.textContent : '',
    };
  });
  ok(!phoneBoard.overflow && phoneBoard.scoreIn && phoneBoard.nameIn && /17 villagers/.test(phoneBoard.score),
    `390 HoF keeps the Hearthvale score on the card (overflow ${phoneBoard.overflow})`);
  await phoneHof.close();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  await page.click('.arcade-secondary-nav [data-view="halloffame"]');
  await page.waitForTimeout(400);
  const hofTop = await page.evaluate(() => {
    const title = document.querySelector('.hof-title');
    const long = document.querySelector('.hof-lane--long');
    const r = title && title.getBoundingClientRect();
    return {
      titleOn: !!(r && r.top >= 0 && r.bottom < window.innerHeight),
      longOn: !!(long && long.getBoundingClientRect().top < window.innerHeight),
      y: Math.round(window.scrollY),
    };
  });
  ok(hofTop.titleOn && hofTop.longOn && hofTop.y < 40,
    `HoF from a scrolled catalogue starts at the title (scrollY ${hofTop.y})`);

  await browser.close();
  ok(errs.length === 0 && errs2.length === 0 && errs3.length === 0 && errs4.length === 0 && errs5.length === 0 && errs6.length === 0 && errs7.length === 0 && errs8.length === 0 && errs9.length === 0 && errs10.length === 0 && errs11.length === 0,
    `no page errors${errs.length ? ' — ' + errs[0] : errs2.length ? ' — ' + errs2[0] : errs3.length ? ' — ' + errs3[0] : errs4.length ? ' — ' + errs4[0] : errs5.length ? ' — ' + errs5[0] : errs6.length ? ' — ' + errs6[0] : errs7.length ? ' — ' + errs7[0] : errs8.length ? ' — ' + errs8[0] : errs9.length ? ' — ' + errs9[0] : errs10.length ? ' — ' + errs10[0] : errs11.length ? ' — ' + errs11[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

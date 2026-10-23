/* Hub launch links.
   Catalogue cards, today's chips, and Hall of Fame rows are real links.
   Nickname hashes (#game2048, #minefield, #hof, #grow-op, #tycoon) open
   the game they name, and the 404 page lists working doors back in.
   Hook-free. Drives the production hub. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '../..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function fileExists(href) {
  const rel = href.split('?')[0].replace(/^\//, '');
  const direct = path.join(ROOT, rel);
  if (fs.existsSync(direct)) return true;
  if (rel.endsWith('/')) return fs.existsSync(path.join(ROOT, rel, 'index.html'));
  return fs.existsSync(direct + '.html') || fs.existsSync(path.join(direct, 'index.html'));
}

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
  await page.waitForTimeout(1200);

  const cards = await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll('.arcade-grid .arcade-card, a.arcade-flagship'),
    ];
    return nodes.map(el => ({
      tag: el.tagName,
      href: el.getAttribute('href') || '',
      title: ((el.querySelector('.arcade-card-title, .arcade-flagship-name') || {}).textContent || '').trim(),
      view: document.getElementById('view-' + (el.getAttribute('href') || '').replace(/^#/, '')) ? true : false,
    }));
  });
  ok(cards.length === 27, `catalogue exposes 27 launch links, hero and workshop included (${cards.length})`);
  ok(cards.every(c => c.tag === 'A' && c.href), 'every catalogue card is an anchor with an href');
  const hashCards = cards.filter(c => c.href.startsWith('#'));
  const pageCards = cards.filter(c => !c.href.startsWith('#'));
  ok(hashCards.length === 17 && hashCards.every(c => c.view),
    `quick-game links point at a real view (${hashCards.filter(c => !c.view).map(c => c.href).join(',') || 'all 17'})`);
  ok(pageCards.every(c => fileExists(c.href)),
    `standalone links point at a file (${pageCards.map(c => c.href).join(', ')})`);
  ok(pageCards.some(c => c.href === 'tycoon/play.html' && /STARTUP TYCOON/.test(c.title)),
    'Startup Tycoon PLAY opens the game, not the splash');
  ok(pageCards.some(c => c.href === 'ageofwar/' && /AGE OF WAR/.test(c.title)),
    'Age of War still links into ageofwar/');
  ok(pageCards.some(c => c.href === 'games/ashmarch/'), 'Ashmarch stays a catalogue launch link');
  ok(pageCards.some(c => c.href === 'games/ledger/'), 'The Ledger stays a catalogue launch link');

  const daily = await page.evaluate(() =>
    [...document.querySelectorAll('.daily-chip')].map(el => ({
      tag: el.tagName,
      href: el.getAttribute('href'),
      name: el.childNodes[0] ? el.childNodes[0].textContent.trim() : el.textContent.trim(),
    })));
  ok(daily.length === 7 && daily.every(d => d.tag === 'A' && d.href && d.href.startsWith('#')),
    'today\'s seven chips are links into a hub view');
  const byName = Object.fromEntries(daily.map(d => [d.name, d.href]));
  ok(byName['Vector Storm'] === '#asteroids' && byName['Maze Runner'] === '#maze' && byName['Word Cascade'] === '#wordcascade',
    `daily chips use the catalogue titles (${daily.map(d => d.name).join(', ')})`);

  await page.click('.arcade-grid--quick a.arcade-card[href="#snake"]');
  await page.waitForTimeout(400);
  const snake = await page.evaluate(() => ({
    on: document.getElementById('view-snake').classList.contains('active'),
    title: document.title,
    hash: location.hash,
  }));
  ok(snake.on && snake.hash === '#snake' && /Snake — Eureka Games/.test(snake.title),
    `Snake link opens Snake and names the tab (${snake.title})`);

  await page.goto(BASE + '/index.html#game2048', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('view-2048').classList.contains('active'));
  const g2048 = await page.evaluate(() => ({ hash: location.hash, title: document.title }));
  ok(g2048.hash === '#2048' && /2048 — Eureka Games/.test(g2048.title),
    `#game2048 opens 2048 (${g2048.hash}, ${g2048.title})`);

  await page.goto(BASE + '/index.html#minefield', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('view-minesweeper').classList.contains('active'));
  ok(/Minefield — Eureka Games/.test(await page.title()), '#minefield opens Minefield');

  await page.goto(BASE + '/index.html#hof', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('view-halloffame').classList.contains('active'));
  const hof = await page.evaluate(() => ({
    title: document.title,
    snake: (document.querySelector('.hof-row[href="#snake"] .hof-name') || {}).textContent || '',
    tycoon: (document.querySelector('.hof-row[href="tycoon/play.html"] .hof-name') || {}).textContent || '',
  }));
  ok(/Hall of Fame — Eureka Games/.test(hof.title) && hof.snake === 'Snake' && hof.tycoon === 'Startup Tycoon',
    `#hof opens the Hall of Fame with working row links (${hof.snake}, ${hof.tycoon})`);

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await page.goto(BASE + '/index.html#grow-op', { waitUntil: 'load' });
  await page.waitForURL(/drug-lab\.html/, { timeout: 15000 });
  ok(/Grow Op/.test(await page.title()), `#grow-op lands in Grow Op (${page.url()})`);

  const ty = await ctx.newPage();
  await ty.goto(BASE + '/index.html#tycoon', { waitUntil: 'load' });
  await ty.waitForURL(/tycoon\/play\.html/, { timeout: 15000 });
  ok(/Startup Tycoon/.test(await ty.title()), `#tycoon lands in Startup Tycoon (${ty.url()})`);
  await ty.close();

  const missing = await ctx.newPage();
  await missing.goto(BASE + '/404.html', { waitUntil: 'load' });
  const doors = await missing.evaluate(() => ({
    links: [...document.querySelectorAll('.notfound-games a')].map(a => a.getAttribute('href')),
    grow: HubRoutes.pageFor('grow-op'),
    snake: HubRoutes.viewFor('snake'),
    nick: HubRoutes.viewFor('game2048'),
    stay: location.pathname.endsWith('404.html'),
  }));
  ok(doors.stay && doors.grow === 'drug-lab.html' && doors.snake && doors.snake.name === 'snake' && doors.nick && doors.nick.name === '2048',
    '404 keeps its own URL and the route map resolves nicknames');
  const expected = ['/ageofwar/', '/tycoon/play.html', '/drug-lab.html', '/homeless-village.html', '/hearthvale.html', '/voxel-garden.html', '/#snake', '/#tetris', '/#2048', '/#minesweeper'];
  ok(expected.every(h => doors.links.includes(h)) && expected.filter(h => !h.includes('#')).every(fileExists),
    '404 lists a working door for each flagship and four quick games');
  await missing.close();

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

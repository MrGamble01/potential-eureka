/* IDEA-SITE-8 — local insights (+ Depth 30 Flagship Saga).
   Playing games records launches + seconds; the HOF renders the panel;
   utility views don't count; the panel hides on a fresh profile.
   Depth 30: seeded flagship saves render one saga card each with
   lifetime stat chips; saga renders alone when there's no telemetry;
   the empty state (no telemetry AND no saves) stays ''. */
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // Fresh: panel empty
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.getElementById('hof-insights').innerHTML === ''),
     'fresh profile shows no panel');

  // Play snake for ~3s, then tetris twice briefly
  await page.evaluate(() => { location.hash = '#snake'; });
  await page.waitForTimeout(3200);
  await page.evaluate(() => { location.hash = '#tetris'; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = '#tetris'; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { location.hash = '#productivity'; }); // not a game
  await page.waitForTimeout(600);

  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('eureka-stats')));
  ok(stats.launches.snake === 1 && stats.launches.tetris === 2, `launches counted (snake 1, tetris ${stats.launches.tetris})`);
  ok(stats.seconds.snake >= 2 && stats.seconds.snake <= 6, `snake seconds accrued (${stats.seconds.snake}s)`);
  ok(!stats.launches.productivity, 'utility views are not plays');
  const today = await page.evaluate(() => Utils.todayKey());
  ok(stats.days[today] >= 3, `daily total accrues (${stats.days[today]}s today)`);

  // Panel renders
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(700);
  const panel = await page.evaluate(() => document.getElementById('hof-insights').textContent);
  ok(/YOUR ARCADE/.test(panel) && /3 plays/.test(panel), `panel renders totals (${panel.slice(0, 60)})`);
  ok(/favourite Snake/.test(panel), 'favourite is the most-played game');
  ok(/Never sent anywhere/.test(panel), 'privacy note present');
  const bars = await page.evaluate(() => document.querySelectorAll('.ins-row').length);
  ok(bars === 2, `per-game bars render (${bars})`);

  // Depth 30 — seed all six flagship saves, re-render, and check the
  // saga strip reads the exact lifetime stats out of each one.
  await page.evaluate(() => {
    localStorage.setItem('aow-best-run', JSON.stringify({ waves: 18, kills: 230, time: 900, strongholds: 2, difficulty: 'normal' }));
    localStorage.setItem('aow-relics', '7');
    localStorage.setItem('startup-tycoon-v7', JSON.stringify({ lifetimeCash: 1250000, launches: { n: 4, polish: null }, poach: { fought: 2, lost: 0 }, retreats: { held: 2, active: null }, prestigeLevel: 1 }));
    localStorage.setItem('drug-lab-v1', JSON.stringify({ totalEarned: 5600, contractsDone: 3, rivalRunIns: 2, ownedRooms: ['garage', 'growroom', 'front'] }));
    localStorage.setItem('homeless_village_v1', JSON.stringify({ days: 12, soupNights: 5, rep: 40, mural: 4 }));
    localStorage.setItem('hearthvale-v1', JSON.stringify({ day: 30, peakPop: 14, chronicle: [{}, {}, {}], raidsRepelled: 2, caravansReturned: 4, bellSaves: 1 }));
    localStorage.setItem('voxel-garden-v1', JSON.stringify({ v: 1, state: { totalEarned: 2400, level: 6, flotsamOpened: 5, wishes: 1, catGifts: 7 } }));
    Telemetry.renderInto('hof-insights');
  });
  const saga = await page.evaluate(() => ({
    text: document.getElementById('hof-insights').textContent,
    cards: document.querySelectorAll('.saga-card').length,
    rows: document.querySelectorAll('.ins-row').length,
  }));
  ok(/FLAGSHIP SAGA/.test(saga.text) && saga.cards === 6, `saga renders one card per flagship save (${saga.cards})`);
  ok(/18 waves/.test(saga.text) && /\$1\.3M/.test(saga.text) && /\$5\.6k/.test(saga.text),
     'chips carry the exact numbers from the saves (waves, tycoon $, lab $)');
  ok(/5 soup nights/.test(saga.text) && /3 chronicle pages/.test(saga.text) && /1 wish granted/.test(saga.text),
     'village, hearthvale and voxel chips render');
  // Depth 45 — the saga knows the round-4/5 counters too
  ok(/2 retreats held/.test(saga.text) && /3 rooms owned/.test(saga.text),
     'tycoon retreats and grow-op rooms render');
  ok(/mural finished/.test(saga.text) && /4 caravans home/.test(saga.text)
     && /1 bell saves?/.test(saga.text) && /7 cat gifts/.test(saga.text),
     'mural, caravans, bell saves and cat gifts render');
  ok(saga.rows === 2 && /YOUR ARCADE/.test(saga.text), 'the arcade bars are untouched by the saga block');

  // Saga-only: a fresh profile with one flagship save but zero telemetry
  // shows just the saga (the restructured empty-state must not hide it).
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await p2.addInitScript(() => {
    localStorage.setItem('hearthvale-v1', JSON.stringify({ day: 9, peakPop: 6, chronicle: [{}], raidsRepelled: 0 }));
  });
  await p2.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });
  await p2.waitForTimeout(1200);
  await p2.evaluate(() => { location.hash = '#halloffame'; });
  await p2.waitForTimeout(600);
  const solo = await p2.evaluate(() => ({
    text: document.getElementById('hof-insights').textContent,
    cards: document.querySelectorAll('.saga-card').length,
  }));
  ok(/FLAGSHIP SAGA/.test(solo.text) && !/YOUR ARCADE/.test(solo.text) && solo.cards === 1,
     `saga renders alone without telemetry (${solo.cards} card)`);
  await ctx2.close();

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

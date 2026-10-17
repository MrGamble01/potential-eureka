/*
 * Flagship daily — one seeded sprint.
 *  A. The hub card names one flagship, the goal, the clock, the best
 *     and the streak, and leaves the quick-arcade banner at 7 chips.
 *  B. The same date always deals the same game, goal and board.
 *  C. A finished run on that board records the best, the history and
 *     the streak. Banking a worse replay does not erase the best.
 *  D. Reduced motion still scores, without particles.
 *  E. A flagship that is not today's game points at the one that is.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  async function open(path) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    await page.goto(BASE + path, { waitUntil: 'load' });
    return { ctx, page };
  }

  // A. Hub card
  let todayGame = null;
  {
    const { ctx, page } = await open('/index.html');
    await page.waitForFunction(() => {
      const card = document.getElementById('flag-daily');
      return card && !card.hidden && document.getElementById('flag-daily-play');
    });
    const card = await page.evaluate(() => {
      const spec = FlagDaily.challengeFor(FlagDaily.todayKey(new Date()));
      const el = document.getElementById('flag-daily');
      return {
        game: el.dataset.game,
        seed: el.dataset.seed,
        name: document.getElementById('flag-daily-name').textContent,
        goal: document.getElementById('flag-daily-goal').textContent,
        time: document.getElementById('flag-daily-time').textContent,
        best: document.getElementById('flag-daily-best').textContent,
        streak: document.getElementById('flag-daily-streak').textContent,
        href: document.getElementById('flag-daily-play').getAttribute('href'),
        chips: document.querySelectorAll('.daily-chip').length,
        expectedId: spec.game.id,
        expectedSeed: String(spec.seed),
        expectedHref: spec.game.href,
        width: document.documentElement.scrollWidth,
      };
    });
    todayGame = card.game;
    ok(card.game === card.expectedId && card.name.length > 0, `hub card names today's flagship (${card.name})`);
    ok(card.seed === card.expectedSeed && /reach /.test(card.goal) && /^\d:/.test(card.time),
      'hub card shows the shared seed, the goal and the clock');
    ok(card.best === 'Best —' && /Streak 0/.test(card.streak), 'a fresh browser has no best and no streak');
    ok(card.href === card.expectedHref && card.href.indexOf('daily=1') >= 0, 'the play link opens that flagship seeded');
    ok(card.chips === 7, 'the quick-arcade daily still has its 7 chips');
    ok(card.width <= 391, 'the card does not widen a phone');
    await ctx.close();
  }

  // B. Determinism + streak math
  {
    const { ctx, page } = await open('/index.html');
    await page.waitForFunction(() => window.FlagDaily);
    const math = await page.evaluate(() => {
      const a = FlagDaily.challengeFor('2026-04-02');
      const b = FlagDaily.challengeFor('2026-04-02');
      const ids = new Set();
      for (let i = 0; i < 16; i++) ids.add(FlagDaily.challengeFor('2026-05-' + String(i + 1).padStart(2, '0')).game.id);
      localStorage.removeItem(FlagDaily.KEY);
      const miss = FlagDaily.record({ date: '2026-04-01', game: 'tycoon', score: 10, goal: 100 });
      const one = FlagDaily.record({ date: '2026-04-02', game: 'hearthvale', score: 500, goal: 100 });
      const two = FlagDaily.record({ date: '2026-04-03', game: 'growop', score: 80, goal: 100 });
      const again = FlagDaily.record({ date: '2026-04-02', game: 'hearthvale', score: 200, goal: 100 });
      return {
        same: JSON.stringify(a) === JSON.stringify(b),
        games: ids.size,
        miss: miss.streak,
        one: one.streak,
        two: two.streak,
        againBest: again.best,
        againStreak: again.streak,
        history: one.history.filter(row => row.played).length,
      };
    });
    ok(math.same, 'the same date deals the same game, goal, clock and board');
    ok(math.games >= 2, 'different dates rotate flagships');
    ok(math.miss === 0 && math.one === 1 && math.two === 0, 'a missed goal breaks the streak; a cleared goal builds it');
    ok(math.againBest === 500 && math.againStreak === 1 && math.history >= 1, 'a worse replay keeps the best and the history');
    await ctx.close();
  }

  // C + D. Play Hearthvale's board for a pinned date.
  {
    const { ctx, page } = await open('/index.html');
    await page.waitForFunction(() => window.FlagDaily);
    const date = await page.evaluate(() => {
      for (let i = 0; i < 40; i++) {
        const key = FlagDaily.todayKey(new Date(2026, 0, 1 + i));
        if (FlagDaily.challengeFor(key).game.id === 'hearthvale') return key;
      }
      return null;
    });
    ok(!!date, 'some date deals Hearthvale');
    await ctx.close();

    const play = await open('/hearthvale.html?daily=1&asof=' + date);
    await play.page.waitForSelector('#flag-daily-grid', { timeout: 8000 });
    const board = await play.page.evaluate(() => {
      const spec = FlagDaily.challengeFor(FlagDaily.activeDate());
      const faces = [...document.querySelectorAll('#flag-daily-grid .fd-face')].map(n => n.textContent);
      return {
        game: document.getElementById('flag-daily-layer').dataset.game,
        seed: document.getElementById('flag-daily-layer').dataset.seed,
        faces: faces.join(''),
        expected: spec.tiles.slice(0, 9).map(t => t.face).join(''),
        official: document.getElementById('flag-daily-layer').dataset.official,
      };
    });
    ok(board.official === '1' && board.game === 'hearthvale' && board.faces === board.expected,
      'Hearthvale opens on the seeded morning market');

    const tapped = await play.page.evaluate(() => {
      const btn = document.querySelector('#flag-daily-grid .fd-tile[data-trap="0"]');
      const value = Number(btn.dataset.value);
      btn.click();
      return {
        value,
        score: Number(document.getElementById('flag-daily-score-live').textContent),
        particles: window.EurekaFeel ? EurekaFeel.particleCount() : -1,
      };
    });
    ok(tapped.score === tapped.value && tapped.particles > 0, 'a clean tap scores its value and punches');

    await play.page.evaluate(() => EurekaFeel.setMotion('reduced'));
    await play.page.waitForTimeout(700);
    const quiet = await play.page.evaluate(() => {
      const before = EurekaFeel.particleCount();
      const btn = document.querySelector('#flag-daily-grid .fd-tile[data-trap="0"]');
      const value = Number(btn.dataset.value);
      const prev = Number(document.getElementById('flag-daily-score-live').textContent);
      btn.click();
      return {
        particles: EurekaFeel.particleCount() - before,
        gained: Number(document.getElementById('flag-daily-score-live').textContent) - prev,
        value,
      };
    });
    ok(quiet.particles === 0 && quiet.gained === quiet.value, 'reduced motion still scores, without a particle burst');

    await play.page.click('#flag-daily-bank');
    await play.page.waitForSelector('#flag-daily-results', { timeout: 4000 });
    const results = await play.page.evaluate((asof) => {
      const score = document.getElementById('flag-daily-score').textContent;
      const text = document.getElementById('flag-daily-results').textContent;
      const saved = FlagDaily.load().days[asof];
      return {
        score,
        showsBest: text.indexOf('best ' + score) >= 0 || text.indexOf("best " + score) >= 0,
        history: text.indexOf(asof) >= 0,
        savedBest: saved && saved.best,
        streak: document.getElementById('flag-daily-streak-result').textContent,
      };
    }, date);
    ok(results.history && results.savedBest === Number(results.score) && /Streak 0/.test(results.streak),
      'banking shows the score, files it in the history, and waits on the goal for a streak');

    await play.page.click('#flag-daily-again');
    await play.page.waitForSelector('#flag-daily-grid');
    await play.page.click('#flag-daily-bank');
    await play.page.waitForSelector('#flag-daily-results');
    const kept = await play.page.evaluate((asof) => FlagDaily.load().days[asof].best, date);
    ok(kept === Number(results.score), 'banking nothing on the replay keeps the better score');
    await play.ctx.close();
  }

  // E. Wrong flagship points at today's game.
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    await page.goto(BASE + '/tycoon/play.html?daily=1&asof=2026-01-01', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#flag-daily-layer h1', { timeout: 15000 });
    const gate = await page.evaluate(() => {
      const spec = FlagDaily.challengeFor('2026-01-01');
      const text = document.getElementById('flag-daily-layer').textContent;
      const link = document.querySelector('#flag-daily-layer a.fd-again');
      return {
        specGame: spec.game.id,
        points: text.indexOf(spec.game.name) >= 0,
        href: link ? link.getAttribute('href') : '',
        expected: spec.game.href.indexOf('?') >= 0
          ? spec.game.href + '&asof=2026-01-01'
          : spec.game.href + '?asof=2026-01-01',
      };
    });
    const same = gate.specGame === 'tycoon';
    ok(same || (gate.points && gate.href === gate.expected),
      same ? '2026-01-01 is Startup Tycoon, so the sprint opens there' : 'another flagship tells you where today\'s score counts');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

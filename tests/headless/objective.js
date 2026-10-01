/*
 * SITE-6 — two games never said what winning was.
 *
 * Every arcade view carries a subtitle, and thirteen of the fifteen
 * already stated the goal there. Two did not, and one of those is the
 * one where it matters most:
 *   - Crate Escape is Sokoban. Nothing on the screen says the crates
 *     have to end up on the lit pads; a newcomer pushes them around and
 *     wonders what the game wants.
 *   - Vector Defense said how to build a turret and never what a run is
 *     for, or what losing looks like.
 * Snake, Tetris and Asteroids stated keys only. Famous enough to get
 * away with it, and saying the goal costs nothing.
 *
 *  A. Every arcade game's subtitle says more than which keys to press.
 *  B. Crate Escape's stated goal is the one checkSolved actually tests.
 *  C. Vector Defense's stated wave and life counts are the real ones.
 *  Z. Zero page errors.
 *
 * Hook-free. Reads the production copy and the code behind it.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// B/C: the copy is checked against the code that owns the rule.
const crate = fs.readFileSync(path.join(ROOT, 'js/crateescape.js'), 'utf8');
const vd = fs.readFileSync(path.join(ROOT, 'js/vectordefense.js'), 'utf8');
const hub = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const solves = /function checkSolved\(\)[\s\S]{0,300}?crates\.every\(c => goalSet\.has/.test(crate);
const crateCopy = /Push every crate onto a lit pad/.test(hub);
ok(solves && crateCopy,
  'Crate Escape says the goal checkSolved really tests: every crate on a pad');

const waves = /const WAVES = (\d+)/.exec(vd);
const lives = /lives = (\d+);/.exec(vd);
const WORD = { 10: 'ten' };
ok(!!waves && new RegExp(`Hold ${WORD[waves[1]] || waves[1]} waves`).test(hub),
  `Vector Defense's wave count is the real one (WAVES = ${waves ? waves[1] : '?'})`);
ok(!!lives && new RegExp(`one of your ${WORD[lives[1]] || lives[1]} lives`).test(hub),
  `Vector Defense's life count is the real one (lives = ${lives ? lives[1] : '?'})`);

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => localStorage.setItem('eureka-primer-seen', '1'));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // A. a subtitle that only lists keys does not tell you what the game is.
  // "Objective language" is a verb about the run, not a control.
  const subs = await page.evaluate(() => {
    const ids = ['snake', 'tetris', 'breakout', 'asteroids', '2048', 'minesweeper', 'lightcycles',
                 'pong', 'stacker', 'crateescape', 'vectordefense', 'wordcascade', 'memorymatrix',
                 'connect4', 'word5', 'maze'];
    return ids.map(id => {
      const sec = document.getElementById('view-' + id);
      const el = sec && sec.querySelector('.game-subtitle');
      return { id, text: el ? el.textContent.trim() : null };
    });
  });
  // A heuristic, deliberately: "states a goal" is a judgement, and the
  // cheapest honest proxy is whether the line contains a verb about the
  // RUN rather than about the keyboard. The vocabulary is outcome words —
  // widening it to make a particular string pass would defeat the point,
  // so anything added here has to read as an objective on its own.
  const GOAL = new RegExp('\\b(' + [
    'clear', 'clears', 'win', 'wins', 'survive', 'reach', 'reaches', 'reveal',
    'spell', 'guess', 'connect', 'hold', 'stop', 'trap', 'grow', 'stack',
    'first to', 'beat', 'escape', 'solve', 'avoid', 'without',
    'push every', 'as high as', 'run ends', 'ends the run',
    "don't", 'never', 'before', 'until',
  ].join('|') + ')\\b', 'i');
  const missing = subs.filter(s => !s.text || !GOAL.test(s.text));
  ok(missing.length === 0,
    `every arcade game states its goal, not just its keys${missing.length ? ' — missing: ' + missing.map(m => m.id).join(', ') : ''}`);
  ok(subs.every(s => s.text && s.text.length > 20),
    'and none of them is empty or a stub');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

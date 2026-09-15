/*
 * SITE-7 — seven games never said which key does it.
 *
 * SITE-6 made every arcade subtitle state the goal. Nine of them also
 * named an input; seven stated the goal and left the player to guess
 * how to reach it:
 *   - Light Cycles said to trap your rival and not that anything steers,
 *     let alone that 2 PLAYERS hands the arrows to P2.
 *   - Pong printed "W/S or up/down" on the canvas mid-run and nowhere a
 *     player looks before starting.
 *   - Stacker said "drop the slider" without saying what drops it.
 *   - Word Cascade said "steer the letters" — the whole instruction is
 *     the word "steer".
 *   - Breakout said "move to aim" and never that the mouse does it.
 *   - Memory Matrix has a 1-9 pad mapping that is invisible on screen.
 *   - Word 5 never said Enter submits.
 *
 *  A. Every arcade subtitle names at least one input.
 *  B-H. Each of the seven claims is the input its game actually handles.
 *  Z. Zero page errors.
 *
 * Hook-free. B-H read the handlers, not a copy of them: if a keybinding
 * is changed and the subtitle is not, this suite is what notices.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const hub = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// The subtitle as it sits in the file, entities and all, for one game.
function subtitle(id) {
  const sec = hub.indexOf(`id="view-${id}"`);
  if (sec < 0) return null;
  const m = /class="game-subtitle">([\s\S]*?)<\/div>/.exec(hub.slice(sec, sec + 4000));
  return m ? m[1] : null;
}

// B. Light Cycles — arrows and WASD both steer, and in 2P the arrows
// move to P2. `arrowsWho` is the line that decides it.
{
  const s = src('lightcycles.js');
  const code = /case 'ArrowUp':\s+steer\(arrowsWho/.test(s)
            && /case 'w': case 'W': steer\(0/.test(s)
            && /const arrowsWho = twoPlayer \? 1 : 0/.test(s)
            && /canvas\.addEventListener\('touchend'/.test(s);
  const copy = subtitle('lightcycles') || '';
  ok(code && /Arrows or WASD steer/.test(copy) && /swipe on mobile/.test(copy)
     && /WASD is P1 and arrows are P2/.test(copy),
    'Light Cycles: arrows/WASD steer, swipe on mobile, arrows go to P2 in 2 PLAYERS');
}

// C. Pong — W/S always, arrows only when solo, drag on your own half,
// Space to serve.
{
  const s = src('pong.js');
  const code = /if \(keys\.w\) d1 -= 1;/.test(s)
            && /if \(!twoPlayer\) \{ if \(keys\.up\) d1 -= 1;/.test(s)
            && /canvas\.addEventListener\('pointermove'/.test(s)
            && /e\.key === ' ' && \(!running \|\| matchOver\)/.test(s);
  const copy = subtitle('pong') || '';
  ok(code && /W\/S or &uarr;\/&darr;/.test(copy) && /drag your half on touch/.test(copy)
     && /Space serves/.test(copy),
    'Pong: W/S or arrows, drag your half, Space serves');
}

// D. Stacker — three keys drop, and so does a pointer on the canvas.
{
  const s = src('stacker.js');
  const keys = /e\.key === ' ' \|\| e\.key === 'ArrowDown' \|\| e\.key === 'Enter'/.test(s);
  const click = /canvas\.addEventListener\('pointerdown', \(\) => \{ \(!running \|\| over\) \? start\(\) : drop\(\)/.test(s);
  const copy = subtitle('stacker') || '';
  ok(keys && click && /Space, &darr; or click drops/.test(copy),
    'Stacker: Space / down-arrow / click all drop the slider');
}

// E. Word Cascade — left/right move, down soft-drops, Space hard-drops,
// and a tap to either side of the letter nudges it that way.
{
  const s = src('wordcascade.js');
  const code = /e\.key === 'ArrowLeft' && canBe\(cur\.col - 1/.test(s)
            && /e\.key === 'ArrowDown'\) dropT = dropEvery/.test(s)
            && /e\.key === ' ' && !e\.repeat\) \{ while \(canBe\(cur\.col, cur\.row \+ 1\)\)/.test(s)
            && /if \(col < cur\.col && canBe\(cur\.col - 1/.test(s);
  const copy = subtitle('wordcascade') || '';
  ok(code && /&larr; &rarr; move/.test(copy) && /&darr; soft drop/.test(copy)
     && /Space hard drop/.test(copy) && /tap either side on touch/.test(copy),
    'Word Cascade: arrows move, down soft-drops, Space hard-drops, tap nudges');
}

// F. Breakout — the paddle follows the mouse or a touch; arrows nudge it;
// Space (or up) launches.
{
  const s = src('breakout.js');
  const code = /canvas\.addEventListener\('mousemove'/.test(s)
            && /canvas\.addEventListener\('touchstart'/.test(s)
            && /e\.key === 'ArrowLeft'\)  \{ pointerX =/.test(s)
            && /e\.key === ' ' \|\| e\.key === 'ArrowUp'\) \{ launch\(\)/.test(s);
  const copy = subtitle('breakout') || '';
  ok(code && /mouse, touch or &larr; &rarr; moves the paddle/.test(copy)
     && /Space launches/.test(copy),
    'Breakout: mouse/touch/arrows move the paddle, Space launches');
}

// G. Memory Matrix — the 1-9 mapping is the point: it is reading order,
// and nothing on the canvas says so.
{
  const s = src('memorymatrix.js');
  const code = /canvas\.addEventListener\('click'/.test(s)
            && /if \(phase === 'input' && \/\^\[1-9\]\$\/\.test\(e\.key\)\)/.test(s)
            && /pressPad\(\+e\.key - 1\)/.test(s);
  const copy = subtitle('memorymatrix') || '';
  ok(code && /click the pads, or keys 1-9 in reading order/.test(copy),
    'Memory Matrix: click the pads, or 1-9 in reading order');
}

// H. Word 5 — a physical keyboard and the on-screen one both work.
{
  const s = src('word5.js');
  const code = /k === 'Enter'\) \{ handle\('enter'\)/.test(s)
            && /k === 'Backspace'\) \{ handle\('back'\)/.test(s)
            && /b\.addEventListener\('click', \(\) => handle\(key\)\)/.test(s);
  const copy = subtitle('word5') || '';
  ok(code && /type or tap the keys/.test(copy) && /Enter submits, Backspace deletes/.test(copy),
    'Word 5: type or tap, Enter submits, Backspace deletes');
}

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

  // A. The rendered copy, so an entity that does not resolve is caught too.
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
  // Deliberately a vocabulary of INPUTS, the mirror of objective.js's
  // vocabulary of outcomes. Widening it to make one string pass would
  // defeat the point: anything added has to name a thing a player does
  // with their hands.
  const INPUT = new RegExp('(' + [
    'arrow', 'arrows', 'wasd', 'swipe', 'tap', 'type', 'click', 'drag',
    'space', 'enter', 'backspace', 'mouse', 'touch', 'key', 'keys',
    'long-press', '←', '→', '↑', '↓', 'w/s',
  ].join('|') + ')', 'i');
  const missing = subs.filter(s => !s.text || !INPUT.test(s.text));
  ok(missing.length === 0,
    `every arcade game names an input, not just a goal${missing.length ? ' — missing: ' + missing.map(m => m.id).join(', ') : ''}`);

  // Entities are easy to fumble in a line this long; a raw "&middot;"
  // reaching the DOM means one of them was written &amp;middot;.
  const rawEntity = subs.filter(s => s.text && /&(middot|mdash|larr|rarr|uarr|darr);/.test(s.text));
  ok(rawEntity.length === 0,
    `no subtitle renders a literal entity${rawEntity.length ? ' — ' + rawEntity.map(m => m.id).join(', ') : ''}`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

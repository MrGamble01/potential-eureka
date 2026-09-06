/*
 * PONG-1 — SPLIT multiball scoring (re-runnable, no hooks).
 *
 * tick() used to award a point only after balls.length === 0. With the
 * ✦ SPLIT power-up (up to 3 live balls) a ball that left while a sibling
 * was still in play scored nothing. Only the last ball to leave paid,
 * and it could credit the wrong side for the rally.
 *
 * Every exit now scores immediately; only the next serve waits for the
 * field to clear. Scoring also stops at match point so a later sibling
 * cannot turn a 7–6 win into 7–7 after the overlay has already been
 * drawn, and a second exit cannot push a side past WIN_SCORE.
 *
 * Drives the real tick() extracted from js/pong.js inside a vm — no
 * window.__pongTest hook (QA-23 / nohooks). Constants come from the
 * same file so a toy field cannot hide a real-constant regression.
 *
 * Non-vacuous by construction: this suite fails against main's
 * last-ball-only scoring (opposite-side exits become [0, 1] instead of
 * [1, 1]; a mid-field sibling drops the exiting ball's point entirely).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pongPath = process.argv[2] || path.join(__dirname, '../../js/pong.js');
const source = fs.readFileSync(pongPath, 'utf8');

const tickStart = source.indexOf('  function tick(dt)');
const tickEnd = source.indexOf('  function movePaddles(dt)');
assert.ok(tickStart >= 0 && tickEnd > tickStart, 'js/pong.js must contain tick() before movePaddles()');
const tick = source.slice(tickStart, tickEnd);
assert.ok(tick.includes('function tick'), 'extracted the tick function, not an empty slice');
assert.ok(tick.includes('scores[scorer]'), 'tick still awards a point to a scorer');
assert.ok(tick.length > 400, `tick extract is a real function body (${tick.length} chars)`);

function constNum(name) {
  const m = source.match(new RegExp(`(?:const|let|,)\\s*${name}\\s*=\\s*(-?\\d+)`));
  assert.ok(m, `js/pong.js must declare ${name}`);
  return Number(m[1]);
}

const WIDTH = constNum('WIDTH');
const HEIGHT = constNum('HEIGHT');
const BALL_R = constNum('BALL_R');
const WIN_SCORE = constNum('WIN_SCORE');
assert.ok(WIDTH > 100 && HEIGHT > 100 && BALL_R > 0 && WIN_SCORE >= 2,
  `real-table constants (WIDTH=${WIDTH} HEIGHT=${HEIGHT} BALL_R=${BALL_R} WIN_SCORE=${WIN_SCORE})`);

const LEFT_OUT = -BALL_R * 2 - 1;
const RIGHT_OUT = WIDTH + BALL_R * 2 + 1;
const IN_PLAY = WIDTH / 2;

function run(scores, positions) {
  const state = {
    running: true,
    frameCount: 0,
    serveTimer: 0,
    matchOver: false,
    scores: [...scores],
    balls: positions.map(x => ({ x, y: HEIGHT / 2, vx: 0, vy: 0 })),
    powerTimer: 999,
    powers: [],
    paddles: [],
    particles: [],
    WIDTH, HEIGHT, BALL_R, WIN_SCORE,
    movePaddles() {},
    paddleRect: () => ({ x: WIDTH * 4, y: 0, w: 1, h: 1 }),
    blip() {},
    sfx() {},
    updateInfo() {},
    draw() {},
    endMatch(winner) {
      state.matchOver = true;
      state.running = false;
      state.winner = winner;
      state.finalScore = [...state.scores];
    },
  };
  vm.runInNewContext(tick + '; tick(1);', state);
  return state;
}

let pass = 0, fail = 0;
function check(cond, name) {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}`);
  }
}

let s = run([0, 0], [LEFT_OUT, RIGHT_OUT]);
check(s.scores[0] === 1 && s.scores[1] === 1, 'opposite-side exits both score in the same tick');
check(s.serveTimer === 55, 'next serve waits until the field is clear');
check(s.balls.length === 0, 'both exiting balls are removed');

s = run([0, 0], [IN_PLAY, RIGHT_OUT]);
check(s.scores[0] === 1 && s.scores[1] === 0, 'an exit scores while a sibling remains in play');
check(s.balls.length === 1, 'the surviving ball stays live');
check(s.serveTimer === 0, 'no serve is scheduled while a sibling is still on the table');

s = run([0, 0], [LEFT_OUT, IN_PLAY, RIGHT_OUT]);
check(s.scores[0] === 1 && s.scores[1] === 1, 'SPLIT max (3 live) pays both exits and keeps the middle ball');
check(s.balls.length === 1 && s.serveTimer === 0, 'the middle ball blocks the next serve');

s = run([6, 6], [LEFT_OUT, RIGHT_OUT]);
check(s.scores[0] === 7 && s.scores[1] === 6, 'later exits cannot change a finished match');
check(Array.isArray(s.finalScore) && s.scores[0] === s.finalScore[0] && s.scores[1] === s.finalScore[1],
  'HUD score matches the final overlay');
check(s.winner === 0 && s.matchOver === true, 'the first match-point exit ends the match');

s = run([6, 0], [RIGHT_OUT, RIGHT_OUT]);
check(s.scores[0] === WIN_SCORE && s.scores[1] === 0, 'a second split ball cannot overscore match point');
check(s.winner === 0, 'overscore guard still names the real winner');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail) process.exit(1);
console.log('PASS: per-ball points, serve timing, surviving ball, final-score consistency');

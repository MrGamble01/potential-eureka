const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(process.argv[2] || require('node:path').join(__dirname, '../../js/pong.js'), 'utf8');
const tick = source.slice(source.indexOf('  function tick(dt)'), source.indexOf('  function movePaddles(dt)'));
function run(scores, positions) {
  const state = { running: true, frameCount: 0, serveTimer: 0, matchOver: false,
    scores: [...scores], balls: positions.map(x => ({ x, y: 50, vx: 0, vy: 0 })),
    powerTimer: 999, powers: [], paddles: [], particles: [],
    WIDTH: 300, HEIGHT: 200, BALL_R: 5, WIN_SCORE: 7,
    movePaddles() {}, paddleRect: () => ({ x: 1000, y: 0, w: 1, h: 1 }),
    blip() {}, sfx() {}, updateInfo() {}, draw() {},
    endMatch(winner) { state.matchOver = true; state.running = false;
      state.winner = winner; state.finalScore = [...state.scores]; }
  };
  vm.runInNewContext(tick + '; tick(1);', state);
  return state;
}
let s = run([0, 0], [-20, 320]);
assert.deepEqual(s.scores, [1, 1], 'both exits score before match point');
assert.equal(s.serveTimer, 55, 'next serve waits until all balls leave');
s = run([0, 0], [150, 320]);
assert.deepEqual(s.scores, [1, 0], 'an exit scores while a sibling remains');
assert.equal(s.balls.length, 1);
assert.equal(s.serveTimer, 0);
s = run([6, 6], [-20, 320]);
assert.deepEqual(s.scores, [7, 6], 'later exits cannot change a finished match');
assert.deepEqual(s.scores, s.finalScore, 'HUD score matches the final overlay');
assert.equal(s.winner, 0);
s = run([6, 0], [320, 320]);
assert.deepEqual(s.scores, [7, 0], 'a second split ball cannot overscore match point');
console.log('PASS: per-ball points, serve timing, surviving ball, final-score consistency');

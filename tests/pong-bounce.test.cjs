const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/pong.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.PongGame = PongGame;', vm.createContext(sandbox), { filename: 'js/pong.js' });
const rules = sandbox.PongGame.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('the ceiling and floor flip the ball back into the table', () => {
  const top = rules.wallBounce(1, -3, rules.height, rules.ballR);
  assert.equal(top.y, rules.ballR);
  assert.equal(top.vy, 3);
  const bottom = rules.wallBounce(rules.height, 2, rules.height, rules.ballR);
  assert.equal(bottom.y, rules.height - rules.ballR);
  assert.equal(bottom.vy, -2);
  assert.deepEqual(host(rules.wallBounce(40, -1, rules.height, rules.ballR)), { y: 40, vy: -1 });
});

test('a paddle sends the ball back, faster, and never past the cap', () => {
  const middle = rules.paddleReply(0, -4, 0, 1);
  assert.ok(Math.abs(middle.vy) < 1e-9);
  assert.ok(middle.vx > 4);
  const high = rules.paddleReply(-1, -4, 0.2, 1);
  assert.ok(high.vy < 0);
  const fast = rules.paddleReply(0.2, 20, 0, -1);
  assert.ok(Math.abs(Math.hypot(fast.vx, fast.vy) - 11) < 1e-9);
  assert.ok(fast.vx < 0);
});

test('a ball off the left scores for the right, and a blowout slows the leader', () => {
  assert.equal(rules.pointScorer(-rules.ballR * 2 - 1, rules.width, rules.ballR), 1);
  assert.equal(rules.pointScorer(rules.width + rules.ballR * 2 + 1, rules.width, rules.ballR), 0);
  assert.equal(rules.pointScorer(rules.width / 2, rules.width, rules.ballR), -1);
  assert.equal(rules.aiPace(0), 4.6);
  assert.ok(Math.abs(rules.aiPace(10) - 3.4) < 1e-9);
  assert.ok(Math.abs(rules.aiPace(-10) - 5.8) < 1e-9);
});

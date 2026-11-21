const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/breakout.js'), 'utf8');
const sandbox = {
  Utils: { gameLoop() { return { start() {}, stop() {} }; }, sfx() {} },
};
vm.runInContext(src + '\nglobalThis.BreakoutGame = BreakoutGame;', vm.createContext(sandbox), { filename: 'js/breakout.js' });
const rules = sandbox.BreakoutGame.rules;

test('serve speed climbs with the level and stops at the cap', () => {
  assert.equal(rules.serveSpeed(1), 4.75);
  assert.ok(rules.serveSpeed(2) > rules.serveSpeed(1));
  assert.equal(rules.serveSpeed(40), rules.speedMax);
});

test('the middle of the paddle sends the ball straight up', () => {
  const up = rules.paddleAim(0, 5);
  assert.ok(Math.abs(up.vx) < 1e-9);
  assert.ok(Math.abs(up.vy + 5) < 1e-9);
  const right = rules.paddleAim(1, 5);
  assert.ok(right.vx > 0);
  assert.ok(right.vy < 0);
});

test('a side hit flips horizontal speed and a top hit flips vertical', () => {
  const side = rules.reflectBrick(10, 20, 3, 0, 8, 10, rules.ballR, rules.brickW, rules.brickH);
  assert.ok(side);
  assert.equal(side.vx, -3);
  assert.equal(side.vy, 0);
  assert.ok(side.x < 10);
  const miss = rules.reflectBrick(0, 0, 1, 1, 80, 80, rules.ballR, rules.brickW, rules.brickH);
  assert.equal(miss, null);
  const top = rules.reflectBrick(30, 12, 0, 4, 10, 10, rules.ballR, rules.brickW, rules.brickH);
  assert.ok(top);
  assert.equal(top.vy, -4);
  assert.ok(top.y < 12);
});

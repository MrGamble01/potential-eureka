const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/gutterlight.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.GutterlightGame = GutterlightGame;', vm.createContext(sandbox), { filename: 'js/gutterlight.js' });
const rules = sandbox.GutterlightGame.rules;
const host = (value) => value && JSON.parse(JSON.stringify(value));

test('a harder putt is faster, and straight up has no sideways speed', () => {
  const soft = rules.puttVelocity(0, 0);
  assert.ok(Math.abs(soft.vx - 2.4) < 1e-9);
  assert.ok(Math.abs(soft.vy) < 1e-9);
  const hard = rules.puttVelocity(Math.PI / 2, 1);
  assert.ok(Math.abs(hard.vx) < 1e-9);
  assert.ok(Math.abs(hard.vy - 9.6) < 1e-9);
});

test('a side hit flips horizontal speed and a miss does not', () => {
  const wall = [10, 10, 20, 40];
  const side = host(rules.bounceBall(33, 30, -2, 0.2, wall));
  assert.equal(side.x, 38);
  assert.ok(Math.abs(side.vx - 1.44) < 1e-9);
  assert.equal(side.vy, 0.2);
  const top = host(rules.bounceBall(20, 8, 0, 3, wall));
  assert.equal(top.y, 2);
  assert.ok(Math.abs(top.vy - -2.16) < 1e-9);
  assert.equal(rules.bounceBall(100, 100, 1, 1, wall), null);
});

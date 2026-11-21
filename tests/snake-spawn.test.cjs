const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/snake.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.SnakeGame = SnakeGame;', vm.createContext(sandbox), { filename: 'js/snake.js' });
const rules = sandbox.SnakeGame.rules;
const host = (value) => value && JSON.parse(JSON.stringify(value));

test('a full board stops the search, and a hidden open cell is still found', () => {
  const full = () => true;
  assert.equal(rules.findOpenCell(4, 4, full, () => 0), null);
  const open = (x, y) => !(x === 3 && y === 2);
  assert.deepEqual(host(rules.findOpenCell(4, 4, open, () => 0)), { x: 3, y: 2 });
});

test('a pickup that never finds an open cell is not placed on a blocked one', () => {
  assert.equal(rules.placePickup(3, 3, () => true, () => 0.2, 100), null);
  assert.deepEqual(host(rules.placePickup(3, 3, (x, y) => x === 0 && y === 0, () => 0, 5)), null);
  assert.deepEqual(host(rules.placePickup(3, 3, () => false, () => 0, 5)), { x: 0, y: 0 });
});

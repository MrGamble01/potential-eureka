const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/snake.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.SnakeGame = SnakeGame;', vm.createContext(sandbox), { filename: 'js/snake.js' });
const rules = sandbox.SnakeGame.rules;
const host = (value) => JSON.parse(JSON.stringify(value));
const right = { x: 1, y: 0 };
const left = { x: -1, y: 0 };

test('wrap carries the head to the far side, and walls end the run', () => {
  assert.deepEqual(host(rules.nextCell(0, 4, left, rules.cols, rules.rows, true)), { x: rules.cols - 1, y: 4, dead: false });
  assert.deepEqual(host(rules.nextCell(rules.cols - 1, rules.rows - 1, { x: 1, y: 1 }, rules.cols, rules.rows, true)), { x: 0, y: 0, dead: false });
  assert.equal(rules.nextCell(0, 4, left, rules.cols, rules.rows, false).dead, true);
  assert.equal(rules.nextCell(4, 4, right, rules.cols, rules.rows, false).dead, false);
});

test('the tail is free until the snake is about to grow', () => {
  const tail = { x: 2, y: 5 };
  const body = [{ x: 4, y: 5 }, { x: 3, y: 5 }, tail];
  assert.equal(rules.hitsSelf(body, 2, 5, false), false);
  assert.equal(rules.hitsSelf(body, 2, 5, true), true);
  assert.equal(rules.hitsSelf(body, 3, 5, false), true);
  assert.equal(rules.hitsSelf(body, 9, 9, true), false);
});

test('the level climbs one step every three foods', () => {
  assert.equal(rules.levelFor(0), 1);
  assert.equal(rules.levelFor(2), 1);
  assert.equal(rules.levelFor(3), 2);
  assert.equal(rules.levelFor(8), 3);
});

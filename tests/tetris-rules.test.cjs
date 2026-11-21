const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/tetris.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.TetrisGame = TetrisGame;', vm.createContext(sandbox), { filename: 'js/tetris.js' });
const rules = sandbox.TetrisGame.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

function empty() {
  return Array.from({ length: rules.rows }, () => Array(rules.cols).fill(null));
}

test('a piece turned four times is the piece you started with', () => {
  for (const key of Object.keys(rules.pieces)) {
    const start = rules.pieces[key].shape;
    let shape = start;
    for (let i = 0; i < 4; i++) shape = rules.rotate(shape);
    assert.deepEqual(shape, start, key);
  }
  const t = rules.pieces.T.shape;
  assert.deepEqual(host(rules.rotate(t)), [
    [0, 1, 0],
    [0, 1, 1],
    [0, 1, 0],
  ]);
});

test('a filled cell and the side walls block, and the hidden rows above do not', () => {
  const board = empty();
  const o = rules.pieces.O.shape;
  assert.equal(rules.blocked(board, rules.cols, rules.rows, o, 0, 0), false);
  assert.equal(rules.blocked(board, rules.cols, rules.rows, o, -1, 0), true);
  assert.equal(rules.blocked(board, rules.cols, rules.rows, o, rules.cols - 1, 0), true);
  assert.equal(rules.blocked(board, rules.cols, rules.rows, o, 0, rules.rows - 1), true);
  assert.equal(rules.blocked(board, rules.cols, rules.rows, o, 4, -2), false);
  board[18][4] = '#fff';
  assert.equal(rules.blocked(board, rules.cols, rules.rows, o, 4, 18), true);
  assert.equal(rules.blocked(board, rules.cols, rules.rows, o, 4, 17), true);
  assert.equal(rules.blocked(board, rules.cols, rules.rows, o, 6, 18), false);
});

test('line clears pay the classic table, then back-to-back and combo', () => {
  assert.equal(rules.linePoints(1, 1, 1, false), 100);
  assert.equal(rules.linePoints(2, 3, 1, false), 900);
  assert.equal(rules.linePoints(3, 2, 1, false), 1000);
  assert.equal(rules.linePoints(4, 2, 1, false), 1600);
  assert.equal(rules.linePoints(4, 1, 1, true), 1200);
  assert.equal(rules.linePoints(4, 2, 1, false), 1600);
  assert.equal(rules.linePoints(1, 1, 3, false), 200);
  assert.equal(rules.linePoints(4, 2, 3, true), 2600);
});

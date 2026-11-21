const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'js/connect4.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.ConnectFourGame = ConnectFourGame;', vm.createContext(sandbox), { filename: 'js/connect4.js' });
const rules = sandbox.ConnectFourGame.rules;

function empty() {
  return Array.from({ length: rules.rows }, () => Array(rules.cols).fill(0));
}

function fillBottom(board, who, cols) {
  for (const c of cols) board[rules.rows - 1][c] = who;
}

test('a disc falls to the lowest open cell', () => {
  const board = empty();
  assert.equal(rules.dropRow(board, 3), 5);
  board[5][3] = rules.player;
  assert.equal(rules.dropRow(board, 3), 4);
  for (let r = 0; r < rules.rows; r++) board[r][3] = rules.player;
  assert.equal(rules.dropRow(board, 3), -1);
  assert.equal(rules.dropRow(board, 99), -1);
});

test('four in a line wins, and three does not', () => {
  const horizontal = empty();
  fillBottom(horizontal, rules.player, [0, 1, 2, 3]);
  assert.equal(rules.anyWinner(horizontal), rules.player);
  assert.equal(rules.winnerFrom(horizontal, 5, 1).length, 4);

  const vertical = empty();
  for (let r = 2; r < 6; r++) vertical[r][0] = rules.ai;
  assert.equal(rules.anyWinner(vertical), rules.ai);

  const diagonal = empty();
  for (let i = 0; i < 4; i++) diagonal[i + 2][i] = rules.player;
  assert.equal(rules.anyWinner(diagonal), rules.player);

  const other = empty();
  for (let i = 0; i < 4; i++) other[i][3 - i] = rules.ai;
  assert.equal(rules.anyWinner(other), rules.ai);

  const short = empty();
  fillBottom(short, rules.player, [0, 1, 2]);
  assert.equal(rules.anyWinner(short), null);
  assert.equal(rules.winnerFrom(short, 5, 0), null);
});

test('a full board is full, and the search puts its discs back', () => {
  const board = empty();
  assert.equal(rules.isFull(board), false);
  for (let r = 0; r < rules.rows; r++) {
    for (let c = 0; c < rules.cols; c++) board[r][c] = (r + c) % 2 ? rules.player : rules.ai;
  }
  assert.equal(rules.isFull(board), true);

  const threat = empty();
  fillBottom(threat, rules.player, [0, 1, 2]);
  const before = JSON.stringify(threat);
  assert.equal(rules.bestMove(threat, 2), 3);
  assert.equal(JSON.stringify(threat), before);

  const win = empty();
  fillBottom(win, rules.ai, [4, 5, 6]);
  assert.equal(rules.bestMove(win, 2), 3);
});

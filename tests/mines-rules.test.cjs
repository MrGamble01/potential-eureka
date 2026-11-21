const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/minesweeper.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.MinesweeperGame = MinesweeperGame;', vm.createContext(sandbox), { filename: 'js/minesweeper.js' });
const rules = sandbox.MinesweeperGame.rules;

test('the first click and its neighbours are kept clear, including on a corner', () => {
  const corner = rules.safeZone(9, 9, 0, 0);
  assert.equal(corner.size, 4);
  assert.ok(corner.has(0));
  assert.ok(!corner.has(2));
  const middle = rules.safeZone(9, 9, 4, 4);
  assert.equal(middle.size, 9);
  assert.equal(rules.diffs.beginner.mines, 10);
  assert.equal(rules.diffs.expert.cols * rules.diffs.expert.rows, 480);
});

test('neighbour counts stop at the edge and a chord needs the matching flags', () => {
  const mines = new Set([1, 9]);
  const isMine = (r, c) => mines.has(r * 9 + c);
  assert.equal(rules.minesAround(9, 9, isMine, 0, 0), 2);
  assert.equal(rules.minesAround(9, 9, isMine, 1, 1), 2);
  assert.equal(rules.minesAround(9, 9, isMine, 5, 5), 0);
  assert.equal(rules.chordOpens(2, 2), true);
  assert.equal(rules.chordOpens(2, 1), false);
  assert.equal(rules.chordOpens(0, 0), false);
});

test('the board is won only when every safe cell is open', () => {
  const cells = [
    { mine: true, revealed: false },
    { mine: false, revealed: true },
    { mine: false, revealed: false },
  ];
  assert.equal(rules.hiddenSafe(cells), 1);
  cells[2].revealed = true;
  assert.equal(rules.hiddenSafe(cells), 0);
});

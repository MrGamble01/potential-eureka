const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/minesweeper.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.MinesweeperGame = MinesweeperGame;', vm.createContext(sandbox), { filename: 'js/minesweeper.js' });
const rules = sandbox.MinesweeperGame.rules;

test('a hidden tab is not billed against the clear time', () => {
  assert.equal(rules.clockGap(200), 200);
  assert.equal(rules.clockGap(1000), 1000);
  assert.equal(rules.clockGap(1001), 0);
  assert.equal(rules.clockGap(60000), 0);
  assert.equal(rules.clockGap(0), 0);
  assert.equal(rules.clockGap(-5), 0);
  assert.equal(rules.clockGap(NaN), 0);
  assert.equal(rules.clockGap(Infinity), 0);
});

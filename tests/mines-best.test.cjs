const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/minesweeper.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.MinesweeperGame = MinesweeperGame;', vm.createContext(sandbox), { filename: 'js/minesweeper.js' });
const rules = sandbox.MinesweeperGame.rules;

test('a junk or negative best time is no record, so a real clear can replace it', () => {
  assert.equal(rules.readBest(null), null);
  assert.equal(rules.readBest(''), null);
  assert.equal(rules.readBest('nope'), null);
  assert.equal(rules.readBest('-1'), null);
  assert.equal(rules.readBest('NaN'), null);
  assert.equal(rules.readBest('12.5'), null);
  assert.equal(rules.readBest('  40 '), 40);
  assert.equal(rules.readBest('0'), 0);
  assert.equal(rules.beatsBest(30, null), true);
  assert.equal(rules.beatsBest(30, 40), true);
  assert.equal(rules.beatsBest(40, 40), false);
  assert.equal(rules.beatsBest(30, rules.readBest('nope')), true);
  assert.equal(rules.beatsBest(30, rules.readBest('-1')), true);
  assert.equal(rules.beatsBest(NaN, 10), false);
});

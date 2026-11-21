const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/minesweeper.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.MinesweeperGame = MinesweeperGame;', vm.createContext(sandbox), { filename: 'js/minesweeper.js' });
const rules = sandbox.MinesweeperGame.rules;

test('a long-press stays armed when the finger jitters on the same cell', () => {
  assert.equal(rules.sameCell({ r: 2, c: 3 }, { r: 2, c: 3 }), true);
  assert.equal(rules.sameCell({ r: 2, c: 3 }, { r: 2, c: 4 }), false);
  assert.equal(rules.sameCell({ r: 2, c: 3 }, { r: 3, c: 3 }), false);
  assert.equal(rules.sameCell(null, { r: 0, c: 0 }), false);
  assert.equal(rules.sameCell({ r: 0, c: 0 }, null), false);
  assert.equal(rules.sameCell(null, null), false);
});

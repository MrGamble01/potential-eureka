const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/lightcycles.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.LightCyclesGame = LightCyclesGame;', vm.createContext(sandbox), { filename: 'js/lightcycles.js' });
const rules = sandbox.LightCyclesGame.rules;

function empty() {
  return Array(rules.cols * rules.rows).fill(0);
}
function at(x, y) { return y * rules.cols + x; }

test('a ray stops at a wall and never looks past 24 cells', () => {
  const cells = empty();
  cells[at(10, 8)] = 1;
  assert.equal(rules.rayLength(cells, 5, 8, 1), 4);
  assert.equal(rules.rayLength(cells, 5, 8, 3), 5);
  assert.equal(rules.rayLength(cells, 0, 0, 3), 0);
  const open = empty();
  assert.equal(rules.rayLength(open, 0, 10, 1), 24);
});

test('a pocket counts open cells and a wall splits it from the rest of the grid', () => {
  const cells = empty();
  for (let y = 0; y < rules.rows; y++) cells[at(6, y)] = 1;
  cells[at(6, 4)] = 0;
  const left = rules.openPocket(cells, 4, 4, 1, 90);
  assert.ok(left > 0 && left <= 90);
  const blocked = rules.openPocket(cells, 4, 4, 1, 90);
  cells[at(5, 4)] = 1;
  assert.equal(rules.openPocket(cells, 4, 4, 1, 90), 0);
  assert.ok(blocked > 0);
});

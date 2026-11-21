const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/life.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.LifeGame = LifeGame;', vm.createContext(sandbox), { filename: 'js/life.js' });
const rules = sandbox.LifeGame.rules;

function grid(rows) {
  return rows.map(row => row.split('').map(ch => (ch === '#' ? 1 : 0)));
}

function generation(cells) {
  const rows = cells.length;
  const cols = cells[0].length;
  return cells.map((row, r) => row.map((alive, c) => (
    rules.willLive(alive === 1, rules.neighborsOf(cells, r, c)) ? 1 : 0
  )));
}

test('a blinker flips and a block stays', () => {
  const blink = grid(['.....', '..#..', '..#..', '..#..', '.....']);
  const next = generation(blink);
  assert.deepEqual(next, grid(['.....', '.....', '.###.', '.....', '.....']));
  assert.deepEqual(generation(next), blink);

  const block = grid(['....', '.##.', '.##.', '....']);
  assert.deepEqual(generation(block), block);
});

test('the edge is a wall, so a corner cell does not see the far side', () => {
  const alone = grid(['#..', '...', '..#']);
  assert.equal(rules.neighborsOf(alone, 0, 0), 0);
  assert.equal(rules.neighborsOf(alone, 2, 2), 0);
  assert.deepEqual(generation(alone), grid(['...', '...', '...']));

  const birth = grid(['##.', '#..', '...']);
  assert.equal(rules.willLive(false, rules.neighborsOf(birth, 1, 1)), true);
  assert.equal(generation(birth)[1][1], 1);
});

test('survivors age, newborns start at one, and the colour ramp stops at 99', () => {
  assert.equal(rules.nextAgeOf(true, true, 4), 5);
  assert.equal(rules.nextAgeOf(true, true, 99), 99);
  assert.equal(rules.nextAgeOf(true, false, 0), 1);
  assert.equal(rules.nextAgeOf(false, true, 8), 0);
  assert.equal(rules.willLive(true, 1), false);
  assert.equal(rules.willLive(true, 4), false);
  assert.equal(rules.willLive(false, 3), true);
});

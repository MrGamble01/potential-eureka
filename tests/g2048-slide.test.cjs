const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/game2048.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.Game2048 = Game2048;', vm.createContext(sandbox), { filename: 'js/game2048.js' });
const rules = sandbox.Game2048.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

function blank() {
  return Array.from({ length: rules.size }, () => Array(rules.size).fill(0));
}

test('a line merges once, so four twos become two fours', () => {
  assert.deepEqual(host(rules.compressLine([2, 2, 2, 2]).out), [4, 4, 0, 0]);
  assert.equal(rules.compressLine([2, 2, 2, 2]).gained, 8);
  assert.equal(rules.compressLine([2, 2, 2, 2]).made2048, false);
  assert.deepEqual(host(rules.compressLine([2, 2, 2, 0]).out), [4, 2, 0, 0]);
  assert.deepEqual(host(rules.compressLine([4, 2, 2, 0]).out), [4, 4, 0, 0]);
  assert.deepEqual(host(rules.compressLine([2, 0, 0, 2]).out), [4, 0, 0, 0]);
  assert.deepEqual(host(rules.compressLine([2, 4, 8, 16]).out), [2, 4, 8, 16]);
});

test('1024 merges into 2048 and a stuck board does not move', () => {
  const made = rules.compressLine([1024, 1024, 0, 0]);
  assert.deepEqual(host(made.out), [2048, 0, 0, 0]);
  assert.equal(made.gained, 2048);
  assert.equal(made.made2048, true);

  const grid = blank();
  grid[0] = [2, 4, 2, 4];
  grid[1] = [4, 2, 4, 2];
  grid[2] = [2, 4, 2, 4];
  grid[3] = [4, 2, 4, 2];
  const slide = rules.applySlide(grid, 'L');
  assert.equal(slide.changed, false);
  assert.equal(slide.gained, 0);
  assert.deepEqual(host(slide.next), grid);
});

test('left and right slides land on opposite sides', () => {
  const grid = blank();
  grid[2] = [0, 2, 0, 2];
  assert.deepEqual(host(rules.applySlide(grid, 'L').next[2]), [4, 0, 0, 0]);
  assert.deepEqual(host(rules.applySlide(grid, 'R').next[2]), [0, 0, 0, 4]);
  assert.equal(rules.applySlide(grid, 'L').gained, 4);

  const col = blank();
  col[0][1] = 2;
  col[3][1] = 2;
  assert.deepEqual(host(rules.applySlide(col, 'U').next.map(row => row[1])), [4, 0, 0, 0]);
  assert.deepEqual(host(rules.applySlide(col, 'D').next.map(row => row[1])), [0, 0, 0, 4]);
});

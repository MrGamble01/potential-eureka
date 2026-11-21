const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/memorymatrix.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.MemoryMatrixGame = MemoryMatrixGame;', vm.createContext(sandbox), { filename: 'js/memorymatrix.js' });
const rules = sandbox.MemoryMatrixGame.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('the flash tightens, then stops getting shorter', () => {
  assert.deepEqual(host(rules.flashFor(1)), { on: 402, gap: 145 });
  assert.deepEqual(host(rules.flashFor(20)), { on: 160, gap: 70 });
  assert.deepEqual(host(rules.flashFor(40)), { on: 160, gap: 70 });
});

test('a right pad advances, the last pad clears, and the last heart ends it', () => {
  assert.deepEqual(host(rules.gradePress(2, 2, 0, 3, 3)), { result: 'hit', step: 1 });
  assert.deepEqual(host(rules.gradePress(2, 2, 2, 3, 3)), { result: 'round' });
  assert.deepEqual(host(rules.gradePress(1, 2, 0, 3, 3)), { result: 'miss', lives: 2 });
  assert.deepEqual(host(rules.gradePress(1, 2, 0, 3, 1)), { result: 'over' });
});

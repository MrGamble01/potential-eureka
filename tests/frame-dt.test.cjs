const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/utils.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.Utils = Utils;', vm.createContext(sandbox), { filename: 'js/utils.js' });

test('one frame is about 1, and a resumed tab never steps more than 2.2', () => {
  const dt = sandbox.Utils.frameDt;
  assert.ok(Math.abs(dt(16.667, 0) - 1) < 1e-9);
  assert.equal(dt(0, 0), 0);
  assert.equal(dt(1000, 0), 2.2);
  assert.equal(dt(100, 0), 2.2);
  assert.ok(dt(20, 0) < 2.2);
});

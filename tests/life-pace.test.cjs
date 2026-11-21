const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/life.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.LifeGame = LifeGame;', vm.createContext(sandbox), { filename: 'js/life.js' });
const rules = sandbox.LifeGame.rules;

test('a blank or tiny speed cannot schedule a zero-delay loop', () => {
  assert.equal(rules.paceMs(0), 16);
  assert.equal(rules.paceMs(-40), 16);
  assert.equal(rules.paceMs(NaN), null);
  assert.equal(rules.paceMs('fast'), null);
  assert.equal(rules.paceMs(Infinity), null);
  assert.equal(rules.paceMs(16), 16);
  assert.equal(rules.paceMs(100), 100);
  assert.equal(rules.paceMs(5000), 1000);
});

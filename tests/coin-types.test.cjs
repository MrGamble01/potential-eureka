const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/coins.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.Coins = Coins;', vm.createContext(sandbox), { filename: 'js/coins.js' });
const rules = sandbox.Coins.rules;

test('a coin balance is a finite whole number that cannot go below zero', () => {
  assert.equal(rules.wholeCoins(12.9), 12);
  assert.equal(rules.wholeCoins(0), 0);
  assert.equal(rules.wholeCoins(-4), 0);
  assert.equal(rules.wholeCoins(Number.NaN), 0);
  assert.equal(rules.wholeCoins(Number.POSITIVE_INFINITY), 0);
  assert.equal(rules.wholeCoins('30'), 0);
  assert.equal(rules.wholeCoins(null), 0);
});

test('an unknown accent falls back to indigo', () => {
  assert.equal(rules.paletteId('gold'), 'gold');
  assert.equal(rules.paletteId('indigo'), 'indigo');
  assert.equal(rules.paletteId('neon'), 'indigo');
  assert.equal(rules.paletteId(3), 'indigo');
  assert.equal(rules.paletteId(null), 'indigo');
});

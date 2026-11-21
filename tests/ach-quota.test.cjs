const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

function load(store) {
  const src = readFileSync(join(__dirname, '..', 'js/achievements.js'), 'utf8');
  const sandbox = {
    localStorage: store,
    Utils: { todayKey() { return '2026-11-21'; } },
    setTimeout() {},
    document: {
      createElement() {
        return { className: '', setAttribute() {}, classList: { add() {} }, remove() {} };
      },
      body: { appendChild() {} },
    },
  };
  vm.runInContext(src + '\nglobalThis.Achievements = Achievements;', vm.createContext(sandbox), { filename: 'js/achievements.js' });
  return sandbox.Achievements;
}

test('an unlock still counts when the trophy case cannot be saved', () => {
  const data = { 'snake-high': '100' };
  let writes = 0;
  const store = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem() { writes += 1; throw new Error('QuotaExceededError'); },
  };
  const ach = load(store);
  assert.equal(ach.check(), true);
  assert.ok(ach.unlocked()['snake-100']);
  assert.ok(ach.unlocked()['first-light']);
  assert.equal(ach.check(), false);
  assert.equal(writes, 1);
  assert.equal(store.getItem('arcade-achievements'), null);
});

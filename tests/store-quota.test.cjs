const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

function load(store) {
  const src = readFileSync(join(__dirname, '..', 'js/utils.js'), 'utf8');
  const sandbox = {
    localStorage: store,
    document: { getElementById() { return null; } },
  };
  vm.runInContext(src + '\nglobalThis.Utils = Utils;', vm.createContext(sandbox), { filename: 'js/utils.js' });
  return sandbox.Utils;
}

test('a full disk does not crash a score save or a settings write', () => {
  const blocked = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('QuotaExceededError'); },
  };
  const Utils = load(blocked);
  assert.equal(Utils.highScore.load('tetris-high'), 0);
  assert.equal(Utils.highScore.save('tetris-high', 50, 10), 50);
  assert.equal(Utils.highScore.save('tetris-high', 4, 50), 50);
  assert.equal(Utils.store.set('eureka-todos', [{ t: 'a' }]), false);
  assert.equal(Utils.store.setRaw('arcade-muted', '1'), false);
  assert.equal(Utils.store.getRaw('arcade-muted'), '');
  assert.equal(Utils.store.get('eureka-todos'), null);
  assert.doesNotThrow(() => Utils.store.remove('eureka-todos'));

  const data = {};
  const open = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
  };
  const ok = load(open);
  assert.equal(ok.store.set('eureka-todos', [{ t: 'a' }]), true);
  assert.equal(JSON.stringify(ok.store.get('eureka-todos')), JSON.stringify([{ t: 'a' }]));
  assert.equal(ok.highScore.load('breakout-high'), 0);
  assert.equal(ok.highScore.save('breakout-high', 9, 0), 9);
  assert.equal(ok.highScore.load('breakout-high'), 9);
  assert.equal(ok.highScore.load('labeled'), 0);
  open.setItem('labeled', '12px');
  assert.equal(ok.highScore.load('labeled'), 12);
});

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

function load(store) {
  const src = readFileSync(join(__dirname, '..', 'js/rivals.js'), 'utf8');
  const sandbox = { localStorage: store, btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent };
  vm.runInContext(src + '\nglobalThis.Rivals = Rivals;', vm.createContext(sandbox), { filename: 'js/rivals.js' });
  return sandbox.Rivals;
}

const host = (value) => JSON.parse(JSON.stringify(value));

test('a full disk does not throw while saving a rival, and the hall stays unchanged', () => {
  const data = {};
  const blocked = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem() { throw new Error('QuotaExceededError'); },
  };
  const Rivals = load(blocked);
  assert.doesNotThrow(() => Rivals.setMyName('Ada'));
  assert.equal(Rivals.myName(), '');
  assert.equal(Rivals.add({ name: 'Ada', t: 1, s: { 'snake-high': 40 } }), null);
  assert.deepEqual(host(Rivals.list()), {});

  const openData = {};
  const open = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(openData, k) ? openData[k] : null; },
    setItem(k, v) { openData[k] = String(v); },
  };
  const saved = load(open);
  assert.equal(saved.add({ name: 'Ada', t: 1, s: { 'snake-high': 40 } }), true);
  assert.equal(host(saved.list()).Ada.s['snake-high'], 40);
  saved.setMyName('Ada');
  assert.equal(saved.myName(), 'Ada');
});

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

function memory(seed) {
  const data = Object.assign({}, seed);
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
  };
}

function load(store) {
  const src = readFileSync(join(__dirname, '..', 'js/rivals.js'), 'utf8');
  const sandbox = { localStorage: store, btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent };
  vm.runInContext(src + '\nglobalThis.Rivals = Rivals;', vm.createContext(sandbox), { filename: 'js/rivals.js' });
  return sandbox.Rivals;
}

const host = (value) => JSON.parse(JSON.stringify(value));

test('a share code round-trips, and a partial score is left out', () => {
  const store = memory({ 'snake-high': '100', 'tetris-high': '12px', 'mines-best-beginner': ' 30 ' });
  const Rivals = load(store);
  Rivals.setMyName('A<b>"&name-that-is-too-long');
  const code = Rivals.encode();
  const rival = host(Rivals.decode(code));
  assert.equal(rival.name, 'Abname-that-is');
  assert.equal(rival.s['snake-high'], 100);
  assert.equal(rival.s['mines-best-beginner'], 30);
  assert.equal(rival.s['tetris-high'], undefined);
  const flipped = code.slice(0, -1) + (code.endsWith('0') ? '1' : '0');
  assert.equal(Rivals.decode(flipped), null);
  assert.equal(Rivals.decode('not a code'), null);
});

test('a lower mine time leads, a higher score does not, and a bad list is empty', () => {
  const store = memory({
    'arcade-rivals': JSON.stringify({
      Ada: { t: 1, s: { 'snake-high': 50, 'mines-best-beginner': 20, nope: 9 } },
    }),
    'snake-high': '80',
    'mines-best-beginner': '40',
  });
  const Rivals = load(store);
  assert.equal(Rivals.rivalLeads('snake-high'), false);
  assert.equal(Rivals.rivalLeads('mines-best-beginner'), true);
  assert.equal(Rivals.rivalLeads('tetris-high'), false);
  assert.deepEqual(host(Rivals.bestFor('snake-high')), { name: 'Ada', value: 50 });

  const vale = load(memory({
    'arcade-rivals': JSON.stringify({
      Bea: { t: 1, s: { 'hearthvale-v1': 10 } },
    }),
    'hearthvale-v1': JSON.stringify({ peakPop: 17 }),
  }));
  assert.equal(vale.rivalLeads('hearthvale-v1'), false);
  const behind = load(memory({
    'arcade-rivals': JSON.stringify({
      Bea: { t: 1, s: { 'hearthvale-v1': 40 } },
    }),
    'hearthvale-v1': '{',
  }));
  assert.equal(behind.rivalLeads('hearthvale-v1'), true);

  const broken = load(memory({ 'arcade-rivals': 'null' }));
  assert.deepEqual(host(broken.list()), {});
  const list = load(memory({ 'arcade-rivals': '[]' }));
  assert.deepEqual(host(list.list()), {});
});

test('a rival chip escapes the name', () => {
  const Rivals = load(memory({}));
  const html = Rivals.chipHtml('A<b>', 2);
  assert.match(html, /A&lt;b&gt;/);
  assert.equal(html.includes('<b>'), false);
  assert.match(html, /\(2 games\)/);
});

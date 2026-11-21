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

function load(store, views) {
  const src = readFileSync(join(__dirname, '..', 'js/utils.js'), 'utf8');
  const sandbox = {
    localStorage: store,
    document: {
      getElementById(id) { return views[id] || null; },
    },
  };
  vm.runInContext(src + '\nglobalThis.Utils = Utils;', vm.createContext(sandbox), { filename: 'js/utils.js' });
  return sandbox.Utils;
}

test('date keys pad the month and day, and the clock is 12-hour', () => {
  const Utils = load(memory({}), {});
  assert.equal(Utils.dateKey(new Date(2026, 0, 2)), '2026-01-02');
  assert.equal(Utils.formatTime(new Date(2026, 0, 1, 0, 5)), '12:05 AM');
  assert.equal(Utils.formatTime(new Date(2026, 0, 1, 12, 0)), '12:00 PM');
  assert.equal(Utils.formatTime(new Date(2026, 0, 1, 15, 7)), '3:07 PM');
});

test('a saved high is an integer, and a lower score does not replace it', () => {
  const store = memory({ 'tetris-high': '42', 'breakout-high': '12px', 'blank': '' });
  const Utils = load(store, {});
  assert.equal(Utils.highScore.load('tetris-high'), 42);
  assert.equal(Utils.highScore.load('breakout-high'), 12);
  assert.equal(Utils.highScore.load('blank'), 0);
  assert.equal(Utils.highScore.load('missing'), 0);
  assert.equal(Utils.highScore.save('tetris-high', 40, 42), 42);
  assert.equal(store.getItem('tetris-high'), '42');
  assert.equal(Utils.highScore.save('tetris-high', 50, 42), 50);
  assert.equal(store.getItem('tetris-high'), '50');
});

test('a key handler stays quiet while its view is hidden', () => {
  const views = {
    'view-snake': { classList: { contains(name) { return name === 'active'; } } },
    'view-tetris': { classList: { contains() { return false; } } },
  };
  const Utils = load(memory({}), views);
  let hits = 0;
  const onSnake = Utils.whenViewActive('view-snake', () => { hits += 1; });
  const onTetris = Utils.whenViewActive('view-tetris', () => { hits += 10; });
  onSnake({});
  onTetris({});
  assert.equal(hits, 1);
  assert.equal(Utils.whenViewActive('missing', () => { hits += 100; })({}), undefined);
  assert.equal(hits, 1);
});

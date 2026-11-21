const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const KEYS = ['snake-high', 'tetris-high', 'breakout-high', 'asteroids-high',
  'g2048-best', 'mines-best-beginner', 'connect4-streak', 'word5-streak',
  'cycles-streak', 'pong-streak', 'matrix-best',
  'maze-best', 'stacker-best', 'vector-best', 'cascade-best', 'crate-best'];

function memory(seed) {
  const data = Object.assign({}, seed);
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    key(i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; },
  };
}

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

test('an empty board unlocks nothing', () => {
  const ach = load(memory({}));
  assert.equal(ach.check(), false);
  assert.deepEqual(Object.keys(ach.unlocked()), []);
});

test('a snake score of 100 unlocks, and a later wipe does not lock it again', () => {
  const store = memory({ 'snake-high': '100' });
  const ach = load(store);
  assert.equal(ach.check(), true);
  const have = ach.unlocked();
  assert.ok(have['first-light']);
  assert.ok(have['snake-100']);
  assert.equal(ach.check(), false);
  store.removeItem('snake-high');
  assert.equal(ach.check(), false);
  assert.ok(ach.unlocked()['snake-100']);
});

test('minefield gold is a clear under 60 seconds, and a stored null is an empty case', () => {
  const slow = load(memory({ 'mines-best-beginner': '60' }));
  slow.check();
  assert.equal(slow.unlocked()['mines-60'], undefined);
  assert.ok(slow.unlocked()['first-light']);
  const none = load(memory({ 'mines-best-beginner': '0' }));
  assert.equal(none.check(), false);
  const fast = load(memory({ 'mines-best-beginner': '59' }));
  assert.equal(fast.check(), true);
  assert.ok(fast.unlocked()['mines-60']);

  const broken = load(memory({ 'arcade-achievements': 'null' }));
  assert.deepEqual(Object.keys(broken.unlocked()), []);
  const list = load(memory({ 'arcade-achievements': '[]' }));
  assert.deepEqual(Object.keys(list.unlocked()), []);
});

test('five scored games is a regular, and all sixteen is a completionist', () => {
  const five = {};
  for (let i = 0; i < 5; i++) five[KEYS[i]] = '1';
  const regular = load(memory(five));
  regular.check();
  assert.ok(regular.unlocked().regular);
  assert.equal(regular.unlocked().completionist, undefined);

  const all = {};
  for (const key of KEYS) all[key] = '1';
  const done = load(memory(all));
  done.check();
  assert.ok(done.unlocked().completionist);
});

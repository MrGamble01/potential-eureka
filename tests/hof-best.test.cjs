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
  const src = readFileSync(join(__dirname, '..', 'js/scores.js'), 'utf8');
  const sandbox = { localStorage: store };
  vm.runInContext(src + '\nglobalThis.Scores = Scores;', vm.createContext(sandbox), { filename: 'js/scores.js' });
  return sandbox.Scores;
}

test('flagship bests read the save each game actually writes', () => {
  const Scores = load(memory({
    'aow-best-run': JSON.stringify({ waves: 12, kills: 4 }),
    'startup-tycoon-v7': JSON.stringify({ lifetimeCash: 50000, allTimeCash: 0, cash: 100 }),
    'hearthvale-v1': JSON.stringify({ peakPop: 17, day: 12 }),
    'voxel-garden-v1': JSON.stringify({ state: { totalEarned: 1500, level: 3 } }),
    'ashmarch-chronicle-v1': JSON.stringify({ campaigns: [{ id: 'a' }] }),
    'gutter-best': '38',
    'crate-best': '14',
    'tetris-high': '5000',
  }));
  assert.equal(Scores.flagship('ageofwar'), '12 waves');
  assert.equal(Scores.flagship('tycoon'), '$50k raised');
  assert.equal(Scores.flagship('hearthvale'), '17 villagers at peak');
  assert.equal(Scores.flagship('voxel'), '$1.5k harvested · LV 3');
  assert.equal(Scores.flagship('ashmarch'), '1 road');
  assert.equal(Scores.flagship('gutterlight'), '38 strokes');
  assert.equal(Scores.flagship('crateescape'), '14 puzzles');
  assert.equal(Scores.flagship('tetris'), (5000).toLocaleString() + ' pts');
});

test('an empty board stays empty, and a single wave is singular', () => {
  const Scores = load(memory({}));
  for (const id of ['voxel', 'ashmarch', 'ageofwar', 'tycoon', 'hearthvale', 'gutterlight', 'crateescape', 'tetris']) {
    assert.equal(Scores.flagship(id), null, id);
  }
  const one = load(memory({ 'aow-best-run': JSON.stringify({ waves: 1 }) }));
  assert.equal(one.flagship('ageofwar'), '1 wave');
  const roads = load(memory({
    'ashmarch-chronicle-v1': JSON.stringify({ campaigns: [{}, {}] }),
  }));
  assert.equal(roads.flagship('ashmarch'), '2 roads');
});

test('malformed flagship saves read as not played', () => {
  const Scores = load(memory({
    'aow-achievements': '"not-a-map"',
    'aow-best-run': '{',
    'startup-tycoon-v7': '[]',
    'hearthvale-v1': 'null',
    'voxel-garden-v1': JSON.stringify({ state: 'nope', totalEarned: 'lots' }),
    'ashmarch-chronicle-v1': JSON.stringify({ campaigns: 'two' }),
    'gutter-best': '12px',
    'crate-best': '1e3',
    'tetris-high': '12.5',
  }));
  assert.equal(Scores.flagship('ageofwar'), null);
  assert.equal(Scores.flagship('tycoon'), null);
  assert.equal(Scores.flagship('hearthvale'), null);
  assert.equal(Scores.flagship('voxel'), null);
  assert.equal(Scores.flagship('ashmarch'), null);
  assert.equal(Scores.flagship('gutterlight'), null);
  assert.equal(Scores.flagship('crateescape'), null);
  assert.equal(Scores.flagship('tetris'), null);
  assert.equal(Scores.flagship('snake'), null);
});

test('a double-encoded chronicle and a post-IPO tycoon save still count', () => {
  const chronicle = JSON.stringify({ campaigns: [{ id: 'road' }, { id: 'ferry' }, { id: 'bell' }] });
  const Scores = load(memory({
    'ashmarch-chronicle-v1': JSON.stringify(chronicle),
    'startup-tycoon-v7': JSON.stringify({ allTimeCash: 0, cash: 0, lifetimeCash: 2500 }),
    'voxel-garden-v1': JSON.stringify({ state: JSON.stringify({ totalEarned: 20, level: 2 }) }),
    'hearthvale-v1': JSON.stringify({ state: { peakPop: 9 } }),
    'aow-achievements': JSON.stringify({ win_easy: true, win_hard: false, slayer: 1 }),
  }));
  assert.equal(Scores.flagship('ashmarch'), '3 roads');
  assert.equal(Scores.flagship('tycoon'), '$2.5k raised');
  assert.equal(Scores.flagship('voxel'), '$20 harvested · LV 2');
  assert.equal(Scores.flagship('hearthvale'), '9 villagers at peak');
  assert.equal(Scores.flagship('ageofwar'), '2 achievements');
});

test('a blocked localStorage read does not throw', () => {
  const Scores = load({
    getItem() { throw new Error('denied'); },
  });
  assert.equal(Scores.num('tetris-high'), 0);
  assert.equal(Scores.flagship('tetris'), null);
  assert.equal(Scores.readJSON('hearthvale-v1'), null);
});

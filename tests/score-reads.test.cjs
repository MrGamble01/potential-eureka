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

test('money reads as dollars until one thousand, then as thousands', () => {
  const Scores = load(memory({}));
  assert.equal(Scores.fmtMoney(0), '$0');
  assert.equal(Scores.fmtMoney(12), '$12');
  assert.equal(Scores.fmtMoney(999), '$999');
  assert.equal(Scores.fmtMoney(1000), '$1.0k');
  assert.equal(Scores.fmtMoney(2500), '$2.5k');
  assert.equal(Scores.fmtMoney(10000), '$10k');
  assert.equal(Scores.fmtMoney('1500'), '$1.5k');
  assert.equal(Scores.fmtMoney(NaN), '$0');
  assert.equal(Scores.fmtMoney(null), '$0');
});

test('a score is a whole number of digits or nothing', () => {
  const Scores = load(memory({
    'tetris-high': '5000',
    'gutter-best': ' 12 ',
    'breakout-high': '12px',
    'snake-high': '1e3',
    'maze-best': '12.5',
    'blank': '',
    'huge': '9007199254740993',
  }));
  assert.equal(Scores.num('tetris-high'), 5000);
  assert.equal(Scores.num('gutter-best'), 12);
  assert.equal(Scores.num('missing'), 0);
  assert.equal(Scores.num('breakout-high'), 0);
  assert.equal(Scores.num('snake-high'), 0);
  assert.equal(Scores.num('maze-best'), 0);
  assert.equal(Scores.num('blank'), 0);
  assert.equal(Scores.num('huge'), 0);
});

test('a broken score document reads as nothing', () => {
  const Scores = load(memory({
    'startup-tycoon-v7': '{"cash":40}',
    'aow-achievements': '{',
  }));
  assert.deepEqual(JSON.parse(JSON.stringify(Scores.readJSON('startup-tycoon-v7'))), { cash: 40 });
  assert.equal(Scores.readJSON('aow-achievements'), null);
  assert.equal(Scores.readJSON('missing'), null);
});

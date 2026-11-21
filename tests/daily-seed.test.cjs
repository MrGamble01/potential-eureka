const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const saved = new Map();
const src = readFileSync(join(__dirname, '..', 'js/daily.js'), 'utf8');
const sandbox = {
  Utils: {
    todayKey() { return '2026-11-21'; },
    highScore: {
      load(key) { return Number(saved.get(key) || 0); },
      save(key, score, current) {
        if (score > current) { saved.set(key, String(score)); return score; }
        return current;
      },
    },
  },
  document: { getElementById() { return null; } },
  localStorage: {
    setItem(k, v) { saved.set(k, String(v)); },
    getItem(k) { return saved.has(k) ? saved.get(k) : null; },
  },
};
vm.runInContext(src + '\nglobalThis.Daily = Daily;', vm.createContext(sandbox), { filename: 'js/daily.js' });
const Daily = sandbox.Daily;

test('an armed daily run repeats, and a better score replaces the old one', () => {
  assert.equal(Daily.begin('snake'), false);
  assert.equal(Daily.isActive('snake'), false);
  Daily.arm('snake');
  assert.equal(Daily.begin('snake'), true);
  const first = [Daily.rand('snake'), Daily.rand('snake'), Daily.rand('snake')];
  for (const n of first) assert.ok(n >= 0 && n < 1);
  Daily.disarm('snake');
  Daily.arm('snake');
  Daily.begin('snake');
  assert.deepEqual([Daily.rand('snake'), Daily.rand('snake'), Daily.rand('snake')], first);
  Daily.disarm('snake');
  Daily.arm('tetris');
  Daily.begin('tetris');
  assert.notEqual(Daily.rand('tetris'), first[0]);
  Daily.disarm('tetris');

  Daily.arm('maze');
  assert.equal(Daily.result('maze', 10), '📅 Daily: 10 — new best for today!');
  assert.equal(Daily.result('maze', 4), '📅 Daily: 4 · today\'s best 10');
  Daily.disarm('maze');

  saved.set('arcade-daily-minesweeper-2026-11-21', '40');
  Daily.arm('minesweeper');
  assert.equal(Daily.result('minesweeper', 30, 'min'), '📅 Daily: 30 — new best for today!');
  assert.equal(Daily.result('minesweeper', 35, 'min'), '📅 Daily: 35 · today\'s best 30');
});

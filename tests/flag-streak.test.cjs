const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/flag-daily.js'), 'utf8');
const sandbox = {
  URLSearchParams,
  document: {
    readyState: 'complete',
    getElementById() { return null; },
    addEventListener() {},
  },
  location: { search: '' },
};
vm.runInContext(src, vm.createContext(sandbox), { filename: 'js/flag-daily.js' });
const FlagDaily = sandbox.FlagDaily;

test('the calendar walks back one local day, including the year boundary', () => {
  assert.equal(FlagDaily.todayKey('2026-11-21'), '2026-11-21');
  assert.equal(FlagDaily.todayKey(new Date(2026, 10, 21)), '2026-11-21');
  assert.equal(FlagDaily.prevDate('2026-03-01'), '2026-02-28');
  assert.equal(FlagDaily.prevDate('2024-03-01'), '2024-02-29');
  assert.equal(FlagDaily.prevDate('2026-01-01'), '2025-12-31');
});

test('a missed day ends the streak, and an unmet today is zero', () => {
  const days = {
    '2026-11-21': { met: true },
    '2026-11-20': { met: true },
    '2026-11-19': { met: false },
    '2026-11-18': { met: true },
  };
  assert.equal(FlagDaily.computeStreak(days, '2026-11-21'), 2);
  assert.equal(FlagDaily.computeStreak(days, '2026-11-18'), 1);
  assert.equal(FlagDaily.liveStreak(days, '2026-11-22'), 2);
  assert.equal(FlagDaily.liveStreak(days, '2026-11-19'), 0);
  assert.equal(FlagDaily.liveStreak({}, '2026-11-21'), 0);
});

test('one date deals the same board twice', () => {
  const a = FlagDaily.challengeFor('2026-11-21');
  const b = FlagDaily.challengeFor('2026-11-21');
  assert.deepEqual(a, b);
  assert.equal(a.tiles.length, 180);
  assert.ok(a.seconds === 36 || a.seconds === 42 || a.seconds === 48);
  assert.equal((a.goal - 450) % 50, 0);
  assert.ok(a.goal >= 450 && a.goal <= 800);
  assert.ok(a.game.id === 'tycoon' || a.game.id === 'hearthvale');
  assert.notEqual(FlagDaily.challengeFor('2026-11-22').seed, a.seed);
});

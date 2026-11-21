const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

function load(saved, setItem) {
  const src = readFileSync(join(__dirname, '..', 'js/daily.js'), 'utf8');
  const sandbox = {
    Utils: {
      todayKey() { return '2026-11-21'; },
      highScore: {
        load(key) { return Number(saved.get(key) || 0); },
        save(key, score, current) {
          if (score > current) {
            setItem(key, String(score));
            saved.set(key, String(score));
            return score;
          }
          return current;
        },
      },
    },
    document: { getElementById() { return null; } },
    localStorage: {
      setItem,
      getItem(k) { return saved.has(k) ? saved.get(k) : null; },
    },
  };
  vm.runInContext(src + '\nglobalThis.Daily = Daily;', vm.createContext(sandbox), { filename: 'js/daily.js' });
  return sandbox.Daily;
}

test('a daily result survives a full disk, and a bad time is not a record', () => {
  const saved = new Map([['arcade-daily-minesweeper-2026-11-21', '40']]);
  let writes = 0;
  const Daily = load(saved, () => { writes += 1; throw new Error('QuotaExceededError'); });

  assert.equal(Daily.result('minesweeper', 30, 'min'), '📅 Daily: 30 — new best for today!');
  assert.equal(saved.get('arcade-daily-minesweeper-2026-11-21'), '40');
  assert.equal(writes, 1);

  assert.equal(Daily.result('minesweeper', NaN, 'min'), '📅 Daily: —');
  assert.equal(Daily.result('minesweeper', -5, 'min'), '📅 Daily: —');
  assert.equal(writes, 1);
  assert.equal(saved.get('arcade-daily-minesweeper-2026-11-21'), '40');

  assert.equal(Daily.result('maze', 10), '📅 Daily: 10 — new best for today!');
  assert.equal(saved.has('arcade-daily-maze-2026-11-21'), false);
});

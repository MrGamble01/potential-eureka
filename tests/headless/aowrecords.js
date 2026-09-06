/* Validate the production record writer without exposing game internals. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../ageofwar/ageofwar.js'), 'utf8');
const start = source.indexOf('  function recordBestRun()');
const end = source.indexOf('\n  function showOverlay', start);
assert.ok(start >= 0 && end > start, 'production writer found');
const writer = source.slice(start, end);
let passed = 0;
function record(raw, waveNum = 9, storageFails = false) {
  let stored = raw, writes = 0;
  const context = vm.createContext({
    waveNum, runStats: { kills: 40, time: 90.6, warlordsSlain: 2 },
    strongholdsRazed: 1, difficulty: 'normal', lastRunSummary: null,
    localStorage: {
      getItem() { if (storageFails) throw Error('unavailable'); return stored; },
      setItem(key, value) { assert.equal(key, 'aow-best-run'); if (storageFails) throw Error('full'); writes++; stored = value; }
    }
  });
  vm.runInContext(writer + '\nrecordBestRun();', context);
  return { stored, writes, summary: JSON.parse(JSON.stringify(context.lastRunSummary)) };
}
const expected = { waves: 8, kills: 40, time: 91, strongholds: 1, difficulty: 'normal', warlords: 2 };
for (const raw of [null, '{broken', 'null', '{}', '[]', 'true', '5', '"old"',
  '{"wave":12}', '{"waves":"corrupt"}', '{"waves":"12"}', '{"waves":null}',
  '{"waves":{}}', '{"waves":-1}', '{"waves":1.5}', '{"waves":1e999}',
  '{"waves":9007199254740992}']) {
  const result = record(raw);
  assert.deepEqual(JSON.parse(result.stored), expected, `recover ${raw}`);
  assert.equal(result.summary.isBest, true);
  assert.equal(result.summary.prev, null);
  passed++;
}
for (const waves of [8, 10, Number.MAX_SAFE_INTEGER]) {
  const previous = JSON.stringify({ waves, kills: 55, difficulty: 'hard' });
  const result = record(previous);
  assert.equal(result.stored, previous, 'valid equal/higher best is retained byte-for-byte');
  assert.equal(result.writes, 0);
  assert.equal(result.summary.isBest, false);
  passed++;
}
const improved = record('{"waves":7}');
assert.deepEqual(JSON.parse(improved.stored), expected);
assert.equal(improved.summary.prev.waves, 7);
passed++;
const firstWave = record('null', 1);
assert.equal(JSON.parse(firstWave.stored).waves, 0, 'only completed waves count');
assert.equal(record('{"waves":0}', 1).writes, 0, 'a valid zero best is preserved');
passed++;
const failedStorage = record(null, 9, true);
assert.deepEqual(failedStorage.summary.run, expected, 'end-of-run summary survives storage failure');
passed++;
console.log(`PASS ${passed} record recovery/preservation cases`);

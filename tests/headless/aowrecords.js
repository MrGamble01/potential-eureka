/* AOW record recovery — a malformed aow-best-run must not freeze future bests.
 *
 * Main ranked with `waves > (prev.waves || 0)`. A stored
 * {"waves":"corrupt"} makes every later comparison false (the string
 * coerces to NaN), so no completed run can become the best. Infinity
 * and numbers past MAX_SAFE_INTEGER freeze the same way.
 *
 * This suite drives the production recordBestRun() through vm — no
 * window.__ hook — and is non-vacuous in both directions: the old
 * comparison writes nothing for the freeze payloads, and this writer
 * replaces them. Reverting the guard in ageofwar.js fails the recover
 * cases by name.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let pass = 0, fail = 0;
const ok = (cond, name) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

const source = fs.readFileSync(path.join(__dirname, '../../ageofwar/ageofwar.js'), 'utf8');
const start = source.indexOf('  function recordBestRun()');
const end = source.indexOf('\n  function showOverlay', start);
ok(start >= 0 && end > start, 'production writer found between recordBestRun and showOverlay');
const writer = start >= 0 && end > start ? source.slice(start, end) : '';
ok(writer.includes('Number.isSafeInteger') && writer.includes('prev.waves'),
  'writer ranks only a nonnegative safe-integer waves field');
ok(!/waves\s*>\s*\(\s*prev\.waves\s*\|\|\s*0\s*\)/.test(writer),
  'writer no longer uses the waves > (prev.waves || 0) freeze comparison');

function runWriter(body, raw, waveNum = 9, storageFails = false) {
  let stored = raw, writes = 0;
  const context = vm.createContext({
    waveNum, runStats: { kills: 40, time: 90.6, warlordsSlain: 2 },
    strongholdsRazed: 1, difficulty: 'normal', lastRunSummary: null,
    localStorage: {
      getItem() { if (storageFails) throw Error('unavailable'); return stored; },
      setItem(key, value) {
        assert.equal(key, 'aow-best-run');
        if (storageFails) throw Error('full');
        writes++;
        stored = value;
      }
    }
  });
  vm.runInContext(body + '\nrecordBestRun();', context);
  return { stored, writes, summary: JSON.parse(JSON.stringify(context.lastRunSummary)) };
}
const record = (raw, waveNum, storageFails) => runWriter(writer, raw, waveNum, storageFails);

// The comparison main still ships. A truthy non-numeric waves value
// (or +Infinity / a number past MAX_SAFE_INTEGER) makes `waves > …` false.
const OLD_WRITER = `
  function recordBestRun() {
    const waves = Math.max(0, waveNum - 1);
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem('aow-best-run') || 'null'); } catch {}
    const isBest = !prev || waves > (prev.waves || 0);
    const run = { waves, kills: runStats.kills, time: Math.round(runStats.time),
                  strongholds: strongholdsRazed, difficulty,
                  warlords: runStats.warlordsSlain || 0 };
    if (isBest) { try { localStorage.setItem('aow-best-run', JSON.stringify(run)); } catch {} }
    lastRunSummary = { run, prev, isBest };
  }
`;
const FREEZE = [
  '{"waves":"corrupt"}',
  '{"waves":"12"}',
  '{"waves":1e999}',
  '{"waves":9007199254740992}',
];
for (const raw of FREEZE) {
  const old = runWriter(OLD_WRITER, raw);
  ok(old.writes === 0 && old.summary && old.summary.isBest === false,
    `old comparison freezes on ${raw}`);
}

const expected = { waves: 8, kills: 40, time: 91, strongholds: 1, difficulty: 'normal', warlords: 2 };
const MALFORMED = [null, '{broken', 'null', '{}', '[]', 'true', '5', '"old"',
  '{"wave":12}', '{"waves":"corrupt"}', '{"waves":"12"}', '{"waves":null}',
  '{"waves":{}}', '{"waves":-1}', '{"waves":1.5}', '{"waves":1e999}',
  '{"waves":9007199254740992}'];
for (const raw of MALFORMED) {
  const result = record(raw);
  let stored = null;
  try { stored = JSON.parse(result.stored); } catch {}
  ok(result.writes === 1 && result.summary && result.summary.isBest === true
      && result.summary.prev === null && JSON.stringify(stored) === JSON.stringify(expected),
    `recover ${raw === null ? 'null' : raw}`);
}

for (const waves of [8, 10, Number.MAX_SAFE_INTEGER]) {
  const previous = JSON.stringify({ waves, kills: 55, difficulty: 'hard' });
  const result = record(previous);
  ok(result.stored === previous && result.writes === 0 && result.summary.isBest === false,
    `valid best of ${waves} waves is retained byte-for-byte`);
}

const improved = record('{"waves":7}');
ok(JSON.stringify(JSON.parse(improved.stored)) === JSON.stringify(expected)
    && improved.summary.isBest === true && improved.summary.prev
    && improved.summary.prev.waves === 7,
  'a strictly lower valid record is replaced and the previous waves are kept on the summary');

const firstWave = record('null', 1);
ok(JSON.parse(firstWave.stored).waves === 0, 'dying on wave 1 records 0 survived');
ok(record('{"waves":0}', 1).writes === 0, 'a valid zero best is preserved');

const failedStorage = record(null, 9, true);
ok(failedStorage.writes === 0
    && JSON.stringify(failedStorage.summary.run) === JSON.stringify(expected)
    && failedStorage.summary.isBest === true,
  'end-of-run summary survives a storage throw');

ok(pass >= 28, 'suite is populated with freeze, recover, and preserve cases');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);

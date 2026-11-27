const assert = require('node:assert/strict');
const test = require('node:test');
const HofBackup = require('../js/hof-backup.js');

function memoryStorage(initial) {
  const map = new Map();
  const seed = initial || {};
  for (const key of Object.keys(seed)) map.set(key, seed[key]);
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    snapshot() { return Object.fromEntries(map); },
  };
}

const FLAGSHIP = {
  'voxel-garden-v1': JSON.stringify({ state: { totalEarned: 1200, level: 3 } }),
  'aow-best-run': JSON.stringify({ waves: 12 }),
  'startup-tycoon-v7': JSON.stringify({ lifetimeCash: 250000, cash: 40 }),
  'hearthvale-v1': JSON.stringify({ peakPop: 40 }),
  'ashmarch-chronicle-v1': JSON.stringify({ campaigns: [{ id: 'a' }, { id: 'b' }] }),
  'gutter-best': '18',
  'crate-best': '8',
  'tetris-high': '5000',
};

function purse(extra) {
  return JSON.stringify(Object.assign({
    balance: 80,
    paid: { 'first-light': true },
    owned: { indigo: true, gold: true },
    equipped: 'gold',
  }, extra || {}));
}

function rivals() {
  return JSON.stringify({
    Nim: { t: 1700000000000, s: { 'tetris-high': 4000, 'gutter-best': 20 } },
  });
}

function seeded() {
  return memoryStorage(Object.assign({}, FLAGSHIP, {
    'arcade-coins': purse(),
    'arcade-rivals': rivals(),
    'rival-name': 'PLAYER 1',
    'eureka-notes': 'keep this note',
    'studio-token': 'secret',
  }));
}

test('the allowlist names all eight flagship saves', () => {
  assert.deepEqual(HofBackup.FLAGSHIP_KEYS, Object.keys(FLAGSHIP));
  for (const key of HofBackup.FLAGSHIP_KEYS) assert.ok(HofBackup.KEYS.includes(key));
});

test('a backup round-trips flagship saves, coins, the equipped accent, and rivals', () => {
  const storage = seeded();
  const when = '2026-11-27T12:00:00.000Z';
  const payload = HofBackup.exportPayload(storage, when);
  assert.equal(payload.v, 1);
  assert.equal(payload.when, when);
  for (const key of Object.keys(FLAGSHIP)) assert.equal(payload.data[key], FLAGSHIP[key]);
  assert.equal(JSON.parse(payload.data['arcade-coins']).equipped, 'gold');
  assert.equal(JSON.parse(payload.data['arcade-coins']).balance, 80);
  assert.equal(payload.data['arcade-rivals'], rivals());
  assert.equal(payload.data['rival-name'], 'PLAYER 1');
  assert.equal(payload.data['eureka-notes'], undefined);
  assert.equal(payload.data['studio-token'], undefined);

  const fresh = memoryStorage({ 'eureka-notes': 'keep this note', 'studio-token': 'secret' });
  const result = HofBackup.restore(fresh, JSON.stringify(payload));
  assert.equal(result.ok, true);
  assert.match(result.message, /Restored \d+ saved entries/);
  assert.match(result.message, /board, coins, accent, and rivals/);
  for (const key of Object.keys(FLAGSHIP)) assert.equal(fresh.getItem(key), FLAGSHIP[key]);
  assert.equal(JSON.parse(fresh.getItem('arcade-coins')).equipped, 'gold');
  assert.equal(fresh.getItem('arcade-rivals'), rivals());
  assert.equal(fresh.getItem('eureka-notes'), 'keep this note');
  assert.equal(fresh.getItem('studio-token'), 'secret');
});

test('malformed, empty, and unexpected JSON do not change localStorage', () => {
  const cases = [
    ['', /empty/i],
    ['   ', /empty/i],
    ['{', /not valid JSON/i],
    ['null', /not a Eureka backup/i],
    ['[]', /not a Eureka backup/i],
    ['{"totally":"unrelated"}', /not a Eureka backup/i],
    ['{"v":1}', /not a Eureka backup/i],
    ['{"v":1,"data":{}}', /empty/i],
    ['{"v":2,"data":{"tetris-high":"9"}}', /version is not supported/i],
    ['{"v":1,"data":{"tetris-high":9}}', /will not restore/i],
    ['{"v":1,"data":{"tetris-high":"9","studio-token":"x"}}', /will not restore/i],
    ['{"v":1,"data":{"__proto__":"x"}}', /will not restore/i],
  ];
  for (const [text, pattern] of cases) {
    const storage = seeded();
    const before = storage.snapshot();
    const result = HofBackup.restore(storage, text);
    assert.equal(result.ok, false, text);
    assert.match(result.error, pattern, text);
    assert.match(result.error, /left as it was/);
    assert.deepEqual(storage.snapshot(), before, text);
  }
});

test('an allowlisted restore still leaves keys that were not in the file', () => {
  const storage = seeded();
  const result = HofBackup.restore(storage, {
    v: 1,
    when: '2026-11-27T12:00:00.000Z',
    data: { 'tetris-high': '9000', 'arcade-coins': purse({ equipped: 'rose', balance: 15 }) },
  });
  assert.equal(result.ok, true);
  assert.equal(storage.getItem('tetris-high'), '9000');
  assert.equal(JSON.parse(storage.getItem('arcade-coins')).equipped, 'rose');
  assert.equal(storage.getItem('voxel-garden-v1'), FLAGSHIP['voxel-garden-v1']);
  assert.equal(storage.getItem('arcade-rivals'), rivals());
  assert.equal(storage.getItem('eureka-notes'), 'keep this note');
});

test('a failed write rolls back and does not keep a partial restore', () => {
  const storage = seeded();
  const before = storage.snapshot();
  const realSet = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === 'tetris-high' && value === '42') throw new Error('quota');
    realSet(key, value);
  };
  const result = HofBackup.restore(storage, {
    v: 1,
    data: { 'gutter-best': '99', 'tetris-high': '42' },
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /could not be saved/);
  assert.deepEqual(storage.snapshot(), before);
});

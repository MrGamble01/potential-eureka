const assert = require('node:assert/strict');
const test = require('node:test');
const Persist = require('../js/persist.js');

function memoryStorage(initial) {
  const map = new Map();
  const seed = initial || {};
  for (const key of Object.keys(seed)) map.set(key, seed[key]);
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

test('an empty browser keeps the default sound document and does not write it', () => {
  const storage = memoryStorage();
  const persist = Persist.create(storage);
  assert.deepEqual(persist.settings.get(), {
    v: 1, muted: false, sfx: 1, music: 1, musicOn: true, touched: false,
  });
  assert.equal(storage.getItem('eureka-settings'), null);
  assert.equal(persist.audio.sfx(true), 0);
  assert.equal(persist.audio.sfx(false), 1);
  assert.deepEqual(persist.audio.apply(true, false), { muted: true, musicOff: false });
});

test('corrupt settings stay on disk and still boot', () => {
  const storage = memoryStorage({ 'eureka-settings': '{not json' });
  const persist = Persist.create(storage);
  assert.equal(persist.settings.get().muted, false);
  assert.equal(persist.settings.get().touched, false);
  assert.equal(storage.getItem('eureka-settings'), '{not json');
  assert.equal(persist.progress.has('hearthvale'), false);
});

test('a legacy arcade mute becomes one shared document', () => {
  const storage = memoryStorage({ 'arcade-muted': '1' });
  const persist = Persist.create(storage);
  const settings = persist.settings.get();
  assert.equal(settings.muted, true);
  assert.equal(settings.touched, true);
  const stored = JSON.parse(storage.getItem('eureka-settings'));
  assert.equal(stored.muted, true);
  assert.equal(stored.v, 1);
  assert.equal(persist.audio.sfx(false), 0);
  assert.deepEqual(persist.audio.apply(false, false), { muted: true, musicOff: true });
});

test('a music volume of zero turns music off and remembers a volume', () => {
  const storage = memoryStorage({
    'eureka-settings': JSON.stringify({ music: 0 }),
  });
  const persist = Persist.create(storage);
  const settings = persist.settings.get();
  assert.equal(settings.musicOn, false);
  assert.equal(settings.music, 1);
  assert.equal(settings.touched, true);
  assert.equal(persist.audio.music(false, false), 0);
});

test('a newer settings document keeps its version and extra fields', () => {
  const storage = memoryStorage({
    'eureka-settings': JSON.stringify({
      v: 4, muted: false, sfx: 0.5, music: 0.25, musicOn: true, touched: true, future: 'keep',
    }),
  });
  const persist = Persist.create(storage);
  assert.equal(persist.settings.get().sfx, 0.5);
  assert.equal(JSON.parse(storage.getItem('eureka-settings')).future, 'keep');
  persist.settings.update({ sfx: 2 });
  persist.settings.update({ musicOn: false });
  const stored = JSON.parse(storage.getItem('eureka-settings'));
  assert.equal(stored.v, 4);
  assert.equal(stored.future, 'keep');
  assert.equal(stored.sfx, 1);
  assert.equal(stored.musicOn, false);
  assert.equal(stored.music, 0.25);
});

test('progress notes a game, drops a bad id, and can be cleared', () => {
  const storage = memoryStorage({
    'eureka-progress': JSON.stringify({
      v: 1,
      games: {
        'Bad Id': { savedAt: 1, summary: { day: 9 } },
        hearthvale: { savedAt: 1, summary: { day: 2 }, relic: 'oak' },
      },
    }),
  });
  const persist = Persist.create(storage);
  assert.equal(persist.progress.has('Bad Id'), false);
  assert.equal(persist.progress.note('not a game', { day: 1 }), false);
  assert.equal(persist.progress.note('hearthvale', {
    day: 4,
    '<bad>': 1,
    note: 'x'.repeat(100),
  }), true);
  const got = persist.progress.get('hearthvale');
  assert.equal(got.summary.day, 4);
  assert.equal(got.summary['<bad>'], undefined);
  assert.equal(got.summary.note.length, 80);
  const raw = JSON.parse(storage.getItem('eureka-progress'));
  assert.equal(raw.games.hearthvale.relic, 'oak');
  assert.equal(raw.games['Bad Id'], undefined);
  assert.equal(persist.progress.clear('hearthvale'), true);
  assert.equal(persist.progress.has('hearthvale'), false);
});

test('a career name drops control characters and keeps the purse', () => {
  const storage = memoryStorage();
  const persist = Persist.create(storage);
  const saved = persist.progress.saveCareer({
    name: ' Ada\nLovelace ',
    sparks: 12.9,
    xp: -4,
    equipped: { lamp: 'hearth-shade', no: 'x' },
  });
  assert.equal(saved.name, 'AdaLovelace');
  assert.equal(saved.sparks, 12);
  assert.equal(saved.xp, 0);
  assert.equal(saved.equipped.lamp, 'hearth-shade');
  assert.equal(saved.equipped.no, undefined);
  const again = Persist.create(storage).progress.career();
  assert.equal(again.name, 'AdaLovelace');
  assert.equal(again.sparks, 12);
});

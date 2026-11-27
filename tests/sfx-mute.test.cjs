const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

function memory(seed) {
  const data = Object.assign({}, seed);
  return {
    data,
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
  };
}

function load(muted) {
  const store = memory(muted ? { 'arcade-muted': '1' } : {});
  return loadWith(store, null);
}

function loadWith(store, persist, extra) {
  const src = readFileSync(join(__dirname, '..', 'js/sfx.js'), 'utf8');
  const sandbox = {
    localStorage: store,
    window: {},
  };
  if (persist) sandbox.EurekaPersist = persist;
  if (extra && extra.AudioContext) {
    sandbox.window.AudioContext = extra.AudioContext;
    sandbox.window.webkitAudioContext = extra.AudioContext;
  }
  vm.runInContext(src + '\nglobalThis.SFX = SFX;', vm.createContext(sandbox), { filename: 'js/sfx.js' });
  return { sfx: sandbox.SFX, data: store.data };
}

test('a shared mute wins, and the legacy flag follows it', () => {
  const updates = [];
  const { sfx, data } = loadWith(memory({ 'arcade-muted': '0' }), {
    settings: {
      get() { return { muted: true, touched: true, sfx: 1, music: 1, musicOn: true }; },
      update(patch) { updates.push(patch); },
    },
    audio: { sfx() { return 0; } },
  });
  assert.equal(sfx.isMuted(), true);
  assert.equal(data['arcade-muted'], '1');
  assert.equal(sfx.toggle(), false);
  assert.equal(data['arcade-muted'], '0');
  assert.equal(updates.at(-1).muted, false);
  assert.equal(updates.at(-1).touched, true);
});

test('resuming a suspended context cannot reject out of the player', async () => {
  let unhandled = null;
  const onReject = (err) => { unhandled = err; };
  process.on('unhandledRejection', onReject);
  const { sfx } = loadWith(memory({}), null, {
    AudioContext: function AudioContext() {
      return {
        state: 'suspended',
        currentTime: 0,
        destination: {},
        resume() { return Promise.reject(new Error('AudioContext')); },
        createOscillator() {
          return {
            type: 'square',
            frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect() { return this; },
            start() {},
            stop() {},
          };
        },
        createGain() {
          return {
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect() { return { connect() {} }; },
          };
        },
      };
    },
  });
  assert.equal(sfx.isMuted(), false);
  assert.doesNotThrow(() => sfx.play('start'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  process.off('unhandledRejection', onReject);
  assert.equal(unhandled, null);
});

test('mute silences the mix, and the choice is remembered', () => {
  const quiet = load(true);
  assert.equal(quiet.sfx.isMuted(), true);
  assert.equal(quiet.sfx.scaleFor(true), 0);
  assert.equal(quiet.sfx.toggle(), false);
  assert.equal(quiet.data['arcade-muted'], '0');

  const loud = load(false);
  assert.equal(loud.sfx.scaleFor(false), 1);
  assert.equal(loud.sfx.isMuted(), false);
  loud.sfx.setMuted(true);
  assert.equal(loud.sfx.isMuted(), true);
  assert.equal(loud.data['arcade-muted'], '1');
});

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

function node() {
  return {
    gain: { value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    detune: { setValueAtTime() {} },
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect() { return this; },
    start() {},
    stop() {},
  };
}

test('the music bed resumes after an iPhone interruption', () => {
  let ctx;
  class AC {
    constructor() {
      ctx = this;
      this.state = 'interrupted';
      this.currentTime = 0;
      this.destination = {};
      this.resumes = 0;
    }
    resume() {
      this.resumes += 1;
      return Promise.resolve();
    }
    createGain() { return node(); }
    createDynamicsCompressor() { return node(); }
    createBiquadFilter() { return node(); }
    createOscillator() { return node(); }
  }
  const src = readFileSync(join(__dirname, '..', 'js/audio.js'), 'utf8');
  const sandbox = { module: { exports: {} } };
  vm.runInContext(src, vm.createContext(sandbox), { filename: 'js/audio.js' });
  const api = sandbox.module.exports;
  const audio = api.create({
    AudioContext: AC,
    addEventListener() {},
    removeEventListener() {},
    setInterval() { return 1; },
    clearInterval() {},
  });

  assert.equal(api.needsResume('interrupted'), true);
  assert.equal(api.needsResume('suspended'), true);
  assert.equal(api.needsResume('running'), false);
  assert.equal(api.needsResume('closed'), false);

  assert.equal(audio.unlock(), true);
  assert.equal(ctx.resumes, 1);
  ctx.state = 'running';
  audio.unlock();
  assert.equal(ctx.resumes, 1);

  audio.start();
  ctx.state = 'interrupted';
  audio.pump();
  assert.equal(ctx.resumes, 2);
  ctx.state = 'running';
  audio.pump();
  assert.equal(ctx.resumes, 2);
  ctx.state = 'closed';
  audio.pump();
  assert.equal(ctx.resumes, 2);
});

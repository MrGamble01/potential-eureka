const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

test('arcade sound resumes after an iPhone interruption', () => {
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
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator() {
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(dest) { return dest; },
        start() {},
        stop() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(dest) { return dest; },
      };
    }
  }
  const src = readFileSync(join(__dirname, '..', 'js/sfx.js'), 'utf8');
  const sandbox = {
    localStorage: { getItem() { return null; }, setItem() {} },
    window: { AudioContext: AC },
  };
  vm.runInContext(src + '\nglobalThis.SFX = SFX;', vm.createContext(sandbox), { filename: 'js/sfx.js' });
  const sfx = sandbox.SFX;

  assert.equal(sfx.needsResume('interrupted'), true);
  assert.equal(sfx.needsResume('suspended'), true);
  assert.equal(sfx.needsResume('running'), false);
  assert.equal(sfx.needsResume('closed'), false);

  sfx.play('move');
  assert.equal(ctx.resumes, 1);
  ctx.state = 'running';
  sfx.play('move');
  assert.equal(ctx.resumes, 1);
  ctx.state = 'suspended';
  sfx.play('rotate');
  assert.equal(ctx.resumes, 2);
  ctx.state = 'closed';
  sfx.play('move');
  assert.equal(ctx.resumes, 2);
});

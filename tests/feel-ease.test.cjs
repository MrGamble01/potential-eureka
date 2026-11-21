const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

let reduce = false;
const store = {};
const sandbox = {
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
  },
  document: {
    documentElement: { dataset: {} },
    addEventListener() {},
    dispatchEvent() {},
  },
  matchMedia() { return { matches: reduce, addEventListener() {} }; },
};
const src = readFileSync(join(__dirname, '..', 'js/feel.js'), 'utf8');
vm.runInContext(src, vm.createContext(sandbox), { filename: 'js/feel.js' });
const feel = sandbox.EurekaFeel;

test('the easings start at 0, end at 1, and ease out faster than linear', () => {
  assert.equal(feel.EASE.linear(0.4), 0.4);
  assert.equal(feel.EASE.outCubic(0), 0);
  assert.equal(feel.EASE.outCubic(1), 1);
  assert.ok(feel.EASE.outCubic(0.5) > 0.5);
  assert.equal(feel.EASE.inOutQuad(0), 0);
  assert.equal(feel.EASE.inOutQuad(1), 1);
  assert.equal(feel.EASE.inOutQuad(0.5), 0.5);
  assert.ok(Math.abs(feel.EASE.outBack(0)) < 1e-12);
  assert.equal(feel.EASE.outBack(1), 1);
});

test('motion cycles, and auto follows the operating system', () => {
  assert.equal(feel.motion(), 'auto');
  assert.equal(feel.reduced(), false);
  assert.equal(feel.cycleMotion(), 'full');
  reduce = true;
  assert.equal(feel.reduced(), false);
  assert.equal(feel.cycleMotion(), 'reduced');
  assert.equal(feel.reduced(), true);
  assert.equal(feel.motionLabel(), 'Motion: Reduced');
  assert.equal(feel.cycleMotion(), 'auto');
  assert.equal(feel.reduced(), true);
  assert.equal(feel.setMotion('nope'), 'auto');
  assert.equal(feel.cycleHaptics(), false);
  assert.equal(feel.hapticsLabel(), 'Haptics: Off');
});

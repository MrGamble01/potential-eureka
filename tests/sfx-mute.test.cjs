const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

function load(muted) {
  const data = {};
  if (muted) data['arcade-muted'] = '1';
  const src = readFileSync(join(__dirname, '..', 'js/sfx.js'), 'utf8');
  const sandbox = {
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem(k, v) { data[k] = String(v); },
    },
  };
  vm.runInContext(src + '\nglobalThis.SFX = SFX;', vm.createContext(sandbox), { filename: 'js/sfx.js' });
  return { sfx: sandbox.SFX, data };
}

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

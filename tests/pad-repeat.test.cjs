const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/gamepad.js'), 'utf8');
const sandbox = { requestAnimationFrame() { return 1; } };
vm.runInContext(src + '\nglobalThis.GamepadInput = GamepadInput;', vm.createContext(sandbox), { filename: 'js/gamepad.js' });
const rules = sandbox.GamepadInput.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('face buttons and the stick become the same keys the keyboard uses', () => {
  const buttons = [];
  buttons[0] = { pressed: true };
  buttons[12] = { pressed: true };
  assert.deepEqual(host(rules.wantedKeys(buttons, [0, 0])), [' ', 'ArrowUp']);
  assert.deepEqual(host(rules.wantedKeys([], [0.5, 0])), ['ArrowRight']);
  assert.deepEqual(host(rules.wantedKeys([], [-0.49, 0.5])), ['ArrowDown']);
  assert.deepEqual(host(rules.wantedKeys([], [0, 0])), []);
});

test('a held direction repeats after the delay, then every 90ms', () => {
  assert.equal(rules.shouldRepeat(0, 0, rules.repeatDelay - 1), false);
  assert.equal(rules.shouldRepeat(0, 0, rules.repeatDelay), true);
  assert.equal(rules.shouldRepeat(0, 200, 280), false);
  assert.equal(rules.shouldRepeat(0, 200, 200 + rules.repeatEvery), true);
});

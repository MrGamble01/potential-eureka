const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const els = {};
function el() {
  return { textContent: '', className: '', style: {} };
}
for (const id of ['pomo-time', 'pomo-mode', 'pomo-sessions', 'pomo-toggle', 'pomo-progress']) els[id] = el();

const src = readFileSync(join(__dirname, '..', 'js/pomodoro.js'), 'utf8');
const sandbox = {
  Utils: { store: { getRaw() { return '0'; }, setRaw() {} } },
  document: {
    getElementById(id) { return els[id] || null; },
    addEventListener() {},
    visibilityState: 'hidden',
  },
  setInterval() { return 1; },
  clearInterval() {},
  setTimeout() {},
};
vm.runInContext(src + '\nglobalThis.Pomodoro = Pomodoro;', vm.createContext(sandbox), { filename: 'js/pomodoro.js' });
const rules = sandbox.Pomodoro.rules;

test('the clock counts the wall, and a pause keeps what is left', () => {
  assert.equal(rules.secondsLeft(null, 10_000, 40), 40);
  assert.equal(rules.secondsLeft(5_500, 1_000, 40), 5);
  assert.equal(rules.secondsLeft(1_000, 5_000, 40), 0);
  assert.equal(rules.modes.focus.duration, 25 * 60);
  assert.equal(rules.modes.short.duration, 5 * 60);
  assert.equal(rules.modes.long.duration, 15 * 60);
});

test('every fourth finished focus is the long break', () => {
  const host = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(host(rules.nextMode('focus', 0)), { mode: 'short', sessions: 1 });
  assert.deepEqual(host(rules.nextMode('short', 1)), { mode: 'focus', sessions: 1 });
  assert.deepEqual(host(rules.nextMode('focus', 3)), { mode: 'long', sessions: 4 });
  assert.deepEqual(host(rules.nextMode('long', 4)), { mode: 'focus', sessions: 4 });

  const labels = [];
  for (let i = 0; i < 8; i++) {
    sandbox.Pomodoro.skip();
    labels.push(els['pomo-mode'].textContent + ' ' + els['pomo-time'].textContent);
  }
  assert.deepEqual(labels, [
    'SHORT BREAK 05:00',
    'FOCUS 25:00',
    'SHORT BREAK 05:00',
    'FOCUS 25:00',
    'SHORT BREAK 05:00',
    'FOCUS 25:00',
    'LONG BREAK 15:00',
    'FOCUS 25:00',
  ]);
});

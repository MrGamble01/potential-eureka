const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/pomodoro.js'), 'utf8');
const sandbox = {
  Utils: { store: { getRaw() { throw new Error('blocked'); }, setRaw() {} } },
  document: { getElementById() { return null; }, addEventListener() {}, visibilityState: 'hidden' },
  setInterval() { return 1; },
  clearInterval() {},
  setTimeout() {},
};
vm.runInContext(src + '\nglobalThis.Pomodoro = Pomodoro;', vm.createContext(sandbox), { filename: 'js/pomodoro.js' });
const rules = sandbox.Pomodoro.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('a stored session count is a whole number, or zero', () => {
  assert.equal(rules.readSessions('4'), 4);
  assert.equal(rules.readSessions('  12 '), 12);
  assert.equal(rules.readSessions('0003'), 3);
  assert.equal(rules.readSessions('12px'), 0);
  assert.equal(rules.readSessions('nope'), 0);
  assert.equal(rules.readSessions('-2'), 0);
  assert.equal(rules.readSessions(''), 0);
  assert.equal(rules.readSessions(null), 0);
});

test('a junk count still starts the first focus, it does not become NaN', () => {
  assert.deepEqual(host(rules.nextMode('focus', NaN)), { mode: 'short', sessions: 1 });
  assert.deepEqual(host(rules.nextMode('focus', -3)), { mode: 'short', sessions: 1 });
  assert.deepEqual(host(rules.nextMode('short', NaN)), { mode: 'focus', sessions: 0 });
  assert.deepEqual(host(rules.nextMode('focus', 3)), { mode: 'long', sessions: 4 });
});

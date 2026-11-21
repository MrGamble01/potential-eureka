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

test('the session chime reuses one context and resumes an interruption', () => {
  let built = 0;
  function AC() {
    built += 1;
    this.state = 'interrupted';
    this.resumes = 0;
  }
  AC.prototype.resume = function () {
    this.resumes += 1;
    this.state = 'running';
    return Promise.resolve();
  };

  assert.equal(rules.beepContext(null), null);
  const first = rules.beepContext(AC);
  assert.equal(built, 1);
  assert.equal(first.resumes, 1);
  assert.equal(first.state, 'running');
  const again = rules.beepContext(AC);
  assert.equal(again, first);
  assert.equal(built, 1);
  assert.equal(first.resumes, 1);

  first.state = 'suspended';
  rules.beepContext(AC);
  assert.equal(built, 1);
  assert.equal(first.resumes, 2);

  first.state = 'closed';
  const fresh = rules.beepContext(AC);
  assert.equal(built, 2);
  assert.notEqual(fresh, first);
  assert.equal(fresh.resumes, 1);
});

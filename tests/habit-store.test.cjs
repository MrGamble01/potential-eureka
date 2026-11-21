const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/personal-content.js'), 'utf8');
const sandbox = {
  Utils: {
    store: { get() { return null; }, set() {} },
    dateKey() { return '2026-11-21'; },
    todayKey() { return '2026-11-21'; },
    escHtml(s) { return String(s == null ? '' : s); },
  },
};
vm.runInContext(src + '\nglobalThis.PersonalContent = PersonalContent;', vm.createContext(sandbox), { filename: 'js/personal-content.js' });
const rules = sandbox.PersonalContent.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('a habit list that is not a list is empty, and a log that is not a map is empty', () => {
  assert.deepEqual(host(rules.readList(null)), []);
  assert.deepEqual(host(rules.readList({})), []);
  assert.deepEqual(host(rules.readList('walk')), []);
  assert.deepEqual(host(rules.readList([null, [], { id: 1, name: 'Walk' }])), [{ id: 1, name: 'Walk' }]);
  assert.deepEqual(host(rules.readLog(null)), {});
  assert.deepEqual(host(rules.readLog([])), {});
  assert.deepEqual(host(rules.readLog(4)), {});
  assert.deepEqual(host(rules.readLog('bad')), {});
  assert.deepEqual(host(rules.readLog({ '2026-11-21': { 1: true } })), { '2026-11-21': { 1: true } });
});

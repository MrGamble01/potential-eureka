const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/calendar.js'), 'utf8');
const sandbox = { Utils: { formatTime() { return ''; } } };
vm.runInContext(src + '\nglobalThis.CalendarWidget = CalendarWidget;', vm.createContext(sandbox), { filename: 'js/calendar.js' });
const rules = sandbox.CalendarWidget.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('a calendar config without a real list falls back instead of throwing', () => {
  assert.equal(rules.readConfig(null), null);
  assert.equal(rules.readConfig([]), null);
  assert.equal(rules.readConfig({ apiKey: 'k' }), null);
  assert.equal(rules.readConfig({ apiKey: 'k', calendars: 'work' }), null);
  assert.equal(rules.readConfig({ apiKey: '  ', calendars: [{ id: 'a' }] }), null);
  assert.equal(rules.readConfig({ apiKey: 'k', calendars: [{ name: 'no id' }, null] }), null);
  assert.deepEqual(host(rules.readConfig({
    apiKey: ' key ',
    calendars: [{ id: '  ', name: 'Skip' }, { id: 'work@example.com', name: '  Work  ' }, { id: 'home@example.com' }],
  })), {
    apiKey: 'key',
    calendars: [
      { name: 'Work', id: 'work@example.com' },
      { name: 'Calendar', id: 'home@example.com' },
    ],
  });
});

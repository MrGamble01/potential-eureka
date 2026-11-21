const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/calendar.js'), 'utf8');
const sandbox = { Utils: { formatTime() { return ''; } } };
vm.runInContext(src + '\nglobalThis.CalendarWidget = CalendarWidget;', vm.createContext(sandbox), { filename: 'js/calendar.js' });
const rules = sandbox.CalendarWidget.rules;

test('today and tomorrow cross the month and the year', () => {
  const now = new Date(2026, 10, 30, 15, 0).getTime();
  assert.equal(rules.sameDay(new Date(2026, 10, 30, 1), new Date(2026, 10, 30, 23)), true);
  assert.equal(rules.sameDay(new Date(2026, 10, 30), new Date(2026, 11, 1)), false);
  assert.equal(rules.dayLabel(new Date(2026, 10, 30, 8), now), 'today');
  assert.equal(rules.dayLabel(new Date(2026, 11, 1, 9), now), 'tomorrow');
  assert.equal(rules.dayLabel(new Date(2026, 11, 2), now), '');
  const nye = new Date(2026, 11, 31, 12).getTime();
  assert.equal(rules.dayLabel(new Date(2027, 0, 1, 1), nye), 'tomorrow');
});

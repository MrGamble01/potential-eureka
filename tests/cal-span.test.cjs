const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/calendar.js'), 'utf8');
const sandbox = { Utils: { formatTime() { return ''; } } };
vm.runInContext(src + '\nglobalThis.CalendarWidget = CalendarWidget;', vm.createContext(sandbox), { filename: 'js/calendar.js' });
const rules = sandbox.CalendarWidget.rules;

test('an all-day event ends at the next local midnight, including across DST', () => {
  const span = rules.googleSpan({
    start: { date: '2026-11-21' },
    end: { date: '2026-11-22' },
  });
  const afternoon = new Date(2026, 10, 21, 15, 0, 0).getTime();
  const nextMorning = new Date(2026, 10, 22, 9, 0, 0).getTime();
  assert.ok(afternoon >= span.start.getTime() && afternoon < span.end.getTime());
  assert.ok(nextMorning >= span.end.getTime());
  assert.equal(span.end.getHours(), 0);
  assert.equal(span.end.getMinutes(), 0);
  assert.equal(span.end.getDate(), 22);

  const spring = rules.googleSpan({
    start: { date: '2026-03-08' },
    end: { date: '2026-03-09' },
  });
  assert.ok(new Date(2026, 2, 8, 12).getTime() < spring.end.getTime());
  assert.ok(new Date(2026, 2, 9, 0, 30).getTime() >= spring.end.getTime());
  assert.equal(spring.end.getDate(), 9);
  assert.equal(spring.end.getHours(), 0);

  const fall = rules.googleSpan({
    start: { date: '2026-11-01' },
    end: { date: '2026-11-02' },
  });
  assert.equal(fall.end.getDate(), 2);
  assert.equal(fall.end.getHours(), 0);

  const multi = rules.googleSpan({
    start: { date: '2026-11-21' },
    end: { date: '2026-11-24' },
  });
  assert.ok(new Date(2026, 10, 23, 18).getTime() < multi.end.getTime());
  assert.ok(new Date(2026, 10, 24, 9).getTime() >= multi.end.getTime());
});

test('a timed event keeps the clock times Google sent', () => {
  const span = rules.googleSpan({
    start: { dateTime: '2026-11-21T09:00:00' },
    end: { dateTime: '2026-11-21T10:30:00' },
  });
  assert.equal(span.start.getHours(), 9);
  assert.equal(span.start.getMinutes(), 0);
  assert.equal(span.end.getHours(), 10);
  assert.equal(span.end.getMinutes(), 30);
});

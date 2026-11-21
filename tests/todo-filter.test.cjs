const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/todo.js'), 'utf8');
const sandbox = {
  Utils: {
    escHtml(s) { return String(s); },
    store: { get() { return []; }, getRaw() { return ''; }, set() {} },
  },
};
vm.runInContext(src + '\nglobalThis.TodoList = TodoList;', vm.createContext(sandbox), { filename: 'js/todo.js' });
const rules = sandbox.TodoList.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('list colors follow the name, and the same name keeps its hue', () => {
  assert.equal(rules.listColor(''), 'var(--text-dim)');
  assert.equal(rules.listColor('Office'), 'var(--cyan)');
  assert.equal(rules.listColor('Home life'), 'var(--magenta)');
  const garden = rules.listColor('Garden');
  assert.match(garden, /^hsl\(\d+, 70%, 60%\)$/);
  assert.equal(rules.listColor('Garden'), garden);
});

test('the filter keeps open tasks, finished tasks, or everything', () => {
  const items = [{ id: 1, done: false }, { id: 2, done: true }];
  assert.deepEqual(host(rules.visibleTodos(items, 'active')), [{ id: 1, done: false }]);
  assert.deepEqual(host(rules.visibleTodos(items, 'done')), [{ id: 2, done: true }]);
  assert.equal(rules.visibleTodos(items, 'all').length, 2);
});

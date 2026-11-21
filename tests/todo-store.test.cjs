const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/todo.js'), 'utf8');
const sandbox = {
  Utils: {
    escHtml(s) { return String(s); },
    store: { get() { return { nope: true }; }, getRaw() { return ''; }, set() {} },
  },
};
vm.runInContext(src + '\nglobalThis.TodoList = TodoList;', vm.createContext(sandbox), { filename: 'js/todo.js' });
const rules = sandbox.TodoList.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('a todo save or task list that is not an array is empty', () => {
  assert.deepEqual(host(rules.readTodos(null)), []);
  assert.deepEqual(host(rules.readTodos({})), []);
  assert.deepEqual(host(rules.readTodos('buy milk')), []);
  assert.deepEqual(host(rules.readTodos([null, [], { id: '1', text: 'Buy milk', done: false }])), [
    { id: '1', text: 'Buy milk', done: false },
  ]);
  assert.deepEqual(host(rules.readLists({})), []);
  assert.deepEqual(host(rules.readLists([{ title: 'no id' }, { id: 'L', title: 'Work' }])), [
    { id: 'L', title: 'Work' },
  ]);
});

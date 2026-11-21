const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/bookmarks.js'), 'utf8');
const sandbox = { URL, Utils: { store: { get() { return { not: 'a list' }; }, set() {} } } };
vm.runInContext(src + '\nglobalThis.Bookmarks = Bookmarks;', vm.createContext(sandbox), { filename: 'js/bookmarks.js' });
const Bookmarks = sandbox.Bookmarks;
const host = (value) => JSON.parse(JSON.stringify(value));

test('a bookmark save that is not a list is empty, and holes are dropped', () => {
  assert.deepEqual(host(Bookmarks.readBookmarks(null)), []);
  assert.deepEqual(host(Bookmarks.readBookmarks({})), []);
  assert.deepEqual(host(Bookmarks.readBookmarks('https://ok.test')), []);
  assert.deepEqual(host(Bookmarks.readBookmarks([null, 4, [], { id: 2, name: 'Ok', url: 'https://ok.test' }])), [
    { id: 2, name: 'Ok', url: 'https://ok.test' },
  ]);
});

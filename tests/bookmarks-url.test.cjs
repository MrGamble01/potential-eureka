const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/bookmarks.js'), 'utf8');
const sandbox = { URL, Utils: { store: { get() { return []; }, set() {} } } };
vm.runInContext(src + '\nglobalThis.Bookmarks = Bookmarks;', vm.createContext(sandbox), { filename: 'js/bookmarks.js' });
const Bookmarks = sandbox.Bookmarks;

test('only http and https bookmarks are kept', () => {
  assert.equal(Bookmarks.safeUrl('example.com/path'), 'https://example.com/path');
  assert.equal(Bookmarks.safeUrl('  https://ok.test/a?q=1 '), 'https://ok.test/a?q=1');
  assert.equal(Bookmarks.safeUrl('http://ok.test'), 'http://ok.test/');
  assert.equal(Bookmarks.safeUrl('javascript:alert(1)'), null);
  assert.equal(Bookmarks.safeUrl('data:text/html,hi'), null);
  assert.equal(Bookmarks.safeUrl(''), null);
  assert.equal(Bookmarks.safeUrl('   '), null);
  assert.equal(Bookmarks.safeUrl('http://'), null);
});

test('a tile escapes the name and drops a bad address', () => {
  const html = Bookmarks.tileHtml({ id: 5, name: `A<b>"'`, url: 'https://ok.test/a?x=1&y=2' });
  assert.match(html, /A&lt;b&gt;&quot;&#39;/);
  assert.match(html, /href="https:\/\/ok\.test\/a\?x=1&amp;y=2"/);
  assert.equal(html.includes('<b>'), false);
  assert.equal(Bookmarks.tileHtml({ id: 5, name: 'Nope', url: 'javascript:alert(1)' }), '');
  assert.equal(Bookmarks.tileHtml({ id: NaN, name: 'Nope', url: 'https://ok.test' }), '');
});

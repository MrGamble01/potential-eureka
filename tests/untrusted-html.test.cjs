const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');

function load(file, name, sandbox) {
  const src = readFileSync(join(root, file), 'utf8');
  const context = vm.createContext(sandbox);
  vm.runInContext(src + '\nglobalThis.' + name + ' = ' + name + ';', context, { filename: file });
  return context[name];
}

test('a bookmark URL cannot break out of its href', () => {
  const marks = load('js/bookmarks.js', 'Bookmarks', {
    URL,
    Utils: { store: { get() { return []; }, set() {} } },
  });
  assert.equal(marks.safeUrl('javascript:alert(1)'), null);
  assert.equal(marks.safeUrl('data:text/html,hi'), null);
  assert.equal(marks.safeUrl('example.com/notes'), 'https://example.com/notes');

  const html = marks.tileHtml({
    id: 7,
    name: '<script>',
    url: 'https://example.com/a?q="><img src=x onerror=alert(1)>',
  });
  assert.equal(html.includes('<script'), false);
  assert.equal(html.includes('<img'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="https:\/\/example.com\/a\?q=%22%3E%3Cimg/);
  assert.match(html, /aria-label="Remove &lt;script&gt;"/);
  assert.match(html, /deleteBookmark\(7\)/);
});

test('a rival name cannot become a tag, and the remove button still names them', () => {
  const rivals = load('js/rivals.js', 'Rivals', {});
  const name = '<img src=x onerror=alert(1)> "Ada"';
  const html = rivals.chipHtml(name, 2);
  assert.equal(html.includes('<img'), false);
  assert.match(html, /&lt;img/);
  assert.match(html, /aria-label="Remove &lt;img src=x onerror=alert\(1\)&gt; &quot;Ada&quot;"/);
  const token = html.match(/data-rname="([^"]*)"/)[1];
  assert.equal(decodeURIComponent(token), name);
  assert.match(html, /\(2 games\)/);
});

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '../js/view-assets.js'), 'utf8');
const sandbox = {
  document: {
    createElement() { return {}; },
    querySelector() { return null; },
    head: { appendChild() {}, insertBefore() {} },
  },
};
sandbox.window = sandbox;
vm.runInContext(src, vm.createContext(sandbox), { filename: 'js/view-assets.js' });
const views = sandbox.EurekaViews;

test('each hub game lazy-loads its own script with the shared board css', () => {
  const games = ['snake', 'tetris', 'inkflip', 'gutterlight', 'memorymatrix', 'wordcascade', 'vectordefense', 'stacker'];
  for (const name of games) {
    const pack = views.pack(name);
    assert.equal(pack.js.length, 1, name);
    assert.match(pack.js[0], new RegExp('js/.+\\.js$'));
    assert.ok(pack.css[0].startsWith('css/games.css'), name);
  }
  assert.equal(views.pack('inkflip').js[0], 'js/inkflip.js');
  assert.equal(views.pack('gutterlight').js[0], 'js/gutterlight.js');
});

test('productivity scripts stay ordered while the stylesheet starts immediately', async () => {
  const events = [];
  let releaseCss;
  let releaseFirst;
  const cssGate = new Promise((resolve) => { releaseCss = resolve; });
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  function load(url, kind) {
    events.push(kind + ' ' + url);
    if (kind === 'css') return cssGate;
    if (url.endsWith('pomodoro.js')) return firstGate;
    return Promise.resolve();
  }
  const pending = views.schedule({
    css: ['css/productivity.css'],
    js: ['js/pomodoro.js', 'js/todo.js', 'js/productivity.js'],
  }, load);
  await Promise.resolve();
  assert.deepEqual(events, ['css css/productivity.css', 'js js/pomodoro.js']);
  releaseCss();
  await Promise.resolve();
  assert.deepEqual(events, ['css css/productivity.css', 'js js/pomodoro.js']);
  releaseFirst();
  await pending;
  assert.deepEqual(events, [
    'css css/productivity.css',
    'js js/pomodoro.js',
    'js js/todo.js',
    'js js/productivity.js',
  ]);
});

test('the productivity pack keeps the shell script last', () => {
  const js = JSON.parse(JSON.stringify(views.pack('productivity').js));
  assert.deepEqual(js, [
    'js/pomodoro.js',
    'js/todo.js',
    'js/notes.js',
    'js/bookmarks.js',
    'js/productivity.js',
  ]);
});

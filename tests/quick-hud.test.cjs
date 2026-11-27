const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

const root = join(__dirname, '..');
const games = readFileSync(join(root, 'css/games.css'), 'utf8');
const ash = readFileSync(join(root, 'games/ashmarch/ashmarch.css'), 'utf8');
const ashJs = readFileSync(join(root, 'games/ashmarch/ashmarch.js'), 'utf8');

test('quick cabinet controls keep a 44px tap and a focus ring', () => {
  assert.match(games, /@media \(max-width:\s*1024px\) and \(min-height:\s*640px\)/);
  assert.match(games, /\.game-controls button[\s\S]{0,400}min-height:\s*44px/);
  assert.match(games, /\.game-controls button[\s\S]{0,400}min-width:\s*44px/);
  assert.match(games, /\.tetris-touch\s*\{[^}]*minmax\(44px,\s*1fr\)/);
  assert.match(games, /\.game-controls button:focus-visible,\s*\.game-controls select:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  assert.match(games, /\.tetris-touch button:focus-visible[\s\S]{0,120}outline:\s*2px solid/);
});

test('ashmarch pins Speak and lets extra choices scroll', () => {
  assert.match(ash, /\.composer\s*\{[^}]*display:\s*flex[^}]*flex:\s*0 0 auto/);
  assert.match(ash, /\.composer\s*\{[^}]*overflow:\s*hidden/);
  assert.match(ash, /\.suggestions\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*auto/);
  assert.match(ash, /\.composer textarea,\s*\.composer-row\s*\{\s*flex:\s*0 0 auto;\s*\}/);
  assert.match(ash, /\.choice,\s*\.suggestions button[^}]*min-height:\s*48px/);
  assert.match(ash, /button:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  assert.match(ash, /@media \(max-width:\s*740px\)/);
  assert.match(ash, /\.composer textarea\s*\{\s*min-height:\s*88px;\s*\}/);
  assert.match(ashJs, /scrollPaddingBottom/);
  assert.match(ashJs, /scroller\.scrollTop \+= comp0\.bottom - view\.bottom/);
});

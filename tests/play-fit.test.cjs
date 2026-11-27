'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('the hub links the arcade cabinet stylesheet', () => {
  const html = read('index.html');
  assert.match(html, /href="css\/games\.css\?v=/);
});

test('sound and the studio menu sit on the visible bar', () => {
  const html = read('index.html');
  const navStart = html.indexOf('<nav class="site-nav"');
  const navEnd = html.indexOf('</nav>', navStart);
  const nav = html.slice(navStart, navEnd);
  assert.match(nav, /id="nav-sfx-toggle"/);
  assert.match(nav, /id="studio-menu"/);
  assert.match(nav, /aria-label="Toggle sound"/);
  assert.doesNotMatch(nav, /id="studio-links"/);
});

test('icon-only controls name themselves', () => {
  const hub = read('index.html');
  const isle = read('voxel-garden.html');
  assert.match(hub, /id="mines-face"[^>]*aria-label="New game"/);
  assert.match(isle, /id="camLeft"[^>]*aria-label="Turn left"/);
  assert.match(isle, /id="camIn"[^>]*aria-label="Zoom in"/);
  assert.match(isle, /id="camRight"[^>]*aria-label="Turn right"/);
  assert.match(isle, /id="camOut"[^>]*aria-label="Zoom out"/);
  assert.match(isle, /id="mateName"[^>]*aria-label="Deckhand"/);
});

test('flagship boards keep a phone tap and a readable tetris queue', () => {
  const games = read('css/games.css');
  assert.match(games, /\.tetris-touch\s*\{[^}]*minmax\(44px,\s*1fr\)/);
  assert.match(games, /\.tetris-touch\s*\{[^}]*width:\s*min\(100%,\s*480px\)/);
  assert.match(games, /\.tetris-layout\s*\{[^}]*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(games, /#tetris-hold-canvas\s*\{[^}]*height:\s*24px/);
  assert.match(games, /#tetris-next-canvas\s*\{[^}]*height:\s*40px/);
  assert.match(games, /#view-crateescape \.game-container,\s*#view-gutterlight \.game-container,\s*#view-tetris \.game-container\s*\{[^}]*100dvh - 72px/);
  const vale = read('hearthvale.html');
  assert.match(vale, /#minimap\s*\{\s*bottom:\s*210px/);
  assert.match(vale, /#buildtabs \.btab\s*\{[^}]*min-height:\s*44px/);
  const tycoon = read('tycoon/play.html');
  assert.match(tycoon, /id="elevator-btn"[^>]*aria-label="Floors"/);
  assert.match(tycoon, /html\.hud \.ea-back\s*\{[^}]*min-height:\s*44px/);
  assert.match(tycoon, /#sprint-btn\s*\{[\s\S]*?min-height:\s*44px/);
});

test('phone and tablet cabinet controls keep a 44px target', () => {
  const games = read('css/games.css');
  assert.match(games, /max-width:\s*1024px\)\s*and\s*\(min-height:\s*640px\)/);
  assert.match(games, /\.game-controls button[\s\S]{0,240}min-height:\s*44px/);
  const face = read('css/studio-face.css');
  assert.match(face, /\.studio-explore-btn[\s\S]{0,500}min-height:\s*44px/);
  assert.match(face, /#nav-sfx-toggle|#studio-menu|studio-icon-btn[\s\S]{0,400}min-height:\s*44px/);
});

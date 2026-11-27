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

test('phone and tablet cabinet controls keep a 44px target', () => {
  const games = read('css/games.css');
  assert.match(games, /max-width:\s*1024px\)\s*and\s*\(min-height:\s*640px\)/);
  assert.match(games, /\.game-controls button[\s\S]{0,240}min-height:\s*44px/);
  const face = read('css/studio-face.css');
  assert.match(face, /\.studio-explore-btn[\s\S]{0,500}min-height:\s*44px/);
  assert.match(face, /#nav-sfx-toggle|#studio-menu|studio-icon-btn[\s\S]{0,400}min-height:\s*44px/);
});

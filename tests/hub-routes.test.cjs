const assert = require('node:assert/strict');
const test = require('node:test');
const HubRoutes = require('../js/hub-routes.js');

test('hashes, nicknames, and pages land on the same game', () => {
  assert.deepEqual(HubRoutes.viewFor('#tetris'), { kind: 'view', name: 'tetris' });
  assert.deepEqual(HubRoutes.viewFor('neon-breaker'), { kind: 'view', name: 'breakout' });
  assert.deepEqual(HubRoutes.viewFor('drop-four'), { kind: 'view', name: 'connect4' });
  assert.deepEqual(HubRoutes.viewFor('game2048'), { kind: 'view', name: '2048' });
  assert.deepEqual(HubRoutes.viewFor('ageofwar'), { kind: 'page', href: 'ageofwar/' });
  assert.equal(HubRoutes.pageFor('voxel-isle'), 'voxel-garden.html');
  assert.equal(HubRoutes.pageFor('age-of-war'), 'ageofwar/');
  assert.equal(HubRoutes.pageFor('tetris'), null);
  assert.equal(HubRoutes.viewFor('#hof=ada'), null);
  assert.equal(HubRoutes.viewFor(''), null);
  assert.equal(HubRoutes.viewFor('not-a-game'), null);
});

test('the showcase list is the eight flagship games', () => {
  assert.deepEqual(HubRoutes.SHOWCASE, [
    'voxel', 'ashmarch', 'ageofwar', 'tycoon', 'hearthvale', 'gutterlight', 'crateescape', 'tetris',
  ]);
  assert.equal(HubRoutes.isShowcase('#Tetris'), true);
  assert.equal(HubRoutes.isShowcase('snake'), false);
  assert.equal(HubRoutes.isShowcase(''), false);
  const games = HubRoutes.showcaseGames();
  assert.equal(games.length, 8);
  assert.equal(games[0].href, 'voxel-garden.html');
  assert.equal(games[7].href, '#tetris');
  assert.equal(HubRoutes.titleFor('breakout'), 'Neon Breaker — Eureka Games');
  assert.equal(HubRoutes.titleFor('missing'), 'EUREKA GAMES');
});

const assert = require('node:assert/strict');
const test = require('node:test');
const World = require('../js/living-world.js');

function advance(world, seconds) {
  for (let i = 0; i < seconds; i++) world.tick(1);
}

test('the clock splits into dawn, day, dusk, and night', () => {
  assert.equal(World.phaseAt(0.05), 'dawn');
  assert.equal(World.phaseAt(0.4), 'day');
  assert.equal(World.phaseAt(0.68), 'dusk');
  assert.equal(World.phaseAt(0.9), 'night');
  assert.equal(World.phaseAt(1), 'dawn');
  assert.equal(World.phaseAt(-0.1), 'night');
});

test('a world query pins a phase and a sky', () => {
  assert.deepEqual(World.parseQuery(''), {
    tour: false, fast: false, phase: null, weather: null,
  });
  assert.deepEqual(World.parseQuery('?world=night-storm'), {
    tour: false, fast: false, phase: 'night', weather: 'storm',
  });
  const tour = World.parseQuery('world=tour&x=1');
  assert.equal(tour.tour, true);
  assert.equal(tour.phase, null);
  const packed = World.parseQuery('fast demo rain');
  assert.equal(packed.fast, true);
  assert.equal(packed.tour, true);
  assert.equal(packed.weather, 'rain');
});

test('night and storm multiply, and a clear day stays at one', () => {
  const storm = World.combine('night', 'storm');
  assert.equal(storm.growth, 1.01);
  assert.equal(storm.move, 0.68);
  assert.equal(storm.vision, 0.58);
  assert.equal(storm.foe, 1.39);
  assert.equal(storm.heavy, 1.25);
  assert.equal(storm.ranged, 0.7);
  assert.equal(storm.heatGain, 1.56);
  assert.equal(storm.heatDrain, 0.85);
  assert.equal(storm.buyers, 1.36);
  assert.equal(storm.price, 1.27);
  assert.equal(storm.spawn, 0.74);
  const calm = World.combine('day', 'clear');
  assert.equal(calm.move, 1);
  assert.equal(calm.foe, 1);
  assert.equal(calm.price, 1);
  assert.equal(calm.heavy, 1);
});

test('a pinned sky changes the fight and leaves a tycoon deal alone', () => {
  const fight = World.create({ profile: 'ageofwar', query: 'night storm', seed: 3 });
  const snap = fight.snapshot();
  assert.equal(snap.phase, 'night');
  assert.equal(snap.weather, 'storm');
  assert.equal(snap.mood, 'tense');
  assert.equal(fight.unitDamage(100, { side: 'enemy', line: 'heavy' }), 174);
  assert.equal(fight.unitDamage(100, { side: 'enemy', line: 'ranged' }), 97);
  assert.equal(fight.unitDamage(100, { side: 'player', line: 'heavy' }), 125);
  assert.equal(fight.unitDamage('nope', { side: 'enemy' }), 0);
  assert.equal(fight.moveStep(100), 68);
  assert.ok(Math.abs(fight.limitRange(200) - 116) < 1e-9);

  const office = World.create({ profile: 'tycoon', query: 'night storm', seed: 3 });
  assert.equal(office.snapshot().effect, 'open sky');
  assert.equal(office.snapshot().mods.foe, 1.39);

  const rain = World.create({ profile: 'ageofwar', query: 'rain' });
  assert.equal(rain.snapshot().phase, 'day');
  assert.equal(rain.snapshot().weather, 'rain');
  assert.equal(rain.snapshot().effect, 'march 90% · ranged 84% · sight 92%');
  assert.equal(World.particleBudget('rain', true), 0);
  assert.equal(World.particleBudget('rain', false), 40);
  assert.equal(World.paintCap('rain', false, 400), 22);
  assert.equal(World.paintCap('snow', false, 1200), 26);
});

test('the same seed walks the same sky after the clear hold', () => {
  const first = World.create({ profile: 'ageofwar', seed: 9 });
  const again = World.create({ profile: 'ageofwar', seed: 9 });
  assert.equal(first.snapshot().effect, 'open sky');
  advance(first, 130);
  advance(again, 130);
  assert.equal(first.snapshot().key, again.snapshot().key);
  assert.notEqual(first.snapshot().weather, 'clear');
});

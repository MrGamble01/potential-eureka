const assert = require('node:assert/strict');
const test = require('node:test');
const Rules = require('../ageofwar/rules.js');

const roster = {
  club: { era: 0, line: 'melee' },
  sling: { era: 0, line: 'ranged' },
  dino: { era: 0, line: 'heavy', anchor: true },
  runner: { era: 0, line: 'skirmish' },
  bulwark: { era: 0, line: 'shield' },
  boss_dino: { era: 0, line: 'heavy', anchor: true },
  squire: { era: -1, role: 'companion' },
  wall0: { era: 0, role: 'wall' },
};

test('era roster skips bosses and companions and keeps walls', () => {
  assert.deepEqual(Rules.unitsForEra(roster, 0), ['club', 'sling', 'dino', 'runner', 'bulwark', 'wall0']);
  assert.deepEqual(Rules.unitsForEra(roster, -1), []);
});

test('the wave leader is the anchored heavy, not the last new line', () => {
  assert.equal(Rules.heavyKey(roster, ['club', 'sling', 'dino', 'runner', 'bulwark']), 'dino');
  assert.equal(Rules.heavyKey(roster, ['runner', 'bulwark']), 'bulwark');
  assert.equal(Rules.heavyKey(roster, []), null);
});

test('counter lines change damage and the old triangle does not', () => {
  assert.equal(Rules.counterFactor('skirmish', 'shield'), 1.5);
  assert.equal(Rules.counterFactor('skirmish', 'heavy'), 1.35);
  assert.equal(Rules.counterFactor('ranged', 'shield'), 0.6);
  assert.equal(Rules.counterFactor('ranged', 'skirmish'), 1.4);
  assert.equal(Rules.counterFactor('heavy', 'shield'), 1.2);
  assert.equal(Rules.counterFactor('shield', 'skirmish'), 0.75);
  assert.equal(Rules.counterFactor('shield', 'ranged'), 1.25);
  assert.equal(Rules.counterFactor('melee', 'heavy'), 1);
  assert.equal(Rules.counterFactor('ranged', 'heavy'), 1);
});

test('training time stays between 0.6s and 7s, and drums take 15% off', () => {
  assert.equal(Rules.trainingSeconds(25, false), 0.6);
  assert.equal(Rules.trainingSeconds(2500, false), 5);
  assert.equal(Rules.trainingSeconds(10000, false), 7);
  assert.equal(Rules.trainingSeconds(2500, true), 4.25);
});

test('field orders change cost, gold, damage, and the Castle Age wall', () => {
  const swords = { cost: 130 };
  assert.equal(Rules.recruitCost(swords, null), 130);
  assert.equal(Rules.recruitCost(swords, 'levy'), 143);
  assert.equal(Rules.recruitCost(null, 'levy'), 0);
  assert.equal(Rules.orderGoldMult('levy'), 1.18);
  assert.equal(Rules.orderGoldMult('shield'), 0.92);
  assert.equal(Rules.orderGoldMult('sapper'), 1);
  const soldier = { side: 'player' };
  const wall = { side: 'player', role: 'wall' };
  const foe = { side: 'enemy' };
  assert.equal(Rules.orderMitigate('shield', soldier, 100), 88);
  assert.equal(Rules.orderMitigate('shield', wall, 100), 100);
  assert.equal(Rules.orderMitigate('shield', foe, 100), 100);
  assert.equal(Rules.orderMitigate('levy', soldier, 100), 100);
  assert.equal(Rules.nextAgeXp(480, 'sapper', 1), 552);
  assert.equal(Rules.nextAgeXp(1800, 'sapper', 2), 1800);
  assert.equal(Rules.nextAgeXp(480, 'levy', 1), 480);
});

test('each armor tier keeps another tenth of a hit', () => {
  assert.equal(Rules.armorMult(0), 1);
  assert.equal(Rules.armorMult(3), 0.7);
});

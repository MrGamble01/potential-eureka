const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/vectordefense.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.VectorDefenseGame = VectorDefenseGame;', vm.createContext(sandbox), { filename: 'js/vectordefense.js' });
const rules = sandbox.VectorDefenseGame.rules;

test('pulse damage and range climb by tier, and rail range stays the field', () => {
  const pulse = { kind: 'pulse', tier: 1 };
  assert.equal(rules.tierDmg(pulse), rules.turrets.pulse.dmg);
  assert.equal(rules.tierRange(pulse), rules.turrets.pulse.range);
  pulse.tier = 2;
  assert.ok(Math.abs(rules.tierDmg(pulse) - rules.turrets.pulse.dmg * 1.4) < 1e-9);
  assert.ok(Math.abs(rules.tierRange(pulse) - rules.turrets.pulse.range * 1.12) < 1e-9);
  const rail = { kind: 'rail', tier: 3 };
  assert.equal(rules.tierRange(rail), rules.turrets.rail.range);
  assert.ok(rules.tierDmg(rail) > rules.turrets.rail.dmg);
});

test('an upgrade gets dearer and a sale returns seventy percent of the spend', () => {
  const tower = { kind: 'pulse', tier: 1, spent: 50 };
  assert.equal(rules.upgradeCost(tower), Math.round(50 * 0.8));
  tower.tier = 2;
  assert.equal(rules.upgradeCost(tower), Math.round(50 * 0.8 * 1.8));
  tower.spent = 122;
  assert.equal(rules.sellValue(tower), Math.round(122 * 0.7));
});

test('raiders get tougher each wave and the path runs from the first waypoint to the last', () => {
  const first = rules.enemyStats(1);
  const later = rules.enemyStats(4);
  assert.equal(first.hp, 26);
  assert.ok(later.hp > first.hp);
  assert.ok(later.speed > first.speed);
  assert.equal(later.bounty, 12);
  assert.equal(rules.waves, 10);
  const start = rules.pointAt(0);
  const end = rules.pointAt(rules.pathLen + 50);
  assert.ok(start.x < 0);
  assert.equal(end.x, 660);
  assert.equal(end.y, 360);
});

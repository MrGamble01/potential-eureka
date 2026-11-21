const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/asteroids.js'), 'utf8');
const sandbox = {
  Utils: {
    gameLoop() { return { start() {}, stop() {} }; },
    sfx() {},
  },
};
vm.runInContext(src + '\nglobalThis.AsteroidsGame = AsteroidsGame;', vm.createContext(sandbox), { filename: 'js/asteroids.js' });
const rules = sandbox.AsteroidsGame.rules;

test('one iPhone tap does not fire, jump, or pause twice', () => {
  const tap = {};
  assert.equal(rules.takePress('pointerdown', 1000, tap), true);
  assert.equal(rules.takePress('touchstart', 1004, tap), false);
  assert.equal(rules.takePress('touchstart', 1000 + rules.pressPairMs - 1, tap), false);
  assert.equal(rules.takePress('pointerdown', 1000 + rules.pressPairMs, tap), true);
  assert.equal(rules.takePress('touchstart', 1000 + rules.pressPairMs + 3, tap), false);

  const mouse = {};
  assert.equal(rules.takePress('pointerdown', 0, mouse), true);
  assert.equal(rules.takePress('pointerdown', 10, mouse), true);
  assert.equal(rules.takePress('click', 20, mouse), false);

  assert.equal(rules.takePress('touchstart', 50, {}), true);
});

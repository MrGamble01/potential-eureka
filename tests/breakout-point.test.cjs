const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/breakout.js'), 'utf8');
const sandbox = {
  Utils: { gameLoop() { return { start() {}, stop() {} }; }, sfx() {} },
};
vm.runInContext(src + '\nglobalThis.BreakoutGame = BreakoutGame;', vm.createContext(sandbox), { filename: 'js/breakout.js' });
const rules = sandbox.BreakoutGame.rules;

test('a collapsed board does not freeze the paddle', () => {
  assert.equal(rules.pointerXFrom(0, { left: 0, width: 0 }), null);
  assert.equal(rules.pointerXFrom(360, { left: 0, width: 0 }), null);
  assert.equal(rules.pointerXFrom(NaN, { left: 0, width: 720 }), null);
  assert.equal(rules.pointerXFrom(360, { left: 0, width: 720 }), 360);
  assert.equal(rules.pointerXFrom(180, { left: 10, width: 360 }), 340);
  assert.equal(rules.settlePaddle(NaN, 108), (720 - 108) / 2);
  assert.equal(rules.settlePaddle(40, NaN), (720 - 108) / 2);
  assert.equal(rules.settlePaddle(1000, 108), 720 - 108);
  assert.equal(rules.settlePaddle(40, 108), 40);
});

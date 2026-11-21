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
const host = (value) => JSON.parse(JSON.stringify(value));

test('a point just past an edge comes back once, and the edge itself stays', () => {
  const w = rules.width;
  const h = rules.height;
  assert.deepEqual(host(rules.wrapPoint(-1, 10, w, h)), { x: w - 1, y: 10 });
  assert.deepEqual(host(rules.wrapPoint(w + 3, -4, w, h)), { x: 3, y: h - 4 });
  assert.deepEqual(host(rules.wrapPoint(0, h, w, h)), { x: 0, y: h });
  assert.deepEqual(host(rules.wrapPoint(w, 0, w, h)), { x: w, y: 0 });
});

test('thrust past the cap is cut to the cap, and a slower ship is left alone', () => {
  const capped = rules.capVelocity(6, 8, rules.maxSpeed);
  assert.ok(Math.abs(Math.hypot(capped.vx, capped.vy) - rules.maxSpeed) < 1e-9);
  assert.ok(capped.vx > 0 && capped.vy > 0);
  assert.deepEqual(host(rules.capVelocity(3, 4, rules.maxSpeed)), { vx: 3, vy: 4 });
  assert.deepEqual(host(rules.capVelocity(rules.maxSpeed, 0, rules.maxSpeed)), { vx: rules.maxSpeed, vy: 0 });
});

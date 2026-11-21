const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/stacker.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.StackerGame = StackerGame;', vm.createContext(sandbox), { filename: 'js/stacker.js' });
const rules = sandbox.StackerGame.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

test('a clean miss ends the floor, and a near miss snaps flush', () => {
  const top = { x: 100, w: 80 };
  assert.deepEqual(host(rules.landOn({ x: 200, w: 80 }, top, rules.perfectTol)), { miss: true });
  const perfect = host(rules.landOn({ x: 104, w: 80 }, top, rules.perfectTol));
  assert.deepEqual(perfect, { miss: false, perfect: true, x: 100, w: 80 });
  const edge = rules.landOn({ x: 105, w: 80 }, top, rules.perfectTol);
  assert.equal(edge.perfect, true);
});

test('an overhang is sliced off the side it hangs from', () => {
  const top = { x: 100, w: 80 };
  const right = rules.landOn({ x: 130, w: 80 }, top, rules.perfectTol);
  assert.equal(right.perfect, false);
  assert.equal(right.x, 130);
  assert.equal(right.w, 50);
  assert.equal(right.cutX, 180);
  assert.equal(right.cutW, 30);
  const left = rules.landOn({ x: 70, w: 80 }, top, rules.perfectTol);
  assert.equal(left.x, 100);
  assert.equal(left.w, 50);
  assert.equal(left.cutX, 70);
  assert.equal(left.cutW, 30);
  assert.ok(left.w >= rules.minWidth);
  assert.ok(rules.landOn({ x: 175, w: 80 }, top, rules.perfectTol).w < rules.minWidth);
});

test('the slider speeds up and then stops getting faster', () => {
  assert.equal(rules.speedFor(0), 2.2);
  assert.ok(rules.speedFor(10) > rules.speedFor(0));
  assert.equal(rules.speedFor(80), 7.5);
  assert.equal(rules.speedFor(200), 7.5);
});

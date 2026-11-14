const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '../js/isle-math.js'), 'utf8');
const sandbox = {};
vm.runInContext(src, vm.createContext(sandbox), { filename: 'js/isle-math.js' });
const { clamp, lerp, easeOutBack, mulberry32, hash3, noise2, fbm, colScale } = sandbox;

test('clamp and lerp stay inside the segment', () => {
  assert.equal(clamp(-2, 0, 1), 0);
  assert.equal(clamp(4, 0, 1), 1);
  assert.equal(clamp(0.25, 0, 1), 0.25);
  assert.equal(lerp(10, 20, 0), 10);
  assert.equal(lerp(10, 20, 1), 20);
  assert.equal(lerp(10, 20, 0.5), 15);
});

test('easeOutBack starts at 0 and finishes at 1', () => {
  assert.ok(Math.abs(easeOutBack(0)) < 1e-12);
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-12);
  assert.ok(easeOutBack(0.7) > 1);
});

test('a seed replays the same terrain', () => {
  const first = mulberry32(7);
  const again = mulberry32(7);
  const draws = [first(), first(), first()];
  assert.deepEqual([again(), again(), again()], draws);
  assert.ok(draws.every((n) => n >= 0 && n < 1));
  assert.notEqual(mulberry32(8)(), draws[0]);

  assert.equal(hash3(3, 0, 9, 4), hash3(3, 0, 9, 4));
  assert.ok(hash3(3, 0, 9, 4) >= 0 && hash3(3, 0, 9, 4) < 1);
  assert.notEqual(hash3(3, 0, 9, 4), hash3(4, 0, 9, 4));

  const sample = noise2(1.25, 4.5, 11);
  assert.equal(noise2(1.25, 4.5, 11), sample);
  assert.ok(sample >= 0 && sample <= 1);
  const hill = fbm(2.2, 6.4, 11);
  assert.equal(fbm(2.2, 6.4, 11), hill);
  assert.ok(hill >= 0 && hill <= 1);
});

test('color scale darkens a channel without leaving 0..1', () => {
  const dim = colScale(0xff8040, 0.5);
  assert.ok(Math.abs(dim[0] - 0.5) < 1e-9);
  assert.ok(Math.abs(dim[1] - (128 * 0.5) / 255) < 1e-9);
  assert.ok(Math.abs(dim[2] - (64 * 0.5) / 255) < 1e-9);
  const blown = JSON.parse(JSON.stringify(colScale(0xffffff, 3)));
  assert.deepEqual(blown, [1, 1, 1]);
});

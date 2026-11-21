const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/vectordefense.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.VectorDefenseGame = VectorDefenseGame;', vm.createContext(sandbox), { filename: 'js/vectordefense.js' });
const point = sandbox.VectorDefenseGame.rules.boardPoint;
const host = (value) => value && JSON.parse(JSON.stringify(value));

test('a collapsed board does not turn a click into a wave launch', () => {
  assert.equal(point({ left: 0, top: 0, width: 0, height: 480 }, 20, 20), null);
  assert.equal(point({ left: 0, top: 0, width: 640, height: 0 }, 20, 20), null);
  assert.equal(point({ left: 0, top: 0, width: 640, height: 480 }, Infinity, 20), null);
  assert.deepEqual(host(point({ left: 0, top: 0, width: 640, height: 480 }, 320, 240)), { x: 320, y: 240 });
  assert.deepEqual(host(point({ left: 8, top: 12, width: 320, height: 240 }, 168, 132)), { x: 320, y: 240 });
});

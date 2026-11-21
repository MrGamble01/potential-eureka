const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/gutterlight.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.GutterlightGame = GutterlightGame;', vm.createContext(sandbox), { filename: 'js/gutterlight.js' });
const point = sandbox.GutterlightGame.rules.boardPoint;
const host = (value) => value && JSON.parse(JSON.stringify(value));

test('a collapsed board does not produce an aim', () => {
  assert.equal(point({ left: 0, top: 0, width: 0, height: 360 }, 10, 10), null);
  assert.equal(point({ left: 0, top: 0, width: 640, height: 0 }, 10, 10), null);
  assert.equal(point({ left: 0, top: 0, width: 640, height: 360 }, NaN, 10), null);
  assert.deepEqual(host(point({ left: 0, top: 0, width: 640, height: 360 }, 320, 180)), { x: 320, y: 180 });
  assert.deepEqual(host(point({ left: 10, top: 20, width: 320, height: 180 }, 170, 110)), { x: 320, y: 180 });
});

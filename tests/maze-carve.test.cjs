const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/maze.js'), 'utf8');
const sandbox = {
  localStorage: { getItem() { return '0'; }, setItem() {} },
  setInterval() { return 1; },
  clearInterval() {},
  Utils: { sfx() {}, delay() { return Promise.resolve(); } },
};
vm.runInContext(src + '\nglobalThis.MazeGame = MazeGame;', vm.createContext(sandbox), { filename: 'js/maze.js' });
const rules = sandbox.MazeGame.rules;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function reachable(grid, sr, sc, er, ec) {
  const rows = grid.length;
  const cols = grid[0].length;
  const seen = new Set([sr + ',' + sc]);
  const queue = [[sr, sc]];
  while (queue.length) {
    const [r, c] = queue.shift();
    if (r === er && c === ec) return true;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = nr + ',' + nc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || grid[nr][nc] !== 0 || seen.has(key)) continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  return false;
}

test('par grows with the cell count', () => {
  assert.equal(rules.parFor(rules.rows, rules.cols), 36);
  assert.equal(rules.parFor(1, 1), 3);
});

test('the same seed carves the same maze, and the exit is reachable', () => {
  const a = rules.carve(rules.rows, rules.cols, mulberry32(7));
  const b = rules.carve(rules.rows, rules.cols, mulberry32(7));
  assert.deepEqual(a, b);
  assert.equal(a[1][0], 0);
  assert.equal(a[rules.rows - 2][rules.cols - 1], 0);
  assert.equal(a[0][1], 1);
  assert.equal(reachable(a, 1, 0, rules.rows - 2, rules.cols - 1), true);
  const other = rules.carve(rules.rows, rules.cols, mulberry32(8));
  assert.notDeepEqual(a, other);
});

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');

function host(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadGame(file, name, sandbox) {
  const src = readFileSync(join(root, file), 'utf8');
  const context = vm.createContext(sandbox);
  vm.runInContext(src + '\nglobalThis.' + name + ' = ' + name + ';', context, { filename: file });
  return context[name];
}

function holes() {
  const src = readFileSync(join(root, 'js/gutterlight.js'), 'utf8');
  const match = src.match(/const HOLES = (\[[\s\S]*?\n  \]);/);
  assert.ok(match, 'Gutterlight course table is missing');
  return new Function('return ' + match[1])();
}

function rectDistance(rect, x, y) {
  const left = rect[0];
  const top = rect[1];
  const right = left + rect[2];
  const bottom = top + rect[3];
  const nx = Math.max(left, Math.min(x, right));
  const ny = Math.max(top, Math.min(y, bottom));
  return Math.hypot(x - nx, y - ny);
}

test('Gutterlight has nine holes and every cup can be sunk', () => {
  const course = holes();
  const tableW = 640;
  const tableH = 360;
  const sink = 16;
  assert.equal(course.length, 9);
  course.forEach((hole, index) => {
    const label = 'hole ' + (index + 1);
    assert.ok(Array.isArray(hole.walls), label + ' walls');
    for (const point of [hole.tee, hole.cup]) {
      assert.ok(point[0] > 20 && point[0] < tableW - 20, label + ' x ' + point[0]);
      assert.ok(point[1] > 20 && point[1] < tableH - 20, label + ' y ' + point[1]);
    }
    assert.notDeepEqual(hole.tee, hole.cup, label + ' tee is the cup');
    const hazards = hole.walls.concat(hole.water || []);
    for (const rect of hazards) {
      const cupGap = rectDistance(rect, hole.cup[0], hole.cup[1]);
      const teeGap = rectDistance(rect, hole.tee[0], hole.tee[1]);
      assert.ok(cupGap > sink, label + ' cup is ' + cupGap.toFixed(1) + 'px from a hazard');
      assert.ok(teeGap > 8, label + ' tee is inside a hazard');
    }
  });
});

test('Inkflip opens with the four standard replies', () => {
  const game = loadGame('js/inkflip.js', 'InkflipGame', {});
  const rules = game.rules;
  const board = rules.empty();
  let mine = 0;
  let theirs = 0;
  const legal = [];
  for (let r = 0; r < rules.size; r++) {
    for (let c = 0; c < rules.size; c++) {
      if (board[r][c] === rules.me) mine++;
      else if (board[r][c] === rules.them) theirs++;
      const flipped = rules.captured(board, r, c, rules.me);
      if (flipped.length) legal.push(r + ',' + c + ':' + flipped.length);
    }
  }
  assert.equal(mine, 2);
  assert.equal(theirs, 2);
  assert.deepEqual(legal.sort(), ['2,3:1', '3,2:1', '4,5:1', '5,4:1']);
  assert.deepEqual(host(rules.captured(board, 3, 4, rules.me)), []);
  assert.deepEqual(host(rules.captured(board, 0, 0, rules.me)), []);

  const line = host(rules.empty()).map((row) => row.map(() => 0));
  line[3][1] = rules.them;
  line[3][2] = rules.them;
  line[3][3] = rules.me;
  assert.deepEqual(host(rules.captured(line, 3, 0, rules.me)), [[3, 1], [3, 2]]);
  line[3][3] = 0;
  assert.deepEqual(host(rules.captured(line, 3, 0, rules.me)), []);
});

test('Memory Matrix keys 1-9 hit the pad in reading order', () => {
  const game = loadGame('js/memorymatrix.js', 'MemoryMatrixGame', {
    Utils: { sfx() {} },
  });
  const stride = 162;
  const pad = 18;
  const cell = 150;
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = pad + col * stride + cell / 2;
    const y = pad + row * stride + cell / 2;
    assert.equal(game.hitPad(x, y), i, 'key ' + (i + 1));
  }
  assert.equal(game.hitPad(pad + cell + 6, pad + cell / 2), -1);
  assert.equal(game.hitPad(-1, -1), -1);
});

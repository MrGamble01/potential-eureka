const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/connect4.js'), 'utf8');
const timers = new Map();
let nextId = 1;
let frame = null;
let onClick = null;
const ctx = new Proxy({}, { get: () => () => {} });
const canvas = {
  width: 0,
  height: 0,
  style: {},
  getContext() { return ctx; },
  getBoundingClientRect() { return { left: 0, top: 0, width: 434, height: 372 }; },
  addEventListener(type, fn) { if (type === 'click') onClick = fn; },
};
const sandbox = {
  window: { devicePixelRatio: 1 },
  Utils: {
    sfx() {},
    whenViewActive(_id, fn) { return fn; },
    highScore: { load() { return 0; }, save(_k, score, current) { return score > current ? score : current; } },
  },
  localStorage: { getItem() { return null; }, setItem() {} },
  document: {
    getElementById(id) {
      if (id === 'c4-canvas') return canvas;
      if (id === 'view-connect4') return { classList: { contains(name) { return name === 'active'; } } };
      return { textContent: '', style: {}, classList: { toggle() {}, contains() { return false; } } };
    },
    querySelectorAll() { return []; },
    addEventListener() {},
  },
  requestAnimationFrame(fn) { frame = fn; return 1; },
  cancelAnimationFrame() {},
  setTimeout(fn) {
    const id = nextId++;
    timers.set(id, fn);
    return id;
  },
  clearTimeout(id) { timers.delete(id); },
};
vm.runInContext(src + '\nglobalThis.ConnectFourGame = ConnectFourGame;', vm.createContext(sandbox), { filename: 'js/connect4.js' });
const game = sandbox.ConnectFourGame;

test('leaving the board cancels the AI think delay', () => {
  game.init();
  assert.equal(typeof onClick, 'function');
  onClick({ clientX: 217 });
  for (let i = 0; i < 80 && timers.size === 0; i++) frame();
  assert.equal(timers.size, 1);
  game.destroy();
  assert.equal(timers.size, 0);
});

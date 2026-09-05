const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

function setup(visibility = 'visible') {
  let now = 100000;
  const handlers = {}, storage = new Map();
  const context = vm.createContext({
    Date: { now: () => now }, Utils: { todayKey: () => '2026-09-04' },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    document: { visibilityState: visibility, addEventListener: (n, f) => handlers[n] = f },
    window: { addEventListener: (n, f) => handlers[n] = f },
  });
  vm.runInContext(readFileSync(join(__dirname, '../js/telemetry.js'), 'utf8') +
    '\nthis.telemetry = Telemetry; Telemetry.init();', context);
  return {
    api: context.telemetry,
    advance: seconds => { now += seconds * 1000; },
    event: name => handlers[name]?.(),
    visibility: state => { context.document.visibilityState = state; handlers.visibilitychange(); },
    seconds: game => JSON.parse(storage.get('eureka-stats')).seconds[game] || 0,
  };
}
test('hidden time stays excluded through flush, repeated hides and pagehide', () => {
  const s = setup(); s.api.enter('snake'); s.advance(10); s.visibility('hidden');
  s.advance(3600); s.api.flush(); s.event('pagehide'); s.visibility('hidden');
  assert.equal(s.seconds('snake'), 10);
  s.visibility('visible'); s.event('pageshow'); s.advance(5); s.api.enter('arcade');
  assert.equal(s.seconds('snake'), 15);
});
test('a game entered while hidden begins timing only when visible', () => {
  const s = setup('hidden'); s.api.enter('snake'); s.advance(100); s.api.enter('tetris');
  s.advance(100); s.visibility('visible'); s.advance(7); s.api.flush();
  assert.equal(s.seconds('snake'), 0); assert.equal(s.seconds('tetris'), 7);
});
test('pagehide pauses a visible page and pageshow resumes it without double counting', () => {
  const s = setup(); s.api.enter('snake'); s.advance(10); s.event('pagehide');
  s.advance(100); s.event('pageshow'); s.advance(5); s.event('pageshow');
  s.advance(5); s.api.flush(); assert.equal(s.seconds('snake'), 20);
});


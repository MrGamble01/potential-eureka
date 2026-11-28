const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/ai/inworld.js'), 'utf8');
const start = src.indexOf('/* seat-speaker:start');
const end = src.indexOf('/* seat-speaker:end */');
assert.ok(start !== -1 && end > start, 'seatSpeaker is marked in inworld.js');
const sandbox = {};
vm.runInNewContext(src.slice(start, end), sandbox, { filename: 'js/ai/inworld.js' });
const seatSpeaker = sandbox.seatSpeaker;

function stack(anchor, buttonH, nameH) {
  return { top: anchor - buttonH, bottom: anchor + nameH };
}

test('a phone coach sends heroes up the field, not onto the tabs', () => {
  // Measured on a 390×844 Age of War field: the coach owns the
  // ground line, and stepping down would plant the names on Units.
  const y = seatSpeaker(274.4, 44, 12, [{ top: 223, bottom: 277 }], 314);
  const box = stack(y, 44, 12);
  assert.ok(box.bottom <= 314 - 8, 'names clear the tabs (' + box.bottom + ')');
  assert.ok(box.bottom <= 223 - 8, 'heroes clear the coach (' + box.bottom + ')');
  assert.ok(box.top >= 144, 'heroes stay on the field (' + box.top + ')');
});

test('heroes that already clear the tabs and the coach stay put', () => {
  assert.equal(seatSpeaker(429, 37, 12, [{ top: 463, bottom: 491 }], 508), 429);
  assert.equal(seatSpeaker(509, 42, 12, [{ top: 563, bottom: 591 }], 608), 509);
  assert.equal(seatSpeaker(679.8, 44, 12, [{ top: 764, bottom: 792 }], 811), 679.8);
});

test('a hero standing on the tab row steps up until the name clears it', () => {
  const y = seatSpeaker(320, 44, 12, [], 314);
  assert.ok(stack(y, 44, 12).bottom <= 314 - 8);
});

test('a hero still steps down off a band when the tabs are far below', () => {
  const y = seatSpeaker(300, 40, 12, [{ top: 200, bottom: 270 }], 500);
  assert.ok(y > 300, 'moved down off the band');
  assert.ok(stack(y, 40, 12).top >= 270 + 8, 'cleared the band');
  assert.ok(stack(y, 40, 12).bottom <= 500 - 8, 'still above the tabs');
});

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

const root = join(__dirname, '..');
const aow = readFileSync(join(root, 'ageofwar/aow.css'), 'utf8');
const vale = readFileSync(join(root, 'hearthvale.html'), 'utf8');
const tycoon = readFileSync(join(root, 'tycoon/play.html'), 'utf8');
const speakers = readFileSync(join(root, 'js/ai/inworld.js'), 'utf8');

function block(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.notEqual(start, -1, 'missing ' + startMarker);
  const end = src.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, 'missing end after ' + startMarker);
  return src.slice(start, end);
}

/* Phone orders: 8px shell padding, 4px between the two groups,
   2px between the four buttons in a group. */
function phoneActionWidth(viewport) {
  const content = viewport - 16;
  const group = (content - 4) / 2;
  return (group - 6) / 4;
}

/* iPad row: 16px inset each side, 6px between halves, 4px between
   the four buttons that share a half. */
function tabletActionWidth(viewport) {
  const bar = viewport - 32;
  const group = (bar - 6) / 2;
  return (group - 12) / 4;
}

test('phone and iPad command buttons keep a 44px budget', () => {
  assert.ok(phoneActionWidth(390) >= 44, '390 phone orders are ' + phoneActionWidth(390));
  assert.ok(tabletActionWidth(768) >= 44, '768 iPad orders are ' + tabletActionWidth(768));
  assert.ok(tabletActionWidth(721) >= 44, '721 tablet orders are ' + tabletActionWidth(721));

  const phoneStart = aow.indexOf('@media (max-width: 720px) and (min-height: 640px)');
  assert.notEqual(phoneStart, -1);
  const phone = aow.slice(phoneStart);
  assert.match(phone, /\.aow-action-group \{[^}]*gap:\s*2px/);
  assert.match(phone, /\.aow-action \{[^}]*min-width:\s*44px/);
  assert.match(phone, /\.aow-action \{[^}]*min-height:\s*44px/);

  const ipad = block(
    aow,
    'Equal halves keep the four Stone Age',
    '/* Tall phone:'
  );
  assert.match(ipad, /min-width:\s*721px\) and \(max-width:\s*900px\)/);
  assert.match(ipad, /\.aow-action \{[^}]*min-width:\s*44px/);
  assert.match(ipad, /\.aow-action-group--orders,\s*\.aow-action-group--meta \{[^}]*flex:\s*1 1 0/);
});

test('hearthvale phone build captions stay inside the button', () => {
  const phone = block(vale, '@media (max-width: 640px)', '/* Townsfolk talk');
  assert.match(phone, /#buildbar \.btn, #buildbar \.btn\.tool \{[^}]*overflow:\s*hidden/);
  assert.match(phone, /#buildbar \.btn \.lbl,\s*#buildbar \.btn \.cost \{[^}]*text-overflow:\s*ellipsis/);
});

test('startup tycoon keeps Floors clear of the open hire drawer', () => {
  const drawer = block(tycoon, '@media (max-width: 900px)', '/* Tap targets bumped');
  assert.match(drawer, /#left-panel \{[^}]*bottom:\s*calc\(74px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(drawer, /#elevator-btn \{[^}]*z-index:\s*125/);
});

test('age of war touch speakers are a 44px target and desktop stays compact', () => {
  assert.match(speakers, /const coarse = gameId === 'ageofwar' && window\.matchMedia\('\(pointer: coarse\)'\)\.matches/);
  assert.match(speakers, /const floor = coarse \? 44 : 30/);
  assert.match(speakers, /const cap = coarse \? 48 : 42/);

  const size = (canvasWidth, coarse) => {
    const floor = coarse ? 44 : 30;
    const cap = coarse ? 48 : 42;
    return Math.max(floor, Math.min(cap, canvasWidth / 22));
  };
  assert.ok(size(372, true) >= 44);
  assert.ok(size(734, true) >= 44);
  assert.equal(size(372, false), 30);
  assert.ok(size(1400, false) <= 42);
});

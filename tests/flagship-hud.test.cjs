const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

const root = join(__dirname, '..');
const aow = readFileSync(join(root, 'ageofwar/aow.css'), 'utf8');
const vale = readFileSync(join(root, 'hearthvale.html'), 'utf8');
const tycoon = readFileSync(join(root, 'tycoon/play.html'), 'utf8');
const speakers = readFileSync(join(root, 'js/ai/inworld.js'), 'utf8');
const hub = readFileSync(join(root, 'index.html'), 'utf8');

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

/* Phone next-step card: 78px off the bottom, up to 74px tall once
   the subtitle wraps, plus an 8px gap so the tap is the upgrade. */
function phoneDrawerBottom(cardBottom, cardHeight, gap) {
  return cardBottom + cardHeight + gap;
}

test('phone hire drawer stops above the next-step card', () => {
  assert.equal(phoneDrawerBottom(78, 74, 8), 160);
  assert.ok(phoneDrawerBottom(78, 57, 8) <= 160, 'the opening card still clears');
  assert.ok(phoneDrawerBottom(78, 57, 8) > 74, '74px still lands on the card');

  const phone = block(tycoon, 'Stop the hire drawer above the next-step card', '/* ── Virtual joystick');
  assert.match(phone, /@media \(max-width: 480px\)/);
  assert.match(phone, /#left-panel \{[^}]*bottom:\s*calc\(160px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(phone, /#left-panel \{[^}]*padding-bottom:\s*16px/);
});

/* Phone drawer border box: 320px of content, 10px of padding on each
   side, and the 1px right border. */
function phoneDrawerBox(content, pad, border) {
  return content + pad * 2 + border;
}

function phoneFloatLeft(viewport, inset, size) {
  return viewport - inset - size;
}

test('phone camera and 3rd person sit clear of the open hire drawer', () => {
  const drawer = phoneDrawerBox(320, 10, 1);
  assert.equal(drawer, 341);
  assert.ok(phoneFloatLeft(390, 2, 44) >= drawer, '390 phone gutter is ' + (390 - drawer));
  assert.equal(194 + 44 + 8, 246);

  const phone = block(tycoon, 'Keep the camera and 3rd person clear', '/* ── Virtual joystick');
  assert.match(phone, /@media \(max-width: 480px\)/);
  assert.match(phone, /body:has\(#left-panel\.open\) #tyc-moments,\s*body:has\(#left-panel\.open\) #tp-toggle \{[^}]*right:\s*calc\(2px \+ env\(safe-area-inset-right, 0px\)\)/);
  assert.match(phone, /body:has\(#left-panel\.open\) #tyc-moments,\s*body:has\(#left-panel\.open\) #tp-toggle \{[^}]*width:\s*44px/);
  assert.match(phone, /body:has\(#left-panel\.open\) #tyc-moments \{[^}]*bottom:\s*calc\(246px \+ env\(safe-area-inset-bottom, 0px\)\)/);

  const wideCam = block(tycoon, 'right: auto;', '#tp-toggle:hover');
  assert.match(wideCam, /left:\s*calc\(14px \+ env\(safe-area-inset-left, 0px\)\)/);
  assert.match(wideCam, /bottom:\s*calc\(220px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  const wideWalk = block(tycoon, 'Sprint owns 142..186', '#drawer-backdrop');
  assert.match(wideWalk, /#tp-toggle \{[^}]*bottom:\s*calc\(194px \+ env\(safe-area-inset-bottom, 0px\)\)/);
});

test('age of war and homeless village touch speakers are a 44px target and desktop stays compact', () => {
  assert.match(speakers, /const coarse = \(gameId === 'ageofwar' \|\| gameId === 'homeless'\) && window\.matchMedia\('\(pointer: coarse\)'\)\.matches/);
  assert.doesNotMatch(speakers, /growop|grow-op|drug-lab/);
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
  assert.ok(size(390, true) >= 44);
  assert.ok(size(744, true) >= 44);

  const nudgeSrc = speakers.slice(
    speakers.indexOf('function nudgeSpeaker'),
    speakers.indexOf('/* nudge-speaker:end */')
  );
  const nudgeSpeaker = new Function(nudgeSrc + '\nreturn nudgeSpeaker;')();
  const panel = { left: 554, top: 75, right: 744, bottom: 1058 };
  const dee = nudgeSpeaker(562, 458, 44, [panel]);
  assert.equal(dee.x, 502);
  assert.equal(dee.y, 458);
  assert.ok(dee.x + 44 <= panel.left);
  const open = nudgeSpeaker(200, 300, 44, [panel]);
  assert.deepEqual(open, { x: 200, y: 300 });
  const camp = block(speakers, "document.getElementById('three-canvas')", 'function frame');
  assert.match(camp, /nudgeSpeaker\(box\.left, box\.top, size, chrome\)/);
  assert.match(camp, /btn\.style\.left = \(left \+ size \/ 2\)/);
  assert.match(camp, /btn\.style\.top = \(top \+ size\)/);
});

/* Phone Word Five row is the 366px cabinet. Six gaps of 4px, seven keys. */
function phoneWordKey(row, gap, cols) {
  return (row - gap * (cols - 1)) / cols;
}

test('word five phone keys and the new-word button are 44px taps', () => {
  assert.ok(phoneWordKey(366, 4, 7) >= 44, '390 keys are ' + phoneWordKey(366, 4, 7));
  const phone = block(hub, 'Ten keys cannot be 44px wide', 'New Word lives in the score row');
  assert.match(phone, /@media\(max-width:480px\)/);
  assert.match(phone, /#word5-kb\{[^}]*flex-direction:row/);
  assert.match(phone, /\.w5-kb-row\{display:contents\}/);
  assert.match(phone, /calc\(\(100% - 24px\) \/ 7\)/);
  assert.match(phone, /min-height:44px/);
  const tap = block(hub, 'New Word lives in the score row', '@media(max-height:520px)');
  assert.match(tap, /@media \(max-width: 1024px\) and \(min-height: 640px\)/);
  assert.match(tap, /#view-word5 \.game-info button \{[^}]*min-height:\s*44px/);
  const short = hub.slice(hub.indexOf('@media(max-height:520px)'));
  assert.match(short, /\.w5-key\{[^}]*min-height:0/);
  assert.match(short, /\.w5-kb-row\{display:flex/);
});

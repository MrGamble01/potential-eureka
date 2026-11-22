const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

const html = readFileSync(join(__dirname, '../index.html'), 'utf8');

function tag(id) {
  const match = html.match(new RegExp('<[^>]*id="' + id + '"[^>]*>'));
  assert.ok(match, id + ' is missing');
  return match[0];
}

test('hub fields and icon buttons have accessible names', () => {
  const named = {
    'bm-name': 'Bookmark name',
    'bm-url': 'Bookmark URL',
    'todo-input': 'New task',
    'todo-list-picker': 'Task list',
    'maze-algo': 'Pathfinding algorithm',
    'mines-face': 'New game',
    'gt-client-id': 'OAuth client ID',
    'cal-api-key': 'Google API key',
  };
  for (const [id, label] of Object.entries(named)) {
    const el = tag(id);
    assert.match(el, new RegExp('aria-label="' + label + '"'), id);
  }
  assert.match(html, /aria-label="Connect Google Calendar"/);
  assert.match(html, /aria-label="Sync with Google Tasks"/);
  for (const mood of ['Great', 'Good', 'Okay', 'Low', 'Rough']) {
    assert.match(html, new RegExp('aria-label="' + mood + '"'));
  }
});

test('settings dialogs name themselves', () => {
  assert.match(tag('gt-modal'), /role="dialog"/);
  assert.match(tag('gt-modal'), /aria-modal="true"/);
  assert.match(tag('gt-modal'), /aria-labelledby="gt-modal-title"/);
  assert.match(html, /<h3 id="gt-modal-title">Google Tasks<\/h3>/);
  assert.match(tag('calendar-modal'), /role="dialog"/);
  assert.match(tag('calendar-modal'), /aria-labelledby="calendar-modal-title"/);
  assert.match(html, /<label for="gt-client-id">/);
  assert.match(html, /<label for="cal-api-key">/);
});

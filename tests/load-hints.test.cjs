const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function head(html) {
  const end = html.indexOf('</head>');
  assert.ok(end > 0);
  return html.slice(0, end);
}

function attr(tag, name) {
  const match = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
  return match ? match[1] : '';
}

function linkHrefs(chunk, rel) {
  const hrefs = [];
  for (const tag of chunk.match(/<link\b[^>]*>/g) || []) {
    if (attr(tag, 'rel') !== rel) continue;
    hrefs.push(attr(tag, 'href'));
  }
  return hrefs;
}

function scriptSrcs(html) {
  const srcs = [];
  for (const tag of html.match(/<script\b[^>]*>/g) || []) {
    const src = attr(tag, 'src');
    if (src) srcs.push({ src, defer: /\sdefer(?:\s|>)/.test(tag) });
  }
  return srcs;
}

function fileFor(src) {
  const path = src.split('?')[0].replace(/^\//, '');
  return join(root, path);
}

const pages = [
  'ageofwar/index.html',
  'hearthvale.html',
  'voxel-garden.html',
  'tycoon/play.html',
];

test('heavy game scripts start downloading from the head', () => {
  for (const page of pages) {
    const html = read(page);
    const early = linkHrefs(head(html), 'preload');
    for (const script of scriptSrcs(html)) {
      assert.ok(early.includes(script.src), page + ' does not preload ' + script.src);
      assert.ok(existsSync(fileFor(script.src)), script.src);
    }
  }
  const tycoonHead = head(read('tycoon/play.html'));
  assert.ok(linkHrefs(tycoonHead, 'modulepreload').includes('/vendor/three.module.js'));
  assert.ok(existsSync(join(root, 'vendor/three.module.js')));
});

test('Age of War scripts run in order after the page is parsed', () => {
  const html = read('ageofwar/index.html');
  const scripts = scriptSrcs(html);
  assert.ok(scripts.length > 2);
  for (const script of scripts) assert.equal(script.defer, true, script.src);
  assert.equal(scripts[scripts.length - 1].src, '/ageofwar/boot.js');
  assert.equal(html.includes('AgeOfWarGame.init()'), false);
  assert.match(read('ageofwar/boot.js'), /AgeOfWarGame\.init\(\)/);
  const utilsAt = html.indexOf('window.Utils');
  const firstDefer = html.indexOf('<script src="/js/persist.js" defer>');
  assert.ok(utilsAt > 0 && utilsAt < firstDefer);
});

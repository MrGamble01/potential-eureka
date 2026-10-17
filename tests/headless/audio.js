/* Shared flagship score.
 *
 * The engine is exercised here without a browser: a fake AudioContext
 * counts nodes, a fake clock holds the victory fanfare, and the
 * scheduler is stepped by hand. A real page load is intentionally not
 * part of this file — smoke covers that, and this stays fast.
 *
 * What has to stay true:
 *   - nothing is audible until unlock(), which is what the first tap calls
 *   - the sequencer is a timer, never the frame loop, and it does not
 *     build sample buffers
 *   - mute, sound, and music come from the shared settings document
 *   - a hitch does not dump a pile of notes onto the audio thread
 *   - calm / busy / tense / victory and the five cues are the whole API
 */
const fs = require('fs');
const path = require('path');
const Audio = require('../../js/audio.js');
const Persist = require('../../js/persist.js');

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function mem() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(k); },
  };
}

function makeWin() {
  const listeners = {};
  const gains = [];
  const oscs = [];
  let constructed = 0;
  let intervals = 0;
  let nextId = 1;
  const intervalFns = new Map();
  let raf = 0;
  const ctx = {
    currentTime: 0,
    state: 'suspended',
    sampleRate: 44100,
    destination: { kind: 'dest' },
    resume() { this.state = 'running'; return Promise.resolve(); },
    createGain() {
      const gain = {
        value: 1,
        setValueAtTime(v) { this.value = v; },
        setTargetAtTime(v) { this.value = v; },
        linearRampToValueAtTime(v) { this.value = v; },
        exponentialRampToValueAtTime(v) { this.value = v; },
        cancelScheduledValues() {},
      };
      const node = { kind: 'gain', gain: gain, connect() { return node; } };
      gains.push(node);
      return node;
    },
    createOscillator() {
      const frequency = {
        value: 440,
        setValueAtTime(v) { this.value = v; },
        exponentialRampToValueAtTime(v) { this.value = v; },
        linearRampToValueAtTime() {},
        cancelScheduledValues() {},
      };
      const node = {
        kind: 'osc',
        type: 'sine',
        frequency: frequency,
        detune: { value: 0, setValueAtTime(v) { this.value = v; } },
        connect() { return node; },
        start() { node.started = true; },
        stop() { node.stopped = true; },
      };
      oscs.push(node);
      return node;
    },
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: { value: 1000, setTargetAtTime(v) { this.value = v; }, setValueAtTime(v) { this.value = v; } },
        connect() {},
      };
    },
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 1 },
        attack: { value: 0 }, release: { value: 0 }, connect() {},
      };
    },
  };
  function add(target, type, fn) {
    const bag = listeners[target] || (listeners[target] = {});
    (bag[type] || (bag[type] = [])).push(fn);
  }
  function remove(target, type, fn) {
    const bag = listeners[target] && listeners[target][type];
    if (!bag) return;
    const i = bag.indexOf(fn);
    if (i >= 0) bag.splice(i, 1);
  }
  const document = {
    hidden: false,
    addEventListener(type, fn) { add('document', type, fn); },
    removeEventListener(type, fn) { remove('document', type, fn); },
    createElement() {
      return { style: {}, textContent: '', setAttribute() {}, appendChild() {} };
    },
  };
  const win = {
    AudioContext: function () { constructed++; return ctx; },
    document: document,
    listeners: listeners,
    gains: gains,
    oscs: oscs,
    ctx: ctx,
    constructed: () => constructed,
    intervals: () => intervals,
    raf: () => raf,
    addEventListener(type, fn) { add('window', type, fn); },
    removeEventListener(type, fn) { remove('window', type, fn); },
    setInterval(fn) { intervals++; const id = nextId++; intervalFns.set(id, fn); return id; },
    clearInterval(id) { if (intervalFns.has(id)) { intervalFns.delete(id); intervals--; } },
    requestAnimationFrame() { raf++; },
    fire(target, type) {
      const bag = (listeners[target] && listeners[target][type] || []).slice();
      bag.forEach((fn) => fn({ type: type }));
    },
  };
  return win;
}

const root = path.resolve(__dirname, '../..');
const engineSrc = fs.readFileSync(path.join(root, 'js/audio.js'), 'utf8');

ok(Audio.LICENSE.toLowerCase().indexOf('original') >= 0 && /Web Audio/.test(Audio.LICENSE),
  'the score is original Web Audio synthesis, not a borrowed sample');
ok(!/createBuffer\s*\(/.test(engineSrc), 'the engine never builds sample buffers');
ok(!/requestAnimationFrame/.test(engineSrc), 'the sequencer is not wired to the frame loop');
ok(Audio.SCHEDULER_MS >= 80 && Audio.SCHEDULER_MS <= 250, 'the timer is slow enough to stay off the render budget');
ok(Audio.MOODS.join() === 'calm,busy,tense,victory', 'the four moods are calm, busy, tense, victory');
ok(Audio.SFX.join() === 'build,buy,harvest,levelup,fail', 'the five cues are build, buy, harvest, level up, fail');

{
  const pages = {
    'hearthvale.html': ['EurekaAudio.sfx', 'soundtrackMood'],
    'voxel-garden.html': ['EurekaAudio.sfx', 'a.pickMood'],
    'drug-lab.html': ['labSfx(\'harvest\')', 'labSfx(\'build\')', 'labSfx(\'buy\')', 'labSfx(\'fail\')', 'labFanfare'],
    'tycoon/play.html': ['shared(\'build\')', 'shared(\'buy\')', 'shared(\'levelup\')', 'shared(\'fail\')', 'tycoonScore'],
  };
  Object.keys(pages).forEach((file) => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    ok(text.indexOf('/js/audio.js') >= 0, file + ' loads the shared score');
    pages[file].forEach((needle) => {
      ok(text.indexOf(needle) >= 0, file + ' uses ' + needle);
    });
  });
}

{
  const win = makeWin();
  let now = 0;
  const score = Audio.create(win, { now: () => now });
  ok(score.playing() === false && score.unlocked() === false && win.constructed() === 0,
    'loading the score does not create an audio context');
  ok(score.sfx('build') === false && win.oscs.length === 0, 'a cue before the first tap is silent');
  score.start('calm');
  ok(score.playing() === true && win.intervals() === 0 && win.raf() === 0,
    'starting the bed before a gesture does not arm the timer or the frame loop');

  win.fire('window', 'pointerdown');
  ok(score.unlocked() === true && win.constructed() === 1 && win.ctx.state === 'running',
    'the first tap unlocks and resumes the context');
  ok(win.intervals() === 1, 'the sequencer arms on that tap, not on a frame');
  ok((win.listeners.window.pointerdown || []).length === 0, 'the gesture listener steps aside after unlock');

  const before = win.oscs.length;
  win.ctx.currentTime = 30;
  score.pump();
  const spawned = win.oscs.length - before;
  ok(spawned > 0 && spawned <= 12, 'a late pump plays one beat, not the hitch it skipped (' + spawned + ' notes)');

  now = 0;
  ok(score.sfx('build') === true, 'build plays once the context is running');
  const afterBuild = win.oscs.length;
  now = 40;
  ok(score.sfx('build') === false && win.oscs.length === afterBuild, 'a second build inside the cooldown is dropped');
  now = 200;
  ok(score.sfx('harvest') === true, 'a different cue is not blocked by the build cooldown');
  ok(score.sfx('nope') === false, 'an unknown cue is refused');

  ok(score.pickMood({}) === 'calm', 'an empty read is calm');
  ok(score.pickMood({ busy: true }) === 'busy', 'work makes the bed busy');
  ok(score.pickMood({ busy: true, tense: true }) === 'tense', 'danger outranks work');
  ok(score.pickMood({ busy: true, tense: true, victory: true }) === 'victory', 'a win outranks danger');
  ok(score.setMood('panic') === false && score.mood() === 'calm', 'an unknown mood is refused and the bed stays');

  score.celebrate(8);
  ok(score.mood() === 'victory', 'a fanfare switches to victory');
  score.setMood('tense');
  ok(score.mood() === 'victory', 'victory holds against the next ordinary read');
  now = 9000;
  score.setMood('tense');
  ok(score.mood() === 'tense', 'the hold ends and the bed can turn tense');
  score.setMood('calm', { force: true });
  ok(score.mood() === 'calm', 'a forced mood cuts the hold');

  win.document.hidden = true;
  win.fire('document', 'visibilitychange');
  ok(win.intervals() === 0, 'a hidden tab stops the timer');
  win.document.hidden = false;
  win.fire('document', 'visibilitychange');
  ok(win.intervals() === 1 && win.raf() === 0, 'coming back restarts the timer and still never touches the frame loop');
}

{
  const store = mem();
  const persist = Persist.create(store);
  persist.settings.update({ muted: true, sfx: 0.2, music: 0.4, touched: true });
  const win = makeWin();
  win.EurekaPersist = persist;
  const score = Audio.create(win, { now: () => 0 });
  score.unlock();
  score.start('busy');
  const notes = win.oscs.length;
  score.pump();
  ok(score.sfx('buy') === false, 'a shared mute silences cues');
  ok(win.oscs.length === notes, 'a shared mute schedules no new notes');

  persist.settings.update({ muted: false, musicOn: false, music: 0, touched: true });
  score.pump();
  ok(win.oscs.length === notes, 'music at zero keeps the bed silent');
  ok(score.sfx('levelup') === true, 'sound can stay on while music is off');

  persist.settings.update({ music: 0.5, musicOn: true, touched: true });
  const quiet = win.oscs.length;
  score.pump();
  ok(win.oscs.length > quiet, 'raising the music level lets the bed play');
  const musicBus = win.gains[1];
  ok(musicBus && Math.abs(musicBus.gain.value - 0.5) < 0.001, 'the music bus follows the shared slider');
}

{
  const win = makeWin();
  let local = true;
  const score = Audio.create(win, { now: () => 0 });
  score.bind({ muted: () => local, musicOff: () => local });
  score.unlock();
  score.start('calm');
  ok(score.sfx('fail') === false, 'a game mute is honored before the shared document is touched');
  local = false;
  ok(score.sfx('fail') === true, 'clearing that mute lets the fail cue play');
  const host = { children: [], appendChild(n) { this.children.push(n); }, querySelector() { return null; } };
  const label = score.attachReadout(host);
  ok(host.children.length === 1 && label && /Score:/.test(label.textContent),
    'a game can show the mood next to its volume controls (' + (label && label.textContent) + ')');
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);

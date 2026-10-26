/* Grow Op audio + juice: procedural bed, cues, persisted mix, scene helpers.
 * No browser. A fake AudioContext counts the voices the engine schedules.
 */
const path = require('path');

const store = {};
globalThis.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; }
};

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

class Param {
  constructor() { this.value = 0; }
  setValueAtTime(v) { this.value = v; return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) {
    if (!(v > 0)) throw new Error('exponential ramp needs a positive target');
    this.value = v;
    return this;
  }
  setTargetAtTime(v) { this.value = v; return this; }
}

function node() {
  return {
    connect() { return this; },
    start() {},
    stop(t) { if (t < 0) throw new Error('stop before zero'); }
  };
}

class FakeAudio {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'running';
    this.destination = node();
    this.voices = 0;
    this.gains = [];
    FakeAudio.instances.push(this);
    FakeAudio.made += 1;
  }
  createGain() {
    const gain = new Param();
    const g = { gain, connect() { return this; } };
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    this.voices += 1;
    const osc = node();
    osc.type = 'sine';
    osc.frequency = new Param();
    return osc;
  }
  createBufferSource() {
    this.voices += 1;
    const src = node();
    src.buffer = null;
    src.loop = false;
    return src;
  }
  createBiquadFilter() {
    return { type: 'lowpass', frequency: new Param(), Q: new Param(), connect() { return this; } };
  }
  createBuffer(_ch, len) {
    const data = new Float32Array(len);
    return { getChannelData() { return data; } };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
FakeAudio.instances = [];
FakeAudio.made = 0;

(async () => {
  const root = path.resolve(__dirname, '../../games/grow-op');
  const { notesForStep, isClave, LOOP_STEPS, PROGRESSION } = await import(path.join(root, 'audio/pattern.js'));
  const { SFX, SFX_NAMES } = await import(path.join(root, 'audio/sfx.js'));
  const { loadMix, saveMix, MIX_KEY, LEGACY_MUTE_KEY } = await import(path.join(root, 'audio/mix.js'));
  const { createAudio } = await import(path.join(root, 'audio/index.js'));
  const { createJuice } = await import(path.join(root, 'audio/juice.js'));
  const { CartelSimulation } = await import(path.join(root, 'simulation.js'));

  let clave = 0;
  let tension = 0;
  const basses = new Set();
  for (let i = 0; i < LOOP_STEPS; i++) {
    const bar = Math.floor(i / 16);
    const step = i % 16;
    const notes = notesForStep(i);
    ok(notes.length > 0, `step ${i} has a voice`);
    if (isClave(bar, step)) {
      ok(notes.some((n) => n.wave === 'square' && n.bus === 'music'), `clave hit at bar ${bar} step ${step}`);
      clave += 1;
    }
    if (step === 0) {
      ok(notes.some((n) => n.freq === PROGRESSION[bar].bass), `bar ${bar} states its bass`);
      basses.add(PROGRESSION[bar].name);
    }
    if (notes.some((n) => n.bus === 'tension')) tension += 1;
  }
  ok(clave === 10, 'son clave repeats twice across the loop');
  ok(basses.size === 4, 'the bed walks four chords');
  ok(tension > 16, 'a tension layer is written into the loop');

  for (const name of SFX_NAMES) ok(Array.isArray(SFX[name]) && SFX[name].length > 0, `sfx ${name}`);

  globalThis.localStorage.setItem(LEGACY_MUTE_KEY, '1');
  ok(loadMix(globalThis.localStorage).muted === true, 'legacy mute still starts quiet');
  saveMix(globalThis.localStorage, { master: 0.4, music: 0.25, sfx: 0.9, muted: false });
  const again = loadMix(globalThis.localStorage);
  ok(again.master === 0.4 && again.music === 0.25 && again.sfx === 0.9 && again.muted === false, 'mix round-trips');

  const timers = [];
  const audio = createAudio({
    AudioContext: FakeAudio,
    storage: globalThis.localStorage,
    schedule(fn) { timers.push(fn); return timers.length; },
    clear(id) { timers[id - 1] = null; }
  });
  ok(audio.mix.master === 0.4, 'engine reads the saved master');
  audio.setMusic(0.5);
  ok(JSON.parse(globalThis.localStorage.getItem(MIX_KEY)).music === 0.5, 'music slider persists');
  audio.start();
  ok(FakeAudio.made === 1, 'one audio context');
  const bed = FakeAudio.instances[0];
  const afterBed = bed.voices;
  ok(afterBed > 4, 'the bed schedules more than a beep');
  audio.setTension(true);
  ok(bed.gains[3].gain.value === 1, 'a raid opens the tension bus');
  for (const name of SFX_NAMES) audio.play(name);
  ok(bed.voices > afterBed, 'cues add voices on the sfx bus');
  bed.currentTime = 1;
  audio.truckDepart();
  const departVoices = bed.voices;
  bed.currentTime = 1.05;
  audio.truckDepart();
  ok(bed.voices === departVoices, 'a second truck in the same instant does not stack');
  audio.setMuted(true);
  ok(audio.muted === true && bed.gains[0].gain.value === 0, 'mute closes the master bus');
  ok(JSON.parse(globalThis.localStorage.getItem(MIX_KEY)).muted === true, 'mute persists');
  const mutedVoices = bed.voices;
  audio.play('click');
  ok(bed.voices === mutedVoices, 'mute drops sfx');
  audio.stop();

  const events = [];
  const sim = new CartelSimulation((evt) => events.push(evt.type));
  sim.state.started = true;
  sim.state.eventCooldown = 999;
  sim.state.dirtyCash = 5000;
  const built = sim.buildOnSlot('slot_rp_town1', 'taxi_co');
  ok(built.ok && events.includes('built'), 'a build reaches the cue bus');
  sim.step(40);
  ok(events.includes('truck_departed'), 'a departing truck reaches the cue bus');
  sim.state.cleanCash = 5000;
  sim.buyResearch('lights');
  ok(events.includes('research'), 'research reaches the cue bus');
  sim.triggerRegionalRaid('rio_plata');
  ok(events.includes('raid_started'), 'a raid reaches the cue bus');
  const bribe = sim.bribeRegionAuthorities('rio_plata');
  ok(bribe.ok && events.includes('bribed'), 'a bribe reaches the cue bus');

  const texts = [];
  const shakes = [];
  const tweens = [];
  const circles = [];
  const scene = {
    slots: {
      slot_rp_pier: {
        def: { x: 40, y: 80 },
        root: { setScale() {} }
      }
    },
    add: {
      text(_x, _y, label) {
        const n = {
          label,
          destroyed: false,
          setOrigin() { return this; },
          setDepth() { return this; },
          setPosition() {},
          setAlpha() {},
          destroy() { this.destroyed = true; }
        };
        texts.push(n);
        return n;
      },
      graphics() {
        return {
          setDepth() { return this; },
          clear() {},
          fillStyle() {},
          fillCircle(x, y) { circles.push([x, y]); }
        };
      }
    },
    cameras: { main: { shake(ms, amt) { shakes.push([ms, amt]); } } },
    tweens: { add(cfg) { tweens.push(cfg); } }
  };
  const juice = createJuice(scene);
  const pop = juice.cashPop('slot_rp_pier', 120, 'dirty');
  ok(pop && texts[0].label === '+$120', 'dirty cash pops a floater');
  juice.cashPop('slot_rp_pier', 40, 'clean');
  ok(texts[1].label === '+$40 clean', 'clean cash names itself');
  juice.step(2);
  ok(texts[0].destroyed && texts[1].destroyed, 'floaters leave after they rise');
  juice.shake();
  ok(shakes.length === 1 && shakes[0][0] === 280, 'a raid shakes the camera');
  juice.pulseBuilding('slot_rp_pier');
  ok(tweens.length === 1 && tweens[0].yoyo === true, 'a production tick pulses the building');
  juice.pulseBuilding('slot_rp_pier');
  ok(tweens.length === 1, 'a building does not stack pulses');
  juice.burst({ x: 12, y: 18 }, 0xe7d3a1);
  juice.step(0.016);
  ok(circles.length >= 8, 'arrival throws particles');

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

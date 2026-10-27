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
    this.freqs = [];
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
    const write = osc.frequency.setValueAtTime.bind(osc.frequency);
    const freqs = this.freqs;
    osc.frequency.setValueAtTime = (v, t) => {
      freqs.push(v);
      return write(v, t);
    };
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
  const { SIM_CONFIG } = await import(path.join(root, 'data/config.js'));
  SIM_CONFIG.CORE_MODE = false;
  const { CartelSimulation } = await import(path.join(root, 'simulation.js'));
  const { zoneMix, ambienceLevels, crossedControl, ZONE_ANCHORS } = await import(path.join(root, 'audio/zones.js'));
  const { cityNotesForStep } = await import(path.join(root, 'audio/city.js'));
  const { WORK_HZ } = await import(path.join(root, 'audio/sfx.js'));
  const { attachFeel, presentEvent } = await import(path.join(root, 'systems/hooks.js'));

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

  const valleyAt = ZONE_ANCHORS.rio_plata;
  const downtownAt = ZONE_ANCHORS.ps_downtown;
  const valley = zoneMix(valleyAt.x, valleyAt.y);
  const downtown = zoneMix(downtownAt.x, downtownAt.y);
  const between = zoneMix((valleyAt.x * 2 + downtownAt.x) / 3, (valleyAt.y * 2 + downtownAt.y) / 3);
  ok(valley.rural > 0.6 && valley.city < valley.rural, 'the valley stays on the Latin bed');
  ok(downtown.city > downtown.rural, 'downtown is the synthwave side');
  const cityFlavors = Object.entries(downtown.flavors);
  cityFlavors.sort((a, b) => b[1] - a[1]);
  ok(cityFlavors[0][0] === 'downtown', 'standing downtown hears the downtown variation');
  ok(between.city > valley.city && between.rural > downtown.rural, 'a pan between valley and downtown is a crossfade');

  function peakFreq(flavor) {
    let peak = 0;
    for (let i = 0; i < 64; i++) {
      for (const note of cityNotesForStep(i, flavor)) peak = Math.max(peak, note.freq || 0);
    }
    return peak;
  }
  ok(peakFreq('downtown') > peakFreq('docks'), 'downtown sits higher than the docks');

  const nightCity = ambienceLevels(downtown, true);
  const dayCity = ambienceLevels(downtown, false);
  const nightValley = ambienceLevels(valley, true);
  const dayValley = ambienceLevels(valley, false);
  const docks = zoneMix(ZONE_ANCHORS.ps_docks.x, ZONE_ANCHORS.ps_docks.y);
  const dayDocks = ambienceLevels(docks, false);
  const nightDocks = ambienceLevels(docks, true);
  ok(nightCity.neon > dayCity.neon, 'neon hum rises after dark');
  ok(nightValley.insects > dayValley.insects, 'countryside insects thicken at night');
  ok(dayDocks.gulls > 0.3 && nightDocks.gulls < dayDocks.gulls, 'gulls work the docks by day');
  ok(dayValley.river > dayCity.river, 'the river stays with the valley');
  ok(dayCity.traffic > dayValley.traffic, 'traffic belongs to the city');
  ok(crossedControl(40, 50) === true, 'control crossing 45 is a gain');
  ok(crossedControl(50, 40) === false && crossedControl(45, 50) === false, 'control only announces a rising mark');

  saveMix(globalThis.localStorage, { master: 0.8, music: 0.7, sfx: 0.8, muted: false });
  const zoneTimers = [];
  const zoned = createAudio({
    AudioContext: FakeAudio,
    storage: globalThis.localStorage,
    schedule(fn) { zoneTimers.push(fn); return zoneTimers.length; },
    clear(id) { zoneTimers[id - 1] = null; }
  });
  zoned.setWork(true, false);
  zoned.start();
  const cityCtx = FakeAudio.instances[FakeAudio.instances.length - 1];
  ok(cityCtx.freqs.includes(WORK_HZ), 'construction hammers while a lot is building');
  ok(cityCtx.gains[3].gain.value === 0 || cityCtx.gains[3].gain.value === 1, 'tension is still the fourth bus');
  zoned.followCamera(downtownAt.x, downtownAt.y, true);
  ok(zoned.sceneMix.city > zoned.sceneMix.rural, 'the camera pulls the city bus up');
  const neonNight = cityCtx.gains[12].gain.value;
  zoned.followCamera(downtownAt.x, downtownAt.y, false);
  ok(neonNight > cityCtx.gains[12].gain.value, 'the neon bed follows the night flag');
  cityCtx.currentTime = 2;
  zoneTimers[0]();
  const cityVoices = cityCtx.voices;
  ok(cityVoices > 4, 'the city clock schedules neighborhood notes');
  zoned.followCamera(valleyAt.x, valleyAt.y, false);
  ok(zoned.sceneMix.rural > zoned.sceneMix.city, 'panning home brings the Latin bed back');
  zoned.stop();

  const heard = [];
  const feelTimers = [];
  const feelAudio = createAudio({
    AudioContext: FakeAudio,
    storage: globalThis.localStorage,
    schedule(fn) { feelTimers.push(fn); return feelTimers.length; },
    clear(id) { feelTimers[id - 1] = null; }
  });
  const cue = feelAudio.cue.bind(feelAudio);
  feelAudio.cue = (evt) => { heard.push(evt && evt.type); return cue(evt); };
  feelAudio.start();
  const feelCtx = FakeAudio.instances[FakeAudio.instances.length - 1];
  const beforeUnlock = feelCtx.voices;
  const feelJuice = createJuice(scene);
  const sweepsBefore = feelJuice.sweeps.length;
  presentEvent(feelAudio, feelJuice, { type: 'zone_unlocked', zoneId: 'ps_downtown' }, null);
  ok(heard.includes('zone_unlocked') && feelCtx.voices > beforeUnlock, 'unlock plays the fanfare');
  ok(feelJuice.sweeps.some((row) => row.kind === 'fog') && feelJuice.sweeps.length > sweepsBefore, 'unlock lifts a fog sweep');
  const drawn = circles.length;
  feelJuice.step(0.05);
  ok(circles.length > drawn, 'the reveal sweep draws');
  const dustAt = feelJuice.parts.length;
  presentEvent(feelAudio, feelJuice, { type: 'demolish_started', lotId: 'lot_rp_hacienda' }, null);
  ok(feelJuice.parts.length - dustAt >= 16, 'demolition throws a dust burst');
  presentEvent(feelAudio, feelJuice, { type: 'control_gained', zoneId: 'ps_docks' }, null);
  ok(feelJuice.sweeps.some((row) => row.kind === 'flash'), 'taking a neighborhood flashes it');

  const feel = new CartelSimulation(() => {});
  attachFeel(feel, feelAudio, () => feelJuice, () => ({ x: 480, y: 640, night: false }));
  feel.state.cleanCash = 5000;
  const deal = feel.negotiate('lot_rp_hacienda');
  ok(deal.ok && heard.includes('negotiate_ok'), 'a successful negotiation cues');
  const shove = feel.intimidate('lot_ja_hacienda', 0);
  ok(shove.ok === false && heard.includes('intimidate_fail'), 'a failed lean cues');
  feel.observeFrame(0.016);
  for (const lot of Object.values(feel.state.lots)) {
    if (lot.zoneId !== 'ps_downtown') continue;
    lot.owned = true;
    lot.phase = 'operating';
  }
  feel.state.zones.ps_downtown.heat = 0;
  feel.observeFrame(0.016);
  ok(heard.includes('control_gained'), 'crossing a control mark cues from the frame hook');
  feelAudio.stop();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

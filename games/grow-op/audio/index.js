// Procedural WebAudio for Grow Op. The bed and the cues are synthesized
// here — nothing is sampled — so the page stays self-contained.

import { loadMix, saveMix, clamp01 } from './mix.js';
import { BPM, LOOP_STEPS, notesForStep } from './pattern.js';
import { SFX, WORK_HZ } from './sfx.js';
import { cityNotesForStep } from './city.js';
import { zoneMix, ambienceLevels } from './zones.js';

const STEP_DUR = 60 / BPM / 4;
const CITY_STEP = 60 / 110 / 4;

function makeNoise(ac) {
  const rate = ac.sampleRate || 22050;
  const buf = ac.createBuffer(1, rate, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function createAudio(options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const AC = options.AudioContext
    || (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext))
    || null;
  const schedule = options.schedule || ((fn, ms) => setInterval(fn, ms));
  const clear = options.clear || ((id) => clearInterval(id));
  const mix = loadMix(storage);

  let ctx = null;
  let master = null;
  let music = null;
  let sfxBus = null;
  let tension = null;
  let ruralBus = null;
  let cityBus = null;
  let ambBus = null;
  let workBus = null;
  let beds = null;
  let noise = null;
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let cityStep = 0;
  let cityNext = 0;
  let tensionOn = false;
  let ruralLevel = 1;
  let cityLevel = 0;
  let flavors = {};
  let nightOn = false;
  let workBuild = false;
  let workDemo = false;
  const place = { x: 480, y: 640 };

  function bed(ac, type, freq, q) {
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, ac.currentTime || 0);
    filter.Q.setValueAtTime(q, ac.currentTime || 0);
    const gain = ac.createGain();
    gain.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ambBus);
    src.start(0);
    return gain;
  }

  function hum(ac) {
    const gain = ac.createGain();
    gain.gain.value = 0.0001;
    gain.connect(ambBus);
    for (const freq of [196, 198.4]) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ac.currentTime || 0);
      osc.connect(gain);
      osc.start(0);
    }
    return gain;
  }

  function resume(ac) {
    if (ac && ac.state === 'suspended' && ac.resume) {
      const pending = ac.resume();
      if (pending && pending.catch) pending.catch(() => {});
    }
  }

  function ensure() {
    if (ctx || !AC) return ctx;
    try {
      const ac = new AC();
      master = ac.createGain();
      music = ac.createGain();
      sfxBus = ac.createGain();
      tension = ac.createGain();
      master.gain.value = mix.muted ? 0 : mix.master;
      music.gain.value = mix.music;
      sfxBus.gain.value = mix.sfx;
      tension.gain.value = tensionOn ? 1 : 0;
      ruralBus = ac.createGain();
      cityBus = ac.createGain();
      ambBus = ac.createGain();
      workBus = ac.createGain();
      ruralBus.gain.value = ruralLevel;
      cityBus.gain.value = cityLevel;
      ambBus.gain.value = 1;
      workBus.gain.value = 1;
      noise = makeNoise(ac);
      beds = {
        insects: bed(ac, 'highpass', 3800, 0.6),
        river: bed(ac, 'lowpass', 420, 0.7),
        traffic: bed(ac, 'bandpass', 900, 0.8),
        gulls: bed(ac, 'bandpass', 2400, 3),
        neon: hum(ac)
      };
      tension.connect(music);
      ruralBus.connect(music);
      cityBus.connect(music);
      ambBus.connect(music);
      music.connect(master);
      workBus.connect(sfxBus);
      sfxBus.connect(master);
      master.connect(ac.destination);
      ctx = ac;
      applyZones();
      return ctx;
    } catch (e) {
      ctx = null;
      return null;
    }
  }

  function apply() {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(mix.muted ? 0 : mix.master, now, 0.03);
    music.gain.setTargetAtTime(mix.music, now, 0.03);
    sfxBus.gain.setTargetAtTime(mix.sfx, now, 0.03);
    tension.gain.setTargetAtTime(tensionOn ? 1 : 0, now, 0.35);
  }

  function persist() {
    saveMix(storage, mix);
  }

  function samplePlace() {
    const heard = zoneMix(place.x, place.y);
    ruralLevel = heard.rural;
    cityLevel = heard.city;
    flavors = heard.flavors;
    return heard;
  }

  function applyZones() {
    if (!ctx || !ruralBus || !cityBus) return;
    const heard = samplePlace();
    const now = ctx.currentTime;
    ruralBus.gain.setTargetAtTime(ruralLevel, now, 0.4);
    cityBus.gain.setTargetAtTime(cityLevel, now, 0.4);
    const levels = ambienceLevels(heard, nightOn);
    for (const key of Object.keys(beds || {})) {
      const level = levels[key] || 0;
      beds[key].gain.setTargetAtTime(level > 0 ? level : 0.0001, now, 0.35);
    }
  }

  function voice(when, note) {
    const ac = ctx;
    if (!ac || !note) return;
    const dest = note.bus === 'sfx' ? sfxBus
      : note.bus === 'tension' ? tension
      : note.bus === 'city' ? cityBus
      : note.bus === 'work' ? workBus
      : note.bus === 'amb' ? ambBus
      : ruralBus;
    const dur = Math.max(0.04, note.dur || 0.1);
    const peak = Math.max(0.0002, note.gain || 0.02);
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    amp.connect(dest);

    let node;
    if (note.wave === 'noise') {
      node = ac.createBufferSource();
      node.buffer = noise;
      node.loop = true;
    } else {
      node = ac.createOscillator();
      node.type = note.wave || 'sine';
      node.frequency.setValueAtTime(note.freq || 440, when);
      if (note.freqTo) node.frequency.linearRampToValueAtTime(note.freqTo, when + dur);
    }

    let out = node;
    if (note.filter && ac.createBiquadFilter) {
      const filter = ac.createBiquadFilter();
      filter.type = note.filter.type || 'lowpass';
      filter.frequency.setValueAtTime(note.filter.freq || 800, when);
      if (note.filter.freqTo) filter.frequency.linearRampToValueAtTime(note.filter.freqTo, when + dur);
      filter.Q.setValueAtTime(note.filter.q == null ? 0.7 : note.filter.q, when);
      node.connect(filter);
      out = filter;
    }
    out.connect(amp);
    node.start(when);
    node.stop(when + dur + 0.03);
  }

  function pump() {
    if (!ctx || mix.muted) return;
    const horizon = ctx.currentTime + 0.28;
    let guard = 0;
    while (nextTime < horizon && guard < LOOP_STEPS) {
      const notes = notesForStep(step);
      for (let i = 0; i < notes.length; i++) voice(nextTime + (notes[i].at || 0), notes[i]);
      if ((workBuild || workDemo) && step % 8 === 0) {
        voice(nextTime, {
          bus: 'work',
          wave: workDemo && !workBuild ? 'sine' : 'triangle',
          freq: workDemo && !workBuild ? 70 : WORK_HZ,
          dur: 0.08,
          gain: 0.07
        });
      }
      step = (step + 1) % LOOP_STEPS;
      nextTime += STEP_DUR;
      guard += 1;
    }
    guard = 0;
    while (cityNext < horizon && guard < LOOP_STEPS) {
      if (cityLevel > 0.04) {
        const live = Object.entries(flavors).filter((pair) => pair[1] >= 0.08);
        const list = live.length ? live : [['downtown', cityLevel]];
        for (let f = 0; f < list.length; f++) {
          const weight = list[f][1];
          const notes = cityNotesForStep(cityStep, list[f][0]);
          for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            voice(cityNext + (note.at || 0), Object.assign({}, note, {
              gain: Math.max(0.0002, (note.gain || 0.02) * Math.min(1, weight))
            }));
          }
        }
      }
      cityStep = (cityStep + 1) % LOOP_STEPS;
      cityNext += CITY_STEP;
      guard += 1;
    }
  }

  function play(name) {
    const ac = ensure();
    if (!ac || mix.muted || mix.master <= 0 || mix.sfx <= 0) return;
    resume(ac);
    const recipe = SFX[name];
    if (!recipe) return;
    const t0 = ac.currentTime;
    for (let i = 0; i < recipe.length; i++) voice(t0 + (recipe[i].at || 0), recipe[i].bus ? recipe[i] : Object.assign({ bus: 'sfx' }, recipe[i]));
  }

  function throttled(name, gap, stamp) {
    const ac = ensure();
    const now = ac ? ac.currentTime : 0;
    if (now - stamp.value < gap) return;
    stamp.value = now;
    play(name);
  }

  const departStamp = { value: -1 };
  const arriveStamp = { value: -1 };

  function setMuted(muted) {
    mix.muted = !!muted;
    persist();
    if (mix.muted) {
      if (timer != null) clear(timer);
      timer = null;
    }
    apply();
    if (!mix.muted) api.start();
    return mix.muted;
  }

  const api = {
    get mix() { return mix; },
    get muted() { return mix.muted; },
    start() {
      const ac = ensure();
      if (!ac) return;
      resume(ac);
      apply();
      if (timer != null || mix.muted) return;
      nextTime = ac.currentTime + 0.05;
      cityNext = ac.currentTime + 0.05;
      pump();
      timer = schedule(pump, 90);
    },
    stop() {
      if (timer != null) clear(timer);
      timer = null;
    },
    toggle() {
      return setMuted(!mix.muted);
    },
    setMuted,
    setMaster(v) {
      mix.master = clamp01(v);
      persist();
      apply();
    },
    setMusic(v) {
      mix.music = clamp01(v);
      persist();
      apply();
    },
    setSfx(v) {
      mix.sfx = clamp01(v);
      persist();
      apply();
    },
    setTension(on) {
      tensionOn = !!on;
      if (tension && ctx) tension.gain.setTargetAtTime(tensionOn ? 1 : 0, ctx.currentTime, 0.35);
    },
    followCamera(x, y, night) {
      if (Number.isFinite(x)) place.x = x;
      if (Number.isFinite(y)) place.y = y;
      nightOn = !!night;
      samplePlace();
      applyZones();
    },
    setWork(building, demolishing) {
      workBuild = !!building;
      workDemo = !!demolishing;
    },
    get sceneMix() {
      return { rural: ruralLevel, city: cityLevel, flavors, night: nightOn, x: place.x, y: place.y };
    },
    play,
    build() { play('build'); },
    truckDepart() { throttled('truckDepart', 0.12, departStamp); },
    truckArrive() { throttled('truckArrive', 0.1, arriveStamp); },
    cashDirty() { play('cashDirty'); },
    cashClean() { play('cashClean'); },
    launder() { play('launder'); },
    siren() { play('siren'); },
    bribe() { play('bribe'); },
    research() { play('research'); },
    click() { play('click'); },
    coin() { play('cashClean'); },
    unlock() { play('unlock'); },
    buy() { play('buy'); },
    convert() { play('convert'); },
    demolish() { play('demolish'); },
    negotiateOk() { play('negotiateOk'); },
    negotiateFail() { play('negotiateFail'); },
    intimidate() { play('intimidate'); },
    intimidateFail() { play('intimidateFail'); },
    control() { play('control'); },
    cue(evt) {
      if (!evt || !evt.type) return;
      if (evt.type === 'built') api.build();
      else if (evt.type === 'truck_departed') api.truckDepart();
      else if (evt.type === 'truck_delivered') api.truckArrive();
      else if (evt.type === 'exported') {
        if (evt.earnedDirty) api.cashDirty();
        if (evt.earnedClean) api.cashClean();
      } else if (evt.type === 'laundered') api.launder();
      else if (evt.type === 'raid_started' || evt.type === 'rival_raid') api.siren();
      else if (evt.type === 'bribed') api.bribe();
      else if (evt.type === 'research') api.research();
      else if (evt.type === 'zone_unlocked') api.unlock();
      else if (evt.type === 'lot_bought') api.buy();
      else if (evt.type === 'converted') api.convert();
      else if (evt.type === 'demolish_started') api.demolish();
      else if (evt.type === 'build_started') api.build();
      else if (evt.type === 'negotiate_ok') api.negotiateOk();
      else if (evt.type === 'negotiate_fail') api.negotiateFail();
      else if (evt.type === 'intimidate_ok') api.intimidate();
      else if (evt.type === 'intimidate_fail') api.intimidateFail();
      else if (evt.type === 'control_gained') api.control();
    }
  };

  return api;
}

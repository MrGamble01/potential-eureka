/* ============================================
   EUREKA AUDIO — one soundtrack for the flagships.

   Original music and effects, synthesized in the
   browser with the Web Audio API. No samples, no
   third-party assets, no extra libraries. The
   four moods (calm, busy, tense, victory) and the
   five cues (build, buy, harvest, level up, fail)
   were written for these games.

   Nothing plays until the first tap or key. iOS
   and Android ignore audio that starts by itself,
   and resume() only sticks when it happens inside
   that gesture. Volume and mute are the shared
   settings document, so one slider covers every
   game that mounts it.

   The sequencer is a slow timer, not the frame
   loop, and it never builds noise buffers. A
   hidden tab stops the timer. That keeps the
   score off the phone's render budget.
   ============================================ */

(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  try {
    if (root && root.document) root.EurekaAudio = exported.create(root);
  } catch (e) { /* audio is optional — a game still runs silent */ }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LICENSE = 'Original synthesis via the Web Audio API. No samples and no third-party audio assets.';
  const MOOD_NAMES = ['calm', 'busy', 'tense', 'victory'];
  const SFX_NAMES = ['build', 'buy', 'harvest', 'levelup', 'fail'];
  const MOOD_LABEL = { calm: 'Calm', busy: 'Busy', tense: 'Tense', victory: 'Victory' };
  const SCHEDULER_MS = 120;
  const LOOKAHEAD = 0.2;
  const VOICE_CAP = 10;

  // Degrees are semitones above the mood's root. Chords are the bed,
  // the scale is the lead. Written out so a mood change is a retune,
  // not a new file.
  const MOOD = {
    calm: {
      bpm: 74,
      root: 196,
      scale: [0, 2, 4, 7, 9],
      chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [2, 7, 11]],
      density: 0.34,
      wave: 'sine',
      lead: 'triangle',
      filter: 880,
      pad: 0.028,
      bass: 0.05,
      stab: 0.02,
      leadGain: 0.03,
    },
    busy: {
      bpm: 116,
      root: 220,
      scale: [0, 2, 4, 7, 9, 12],
      chords: [[0, 4, 7], [0, 5, 9], [2, 7, 11], [4, 7, 12]],
      density: 0.7,
      wave: 'triangle',
      lead: 'square',
      filter: 1700,
      pad: 0.022,
      bass: 0.055,
      stab: 0.018,
      leadGain: 0.026,
    },
    tense: {
      bpm: 92,
      root: 146.83,
      scale: [0, 1, 3, 5, 7, 8, 10],
      chords: [[0, 3, 6], [0, 1, 7], [5, 8, 12], [3, 6, 10]],
      density: 0.48,
      wave: 'sawtooth',
      lead: 'triangle',
      filter: 640,
      pad: 0.02,
      bass: 0.06,
      stab: 0.016,
      leadGain: 0.024,
    },
    victory: {
      bpm: 128,
      root: 261.63,
      scale: [0, 2, 4, 7, 9, 12],
      chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7, 12]],
      density: 0.82,
      wave: 'triangle',
      lead: 'square',
      filter: 2200,
      pad: 0.026,
      bass: 0.05,
      stab: 0.022,
      leadGain: 0.03,
    },
  };

  const RECIPES = {
    build: [
      { f: 196, d: 0.07, type: 'square', v: 0.16, slide: 140 },
      { f: 392, d: 0.1, type: 'square', v: 0.12, at: 0.06 },
    ],
    buy: [
      { f: 880, d: 0.05, type: 'square', v: 0.11 },
      { f: 1320, d: 0.1, type: 'square', v: 0.09, at: 0.05 },
    ],
    harvest: [
      { f: 523, d: 0.1, type: 'triangle', v: 0.15 },
      { f: 659, d: 0.1, type: 'triangle', v: 0.13, at: 0.07 },
      { f: 784, d: 0.16, type: 'triangle', v: 0.13, at: 0.14 },
    ],
    levelup: [
      { f: 523, d: 0.11, type: 'triangle', v: 0.15 },
      { f: 659, d: 0.11, type: 'triangle', v: 0.14, at: 0.08 },
      { f: 784, d: 0.11, type: 'triangle', v: 0.14, at: 0.16 },
      { f: 1047, d: 0.2, type: 'triangle', v: 0.15, at: 0.24 },
    ],
    fail: [
      { f: 311, d: 0.12, type: 'sawtooth', v: 0.1, slide: 196 },
      { f: 174, d: 0.22, type: 'sawtooth', v: 0.1, slide: 90, at: 0.11 },
    ],
  };

  const COOL_MS = { build: 90, buy: 90, harvest: 140, levelup: 280, fail: 200 };

  function clamp01(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.min(1, Math.max(0, x));
  }

  function create(win, opts) {
    win = win || {};
    opts = opts || {};
    const clock = typeof opts.now === 'function' ? opts.now : function () { return Date.now(); };
    const setInt = win.setInterval || setInterval;
    const clearInt = win.clearInterval || clearInterval;

    let ctx = null;
    let graph = false;
    let musicBus = null;
    let sfxBus = null;
    let musicFilter = null;
    let pad = null;
    let timer = null;
    let playing = false;
    let unlocked = false;
    let mood = 'calm';
    let victoryUntil = 0;
    let nextNoteTime = 0;
    let step = 0;
    let rng = 0x6d2b79f5;
    let readoutEl = null;
    const voiceEnds = [];
    const lastSfx = {};
    let localMuted = function () { return false; };
    let localMusicOff = function () { return false; };
    const gestures = ['pointerdown', 'touchstart', 'touchend', 'keydown'];

    function rand() {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng / 4294967296;
    }

    function levels() {
      let muted = false;
      let musicOff = false;
      try { muted = !!localMuted(); } catch (e) { muted = false; }
      try { musicOff = !!localMusicOff(); } catch (e) { musicOff = false; }
      let sfx = muted ? 0 : 1;
      let music = (muted || musicOff) ? 0 : 1;
      try {
        const persist = win.EurekaPersist;
        if (persist && persist.audio) {
          sfx = clamp01(persist.audio.sfx(muted));
          music = clamp01(persist.audio.music(muted, musicOff));
        }
      } catch (e) { /* keep the local read */ }
      return { sfx: sfx, music: music };
    }

    function setGain(param, value, t) {
      if (!param) return;
      try {
        if (param.setTargetAtTime) param.setTargetAtTime(Math.max(0, value), t, 0.04);
        else param.value = value;
      } catch (e) {
        try { param.value = value; } catch (e2) { /* a mock without a value still plays */ }
      }
    }

    function buildGraph() {
      if (graph || !ctx) return;
      const master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      let tail = master;
      if (ctx.createDynamicsCompressor) {
        const comp = ctx.createDynamicsCompressor();
        try {
          comp.threshold.value = -20;
          comp.knee.value = 16;
          comp.ratio.value = 3;
          comp.attack.value = 0.004;
          comp.release.value = 0.18;
        } catch (e) { /* defaults are fine */ }
        comp.connect(master);
        tail = comp;
      }
      musicBus = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus.gain.value = 0.0001;
      sfxBus.gain.value = 0.0001;
      if (ctx.createBiquadFilter) {
        musicFilter = ctx.createBiquadFilter();
        musicFilter.type = 'lowpass';
        musicFilter.frequency.value = MOOD[mood].filter;
        musicFilter.connect(tail);
        musicBus.connect(musicFilter);
      } else {
        musicBus.connect(tail);
      }
      sfxBus.connect(tail);
      graph = true;
      applyBus(levels());
    }

    function applyBus(lv) {
      if (!ctx || !graph) return;
      const t = ctx.currentTime;
      setGain(musicBus && musicBus.gain, lv.music, t);
      setGain(sfxBus && sfxBus.gain, lv.sfx, t);
    }

    function paintReadout() {
      if (!readoutEl) return;
      const lv = levels();
      let text;
      if (lv.sfx <= 0 && lv.music <= 0) text = 'Score: muted';
      else if (lv.music <= 0) text = 'Score: off';
      else text = 'Score: ' + (MOOD_LABEL[mood] || 'Calm');
      if (readoutEl.textContent !== text) readoutEl.textContent = text;
    }

    function voice(freq, when, dur, type, vol, bus, slide) {
      if (!ctx || !bus || !(vol > 0) || !(freq > 0) || !(dur > 0)) return false;
      const now = ctx.currentTime;
      let live = 0;
      for (let i = voiceEnds.length - 1; i >= 0; i--) {
        if (voiceEnds[i] <= now) voiceEnds.splice(i, 1);
        else live++;
      }
      if (live >= VOICE_CAP) return false;
      if (when < now) when = now;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      const f0 = Math.max(1, freq);
      osc.frequency.setValueAtTime(f0, when);
      if (slide && osc.frequency.exponentialRampToValueAtTime) {
        try { osc.frequency.exponentialRampToValueAtTime(Math.max(1, slide), when + dur); } catch (e) { /* stay on the first pitch */ }
      }
      const peak = Math.max(0.0002, vol);
      g.gain.setValueAtTime(0.0001, when);
      const attack = Math.min(0.02, dur * 0.35);
      if (g.gain.exponentialRampToValueAtTime) {
        g.gain.exponentialRampToValueAtTime(peak, when + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      } else {
        g.gain.setValueAtTime(peak, when);
      }
      osc.connect(g);
      g.connect(bus);
      osc.start(when);
      try { osc.stop(when + dur + 0.03); } catch (e) { /* already stopped */ }
      voiceEnds.push(when + dur);
      return true;
    }

    function ensurePad() {
      if (pad || !ctx || !musicBus) return;
      const m = MOOD[mood];
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.connect(musicBus);
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = 'sine';
      b.type = 'sine';
      a.frequency.setValueAtTime(m.root, ctx.currentTime);
      b.frequency.setValueAtTime(m.root * 1.498, ctx.currentTime);
      if (b.detune && b.detune.setValueAtTime) {
        try { b.detune.setValueAtTime(7, ctx.currentTime); } catch (e) { /* detune is optional */ }
      }
      a.connect(g);
      b.connect(g);
      a.start(ctx.currentTime);
      b.start(ctx.currentTime);
      pad = { a: a, b: b, g: g };
      setGain(g.gain, m.pad, ctx.currentTime);
      if (musicFilter && musicFilter.frequency) {
        try { musicFilter.frequency.setTargetAtTime(m.filter, ctx.currentTime, 0.2); } catch (e) { musicFilter.frequency.value = m.filter; }
      }
    }

    function silencePad() {
      if (!pad) return;
      const dying = pad;
      pad = null;
      try {
        if (ctx && dying.g && dying.g.gain) setGain(dying.g.gain, 0.0001, ctx.currentTime);
        const stopAt = ctx ? ctx.currentTime + 0.18 : 0;
        dying.a.stop(stopAt);
        dying.b.stop(stopAt);
      } catch (e) { /* stopping a dead pad is fine */ }
    }

    function glidePad() {
      if (!pad || !ctx) return;
      const m = MOOD[mood];
      const t = ctx.currentTime;
      try {
        pad.a.frequency.cancelScheduledValues(t);
        pad.a.frequency.setValueAtTime(Math.max(1, pad.a.frequency.value || m.root), t);
        pad.a.frequency.exponentialRampToValueAtTime(m.root, t + 0.8);
        pad.b.frequency.cancelScheduledValues(t);
        pad.b.frequency.setValueAtTime(Math.max(1, pad.b.frequency.value || m.root * 1.5), t);
        pad.b.frequency.exponentialRampToValueAtTime(m.root * 1.498, t + 0.8);
      } catch (e) {
        try {
          pad.a.frequency.setValueAtTime(m.root, t);
          pad.b.frequency.setValueAtTime(m.root * 1.498, t);
        } catch (e2) { /* the next note still retunes */ }
      }
      setGain(pad.g.gain, m.pad, t);
      if (musicFilter && musicFilter.frequency) {
        try {
          if (musicFilter.frequency.setTargetAtTime) musicFilter.frequency.setTargetAtTime(m.filter, t, 0.25);
          else musicFilter.frequency.value = m.filter;
        } catch (e) { /* filter stays where it was */ }
      }
    }

    function scheduleBeat(time) {
      const m = MOOD[mood];
      const beat = step % 4;
      const chord = m.chords[Math.floor(step / 4) % m.chords.length];
      if (beat === 0) {
        const bassDeg = chord[0];
        voice(m.root * Math.pow(2, bassDeg / 12) * 0.5, time, 0.26, 'triangle', m.bass, musicBus);
        for (let i = 0; i < chord.length; i++) {
          voice(m.root * Math.pow(2, chord[i] / 12), time, 0.5, m.wave, m.stab, musicBus);
        }
      }
      if (rand() < m.density) {
        const deg = m.scale[(step + chord[0]) % m.scale.length];
        const oct = (step % 8) < 4 ? 1 : 2;
        voice(m.root * Math.pow(2, deg / 12) * oct, time, 0.14, m.lead, m.leadGain, musicBus);
      }
      if ((mood === 'busy' || mood === 'victory') && beat === 2) {
        voice(1760, time, 0.03, 'square', 0.01, musicBus);
      }
      step++;
    }

    function pump() {
      try {
        if (!ctx || !playing) return;
        if (ctx.state === 'suspended') {
          try {
            const pending = ctx.resume();
            if (pending && pending.catch) pending.catch(function () {});
          } catch (e) { /* resume outside a gesture is ignored */ }
          return;
        }
        const lv = levels();
        applyBus(lv);
        paintReadout();
        if (lv.music <= 0.001) {
          silencePad();
          return;
        }
        ensurePad();
        if (nextNoteTime < ctx.currentTime) nextNoteTime = ctx.currentTime + 0.05;
        const horizon = ctx.currentTime + LOOKAHEAD;
        let guard = 0;
        while (nextNoteTime < horizon && guard++ < 5) {
          scheduleBeat(nextNoteTime);
          nextNoteTime += 60 / MOOD[mood].bpm;
        }
      } catch (e) { /* a bad node must not take the page down */ }
    }

    function armScheduler() {
      if (timer != null || !playing || !ctx) return;
      timer = setInt(pump, SCHEDULER_MS);
    }

    function disarm() {
      if (timer == null) return;
      clearInt(timer);
      timer = null;
    }

    let parked = false;

    function park() {
      if (parked) return;
      parked = true;
      disarm();
      silencePad();
    }

    function unpark() {
      if (!parked) return;
      parked = false;
      if (playing && unlocked) {
        if (ctx) nextNoteTime = ctx.currentTime + 0.05;
        armScheduler();
      }
    }

    function onVis() {
      let hidden = false;
      try { hidden = !!(win.document && win.document.hidden); } catch (e) { hidden = false; }
      if (hidden) park();
      else if (!win.EurekaFocus || !win.EurekaFocus.held()) unpark();
    }

    function unlock() {
      if (unlocked && ctx && ctx.state === 'running') return true;
      const AC = win.AudioContext || win.webkitAudioContext;
      if (!AC) return false;
      try {
        if (!ctx) ctx = new AC();
      } catch (e) {
        ctx = null;
        return false;
      }
      buildGraph();
      try {
        if (ctx.state === 'suspended' && ctx.resume) {
          const pending = ctx.resume();
          if (pending && pending.catch) pending.catch(function () {});
        }
      } catch (e) { /* the next gesture tries again */ }
      unlocked = true;
      if (playing) armScheduler();
      paintReadout();
      return true;
    }

    function onGesture() {
      const ok = unlock();
      if (!ok) return;
      gestures.forEach(function (type) {
        try { win.removeEventListener(type, onGesture, true); } catch (e) { /* already gone */ }
        try {
          if (win.document) win.document.removeEventListener(type, onGesture, true);
        } catch (e2) { /* already gone */ }
      });
    }

    function listen(target) {
      if (!target || !target.addEventListener) return;
      gestures.forEach(function (type) {
        try {
          target.addEventListener(type, onGesture, { capture: true, passive: true });
        } catch (e) {
          try { target.addEventListener(type, onGesture, true); } catch (e2) { /* no gestures here */ }
        }
      });
    }

    listen(win);
    listen(win.document);
    try {
      if (win.document && win.document.addEventListener) {
        win.document.addEventListener('visibilitychange', onVis);
      }
    } catch (e) { /* visibility is an optimization */ }
    try {
      if (win.EurekaPersist && win.EurekaPersist.settings && win.EurekaPersist.settings.subscribe) {
        win.EurekaPersist.settings.subscribe(function () { applyBus(levels()); paintReadout(); });
      }
    } catch (e) { /* pump still reads the levels */ }

    function bind(next) {
      next = next || {};
      if (typeof next.muted === 'function') localMuted = next.muted;
      if (typeof next.musicOff === 'function') localMusicOff = next.musicOff;
      applyBus(levels());
      paintReadout();
    }

    function setMood(name, moodOpts) {
      if (!MOOD[name]) return false;
      moodOpts = moodOpts || {};
      const now = clock();
      if (moodOpts.force) victoryUntil = 0;
      if (moodOpts.hold) victoryUntil = Math.max(victoryUntil, now + moodOpts.hold * 1000);
      if (!moodOpts.force && name !== 'victory' && victoryUntil > now) return true;
      if (mood === name) {
        paintReadout();
        return true;
      }
      mood = name;
      glidePad();
      paintReadout();
      return true;
    }

    function celebrate(seconds) {
      const hold = Number(seconds);
      return setMood('victory', { force: true, hold: Number.isFinite(hold) ? hold : 8 });
    }

    function sfx(name) {
      const recipe = RECIPES[name];
      if (!recipe) return false;
      const now = clock();
      const cool = COOL_MS[name] || 100;
      if (lastSfx[name] != null && now - lastSfx[name] < cool) return false;
      if (!ctx) return false;
      const lv = levels();
      if (lv.sfx <= 0) return false;
      buildGraph();
      applyBus(lv);
      if (ctx.state === 'suspended') {
        try {
          const pending = ctx.resume();
          if (pending && pending.catch) pending.catch(function () {});
        } catch (e) { /* still play into the queue once it runs */ }
      }
      const t0 = ctx.currentTime;
      let played = false;
      for (let i = 0; i < recipe.length; i++) {
        const n = recipe[i];
        if (voice(n.f, t0 + (n.at || 0), n.d, n.type, n.v, sfxBus, n.slide)) played = true;
      }
      if (played) lastSfx[name] = now;
      return played;
    }

    function start(initial) {
      if (initial && MOOD[initial] && !playing) mood = initial;
      playing = true;
      if (unlocked) armScheduler();
      paintReadout();
      return true;
    }

    function stop() {
      playing = false;
      disarm();
      silencePad();
      paintReadout();
    }

    function pickMood(flags) {
      flags = flags || {};
      if (flags.victory) return 'victory';
      if (flags.tense) return 'tense';
      if (flags.busy) return 'busy';
      return 'calm';
    }

    function attachReadout(el) {
      if (!el || !win.document || !win.document.createElement) return null;
      let node = null;
      try { if (el.querySelector) node = el.querySelector('[data-ea="mood"]'); } catch (e) { node = null; }
      if (!node) {
        node = win.document.createElement('div');
        node.setAttribute('data-ea', 'mood');
        try { node.style.cssText = 'font:11px/1.4 inherit;opacity:.8;padding-top:2px'; } catch (e) { /* style is cosmetic */ }
        try { el.appendChild(node); } catch (e2) { /* the label is optional */ }
      }
      readoutEl = node;
      paintReadout();
      return node;
    }

    return {
      start: start,
      stop: stop,
      setMood: setMood,
      celebrate: celebrate,
      sfx: sfx,
      unlock: unlock,
      bind: bind,
      pickMood: pickMood,
      attachReadout: attachReadout,
      mood: function () { return mood; },
      playing: function () { return playing; },
      park: park,
      unpark: unpark,
      unlocked: function () { return unlocked; },
      pump: pump,
      context: function () { return ctx; },
      MOODS: MOOD_NAMES.slice(),
      SFX: SFX_NAMES.slice(),
    };
  }

  return {
    create: create,
    LICENSE: LICENSE,
    MOODS: MOOD_NAMES.slice(),
    SFX: SFX_NAMES.slice(),
    SCHEDULER_MS: SCHEDULER_MS,
  };
});

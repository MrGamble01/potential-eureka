/* ============================================
   SFX — tiny synthesized sound effects for the
   in-page arcade games. No audio files; all tones
   are generated with Web Audio on demand. Global
   mute persists in localStorage ('arcade-muted').
   ============================================ */

const SFX = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('arcade-muted') === '1'; } catch {}

  // The AudioContext can only start after a user gesture; create/resume lazily.
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // A single enveloped oscillator tone.
  function tone(freq, dur, { type = 'square', gain = 0.14, slideTo = null, delay = 0 } = {}) {
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    eat:    () => tone(680, 0.08, { type: 'square', gain: 0.12 }),
    bonus:  () => { tone(880, 0.09, { type: 'square' }); tone(1320, 0.12, { type: 'square', delay: 0.09 }); },
    die:    () => tone(300, 0.4, { type: 'sawtooth', gain: 0.16, slideTo: 70 }),
    move:   () => tone(220, 0.03, { type: 'square', gain: 0.05 }),
    rotate: () => tone(440, 0.04, { type: 'square', gain: 0.06 }),
    lock:   () => tone(160, 0.07, { type: 'square', gain: 0.11, slideTo: 110 }),
    clear:  () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, { type: 'square', gain: 0.11, delay: i * 0.05 })); },
    over:   () => { [440, 349, 262].forEach((f, i) => tone(f, 0.22, { type: 'sawtooth', gain: 0.14, delay: i * 0.14 })); },
    start:  () => { tone(523, 0.08, { type: 'square' }); tone(784, 0.1, { type: 'square', delay: 0.08 }); },
  };

  function play(name) {
    if (muted) return;
    const fn = SOUNDS[name];
    if (fn) try { fn(); } catch {}
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('arcade-muted', muted ? '1' : '0'); } catch {}
  }
  function toggle() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }

  return { play, setMuted, toggle, isMuted };
})();

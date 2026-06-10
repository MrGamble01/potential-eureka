/* ============================================
   SOUND — Web Audio API retro synthesized SFX
   ============================================ */

const Sound = (() => {
  let ctx = null;
  let master = null;
  let muted = localStorage.getItem('sound-muted') === 'true';

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.12;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function play(fn) {
    if (muted) return;
    try { fn(getCtx(), master); } catch (_) {}
  }

  function osc(c, out, type, freq, startGain, t0, dur) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(startGain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function sweep(c, out, type, f0, f1, startGain, t0, dur) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(startGain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  return {
    get muted() { return muted; },

    toggle() {
      muted = !muted;
      localStorage.setItem('sound-muted', String(muted));
      document.querySelectorAll('.sound-toggle-btn').forEach(b => {
        b.textContent = muted ? 'SFX: OFF' : 'SFX: ON';
        b.style.color = muted ? '' : 'var(--green)';
        b.style.borderColor = muted ? '' : 'var(--green)';
      });
      return muted;
    },

    initBtn(el) {
      if (!el) return;
      el.textContent = muted ? 'SFX: OFF' : 'SFX: ON';
      el.style.color = muted ? '' : 'var(--green)';
      el.style.borderColor = muted ? '' : 'var(--green)';
    },

    // Snake: eat regular food
    eat() {
      play((c, out) => osc(c, out, 'square', 523, 0.7, c.currentTime, 0.06));
    },

    // Snake: eat bonus (gold) food — ascending triple blip
    bonus() {
      play((c, out) => {
        [523, 659, 784].forEach((freq, i) => {
          const t = c.currentTime + i * 0.07;
          osc(c, out, 'square', freq, 0.6, t, 0.12);
        });
      });
    },

    // Snake/Tetris: level up — short ascending fanfare
    levelUp() {
      play((c, out) => {
        [261, 329, 392, 523].forEach((freq, i) => {
          osc(c, out, 'square', freq, 0.5, c.currentTime + i * 0.09, 0.18);
        });
      });
    },

    // Snake/Tetris: game over — descending wail
    gameOver() {
      play((c, out) => sweep(c, out, 'sawtooth', 440, 55, 0.7, c.currentTime, 0.9));
    },

    // Tetris: piece rotates — quiet tick
    rotate() {
      play((c, out) => osc(c, out, 'square', 880, 0.3, c.currentTime, 0.03));
    },

    // Tetris: piece locks — low thud
    lock() {
      play((c, out) => sweep(c, out, 'sine', 120, 55, 0.8, c.currentTime, 0.1));
    },

    // Tetris: line clear — sweep intensity scales with line count; 4 lines = fanfare
    lineClear(n) {
      if (n >= 4) {
        play((c, out) => {
          const melody = [261, 329, 392, 523, 659, 784, 1047];
          melody.forEach((freq, i) => osc(c, out, 'square', freq, 0.6, c.currentTime + i * 0.055, 0.15));
        });
      } else {
        play((c, out) => {
          const f0 = 180 + n * 60;
          const f1 = 500 + n * 120;
          sweep(c, out, 'square', f0, f1, 0.6, c.currentTime, 0.08 + n * 0.04);
          if (n >= 2) osc(c, out, 'square', f1, 0.4, c.currentTime + 0.12, 0.1);
          if (n >= 3) osc(c, out, 'square', f1 * 1.25, 0.35, c.currentTime + 0.22, 0.12);
        });
      }
    },
  };
})();

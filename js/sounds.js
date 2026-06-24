/* ============================================
   SOUND ENGINE — Web Audio API chiptune sounds
   ============================================ */

const SoundEngine = (() => {
  let ctx = null;
  let muted = localStorage.getItem('sound-muted') === 'true';

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Play a sequence of [frequency, duration, volume?] notes
  function play(notes, waveType = 'square') {
    if (muted) return;
    const ac = getCtx();
    let t = ac.currentTime;
    notes.forEach(([freq, dur, vol = 0.25]) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.01);
      t += dur;
    });
  }

  // Frequency sweep (used for hold whoosh)
  function sweep(freqStart, freqEnd, dur, vol = 0.2, waveType = 'sine') {
    if (muted) return;
    const ac = getCtx();
    const t  = ac.currentTime;
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = waveType;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.linearRampToValueAtTime(freqEnd, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  // ── Snake sounds ──────────────────────────────────────────

  function eat() {
    play([[262, 0.05], [330, 0.07]]);
  }

  function eatBonus() {
    play([[440, 0.06], [554, 0.06], [659, 0.06], [880, 0.14]], 'triangle');
  }

  // ── Tetris sounds ─────────────────────────────────────────

  function rotate() {
    play([[440, 0.04, 0.15]]);
  }

  function hardDrop() {
    play([[200, 0.03, 0.4], [120, 0.08, 0.35]]);
  }

  function clearLines(n) {
    const seqs = [
      [[440, 0.10], [523, 0.14]],
      [[440, 0.08], [523, 0.08], [659, 0.14]],
      [[440, 0.07], [523, 0.07], [659, 0.07], [784, 0.18]],
      [[330, 0.06], [440, 0.06], [523, 0.06], [659, 0.06], [880, 0.06], [1047, 0.22]],
    ];
    play(seqs[Math.min(n - 1, 3)], n === 4 ? 'triangle' : 'square');
  }

  function hold() {
    sweep(659, 330, 0.12);
  }

  // ── Shared sounds ─────────────────────────────────────────

  function levelUp() {
    play([[330, 0.08], [440, 0.08], [523, 0.08], [659, 0.20]], 'triangle');
  }

  function died() {
    play([[262, 0.10, 0.3], [220, 0.10, 0.3], [185, 0.10, 0.3], [147, 0.30, 0.3]]);
  }

  // ── Mute control ──────────────────────────────────────────

  function toggleMute() {
    muted = !muted;
    localStorage.setItem('sound-muted', String(muted));
    _syncButtons();
  }

  function isMuted() { return muted; }

  function _syncButtons() {
    document.querySelectorAll('.sound-toggle-btn').forEach(btn => {
      btn.textContent    = `Sound: ${muted ? 'OFF' : 'ON'}`;
      btn.style.borderColor = muted ? '' : '#3FB950';
      btn.style.color       = muted ? '' : '#3FB950';
    });
  }

  function updateButtons() { _syncButtons(); }

  return { eat, eatBonus, rotate, hardDrop, clearLines, hold, levelUp, died, toggleMute, isMuted, updateButtons };
})();

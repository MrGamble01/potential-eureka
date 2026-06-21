/* ============================================
   GAME AUDIO — Web Audio API retro sound engine
   ============================================ */

const GameAudio = (() => {
  let ac = null;
  let muted = localStorage.getItem('game-muted') === '1';

  function getAC() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, duration, type, vol, delay) {
    if (muted) return;
    const ctx = getAC();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol || 0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch (e) {}
  }

  function seq(notes, step, type, vol) {
    step = step || 0.08;
    notes.forEach((f, i) => tone(f, step * 0.85, type, vol, i * step));
  }

  // Snake
  function snakeEat()     { tone(523, 0.06, 'square', 0.07); }
  function snakeBonus()   { seq([523, 659, 784, 1047], 0.06, 'square', 0.09); }
  function snakeLevelUp() { seq([330, 392, 494, 659, 880], 0.07, 'triangle', 0.07); }
  function snakeDie()     { seq([330, 277, 220, 185, 147], 0.09, 'sawtooth', 0.07); }

  // Tetris
  function tetrisMove()       { tone(200, 0.03, 'square', 0.04); }
  function tetrisRotate()     { tone(330, 0.04, 'square', 0.05); }
  function tetrisLock()       { tone(140, 0.10, 'square', 0.07); }
  function tetrisHardDrop()   { tone(100, 0.09, 'square', 0.09); }
  function tetrisHold()       { tone(392, 0.05, 'square', 0.06); }
  function tetrisGameOver()   { seq([330, 294, 247, 220, 185, 147], 0.10, 'sawtooth', 0.07); }
  function tetrisClear(lines) {
    if (lines >= 4) seq([523, 659, 784, 1047, 1319], 0.07, 'triangle', 0.10);
    else seq([330, 440, 523, 659].slice(0, lines + 1), 0.07, 'triangle', 0.09);
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem('game-muted', muted ? '1' : '0');
    document.querySelectorAll('.game-mute-btn').forEach(btn => {
      btn.textContent = muted ? '♪ OFF' : '♪ ON';
      btn.style.color = muted ? '' : 'var(--accent)';
      btn.style.borderColor = muted ? '' : 'var(--accent)';
    });
    return muted;
  }

  function applyMuteState() {
    document.querySelectorAll('.game-mute-btn').forEach(btn => {
      btn.textContent = muted ? '♪ OFF' : '♪ ON';
      btn.style.color = muted ? '' : 'var(--accent)';
      btn.style.borderColor = muted ? '' : 'var(--accent)';
    });
  }

  // Sync button states once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMuteState);
  } else {
    setTimeout(applyMuteState, 0);
  }

  return {
    snakeEat, snakeBonus, snakeLevelUp, snakeDie,
    tetrisMove, tetrisRotate, tetrisLock, tetrisHardDrop, tetrisHold, tetrisGameOver, tetrisClear,
    toggleMute, isMuted: () => muted,
  };
})();

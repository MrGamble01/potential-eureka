/* ============================================
   POMODORO MODULE
   ============================================ */

const Pomodoro = (() => {
  const POMO_MODES = {
    focus: { label: 'FOCUS', duration: 25 * 60 },
    short: { label: 'SHORT BREAK', duration: 5 * 60 },
    long:  { label: 'LONG BREAK', duration: 15 * 60 },
  };

  let pomoMode = 'focus';
  let pomoTime = POMO_MODES.focus.duration;
  let pomoRunning = false;
  let pomoInterval = null;
  let pomoSessions = parseInt(Utils.store.getRaw('eureka-pomo-sessions') || '0');

  function toggle() {
    if (pomoRunning) {
      pomoRunning = false;
      clearInterval(pomoInterval);
    } else {
      pomoRunning = true;
      pomoInterval = setInterval(pomoTick, 1000);
    }
    pomoUpdateUI();
  }

  function pomoTick() {
    pomoTime--;
    if (pomoTime <= 0) {
      pomoBeep();
      clearInterval(pomoInterval);
      pomoRunning = false;
      if (pomoMode === 'focus') {
        pomoSessions++;
        Utils.store.setRaw('eureka-pomo-sessions', pomoSessions);
        pomoMode = pomoSessions % 4 === 0 ? 'long' : 'short';
      } else {
        pomoMode = 'focus';
      }
      pomoTime = POMO_MODES[pomoMode].duration;
    }
    pomoUpdateUI();
  }

  function skip() {
    clearInterval(pomoInterval);
    pomoRunning = false;
    if (pomoMode === 'focus') {
      pomoSessions++;
      Utils.store.setRaw('eureka-pomo-sessions', pomoSessions);
      pomoMode = pomoSessions % 4 === 0 ? 'long' : 'short';
    } else {
      pomoMode = 'focus';
    }
    pomoTime = POMO_MODES[pomoMode].duration;
    pomoUpdateUI();
  }

  function reset() {
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoTime = POMO_MODES[pomoMode].duration;
    pomoUpdateUI();
  }

  function pomoUpdateUI() {
    const m = Math.floor(pomoTime / 60);
    const s = pomoTime % 60;
    const el = id => document.getElementById(id);
    const timeEl = el('pomo-time');
    if (timeEl) timeEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    const modeEl = el('pomo-mode');
    if (modeEl) {
      modeEl.textContent = POMO_MODES[pomoMode].label;
      modeEl.className = `pomo-mode-label pomo-${pomoMode}`;
    }

    const sessEl = el('pomo-sessions');
    if (sessEl) sessEl.textContent = pomoSessions;

    const btn = el('pomo-toggle');
    if (btn) btn.textContent = pomoRunning ? 'Pause' : 'Start';

    const total = POMO_MODES[pomoMode].duration;
    const pct = ((total - pomoTime) / total) * 100;
    const bar = el('pomo-progress');
    if (bar) {
      bar.style.width = `${pct}%`;
      bar.className = `pomo-fill pomo-${pomoMode}`;
    }
  }

  function pomoBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => {
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.frequency.value = 1100;
        g2.gain.setValueAtTime(0.3, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        o2.start(); o2.stop(ctx.currentTime + 0.5);
      }, 300);
    } catch {}
  }

  function init() {
    pomoUpdateUI();
  }

  return { init, toggle, skip, reset };
})();

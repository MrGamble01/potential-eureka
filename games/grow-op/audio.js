// Small original score and cues. No samples, so the page stays self-contained.
// Music is a quiet two-chord pulse with a shaker. Mute is instant.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let timer = null;
  let step = 0;
  try { muted = localStorage.getItem('growop-cartel-mute') === '1'; } catch (e) { muted = false; }

  function context() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function tone(freq, dur, type, gain, when) {
    const ac = context();
    if (!ac || muted) return;
    const t = when || ac.currentTime;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function loop() {
    if (muted) return;
    const ac = context();
    if (!ac) return;
    const roots = [110, 98, 87, 98];
    const root = roots[step % roots.length];
    tone(root, 0.42, 'sine', 0.05);
    tone(root * 1.5, 0.3, 'triangle', 0.03);
    if (step % 2 === 0) tone(1800, 0.03, 'square', 0.012);
    step += 1;
  }

  return {
    get muted() { return muted; },
    start() {
      const ac = context();
      if (ac && ac.state === 'suspended') ac.resume();
      if (timer || muted) return;
      loop();
      timer = setInterval(loop, 520);
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('growop-cartel-mute', muted ? '1' : '0'); } catch (e) { /* private mode */ }
      if (muted && timer) {
        clearInterval(timer);
        timer = null;
      } else if (!muted) {
        this.start();
      }
      return muted;
    },
    coin() { tone(660, 0.08, 'triangle', 0.05); tone(880, 0.1, 'sine', 0.04); },
    build() { tone(220, 0.12, 'square', 0.03); tone(330, 0.14, 'triangle', 0.04); },
    siren() {
      tone(520, 0.18, 'sawtooth', 0.03);
      tone(390, 0.22, 'sawtooth', 0.025);
    },
    click() { tone(480, 0.04, 'square', 0.02); }
  };
}

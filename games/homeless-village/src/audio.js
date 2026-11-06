// Small WebAudio bed. Phaser audio stays off so a missing device
// cannot throw during boot. Nothing here calls console.

import { SOUND_KEY } from './sim.js';

function noiseBuffer(ctx, seconds) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.96 + white * 0.04;
    data[i] = last * 2.2;
  }
  return buf;
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let fireGain = null;
  let windGain = null;
  let muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === '0'; } catch (e) { muted = false; }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    const fire = ctx.createBufferSource();
    fire.buffer = noiseBuffer(ctx, 1.5);
    fire.loop = true;
    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.value = 740;
    fireFilter.Q.value = 0.7;
    fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    fire.connect(fireFilter);
    fireFilter.connect(fireGain);
    fireGain.connect(master);
    fire.start();

    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer(ctx, 2);
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    wind.start();
    return ctx;
    } catch (e) {
      ctx = null;
      master = null;
      fireGain = null;
      windGain = null;
      return null;
    }
  }

  function tone(freq, dur, type, gain) {
    const ac = ensure();
    if (!ac || muted) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(SOUND_KEY, muted ? '0' : '1'); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    blip() { tone(520, 0.06, 'sine', 0.05); },
    chime() {
      tone(523, 0.18, 'sine', 0.06);
      setTimeout(() => tone(784, 0.22, 'sine', 0.05), 90);
    },
    warn() { tone(196, 0.28, 'triangle', 0.07); },
    setBed(fire, wind) {
      if (!ctx || !fireGain) return;
      const now = ctx.currentTime;
      const fg = fire ? 0.045 + Math.random() * 0.03 : 0;
      const wg = wind ? 0.03 + Math.random() * 0.02 : 0;
      fireGain.gain.cancelScheduledValues(now);
      windGain.gain.cancelScheduledValues(now);
      fireGain.gain.linearRampToValueAtTime(muted ? 0 : fg, now + 0.15);
      windGain.gain.linearRampToValueAtTime(muted ? 0 : wg, now + 0.2);
    }
  };
}

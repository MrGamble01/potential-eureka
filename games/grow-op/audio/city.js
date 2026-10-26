// 1980s Miami bed for Puerto Sol. Every neighborhood shares the
// Dm–Bb–F–C loop so two of them can crossfade without clashing.
// The variation is the register and the rhythm, not a different song.

import { STEPS_PER_BAR, BARS } from './pattern.js';

const ROOTS = [73.42, 116.54, 87.31, 65.41];

function hat(gain) {
  return {
    bus: 'city', wave: 'noise', dur: 0.03, gain,
    filter: { type: 'highpass', freq: 6200, q: 0.5 }
  };
}

export function cityNotesForStep(index, flavor) {
  const bar = Math.floor(index / STEPS_PER_BAR) % BARS;
  const step = index % STEPS_PER_BAR;
  const root = ROOTS[bar];
  const f = flavor || 'downtown';
  const notes = [];

  if (step === 0) {
    const bass = f === 'docks' ? root / 2 : f === 'hills' ? root * 2 : root;
    const cutoff = f === 'docks' ? 200 : f === 'downtown' ? 980 : f === 'airport' ? 1400 : 460;
    notes.push({
      bus: 'city',
      wave: f === 'downtown' || f === 'airport' ? 'sawtooth' : 'triangle',
      freq: bass,
      dur: f === 'hills' ? 1.5 : 0.42,
      gain: f === 'hills' ? 0.028 : 0.06,
      filter: { type: 'lowpass', freq: cutoff, q: 0.55 }
    });
  }

  if (f === 'downtown' && step % 2 === 0) {
    notes.push({
      bus: 'city', wave: 'square', freq: root * 8, dur: 0.05, gain: 0.018,
      filter: { type: 'lowpass', freq: 2600, q: 0.4 }
    });
  }
  if (f === 'airport' && step % 2 === 0) {
    notes.push({ bus: 'city', wave: 'square', freq: root * 4, dur: 0.04, gain: 0.02 });
  }
  if (f === 'beach' && (step === 4 || step === 12)) {
    notes.push({ bus: 'city', wave: 'sine', freq: root * 3.36, dur: 0.28, gain: 0.026 });
    notes.push({ bus: 'city', wave: 'sine', freq: root * 5.04, dur: 0.22, gain: 0.016 });
  }
  if (f === 'barrio' && (step === 3 || step === 6 || step === 10 || step === 14)) {
    notes.push({ bus: 'city', wave: 'triangle', freq: root * 3, dur: 0.09, gain: 0.03 });
  }
  if (f === 'docks' && (step === 4 || step === 12)) {
    notes.push({
      bus: 'city', wave: 'noise', dur: 0.12, gain: 0.03,
      filter: { type: 'bandpass', freq: 1700, q: 4 }
    });
  }
  if (f === 'hills' && step === 8) {
    notes.push({ bus: 'city', wave: 'sine', freq: root * 4, dur: 0.9, gain: 0.02 });
  }
  if (step % 4 === 2 && f !== 'hills') notes.push(hat(f === 'beach' ? 0.008 : 0.014));
  return notes;
}

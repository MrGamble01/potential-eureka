// Original 1980s Latin-tinged bed. Four bars of A minor
// (Am – F – C – E) under a son clave, a shaker, and a soft plucked chord.
// The tension bus is a dissonant layer the raid gain opens. No samples.

export const BPM = 96;
export const STEPS_PER_BAR = 16;
export const BARS = 4;
export const LOOP_STEPS = STEPS_PER_BAR * BARS;

export const PROGRESSION = [
  { name: 'Am', bass: 110, tones: [220, 261.63, 329.63] },
  { name: 'F', bass: 87.31, tones: [174.61, 220, 261.63] },
  { name: 'C', bass: 65.41, tones: [130.81, 164.81, 196] },
  { name: 'E', bass: 82.41, tones: [164.81, 207.65, 246.94] }
];

// Son clave, 3-2, on a 16th grid. Two bars, then it repeats.
export function isClave(bar, step) {
  if (bar % 2 === 0) return step === 0 || step === 6 || step === 12;
  return step === 4 || step === 8;
}

export function notesForStep(index) {
  const bar = Math.floor(index / STEPS_PER_BAR) % BARS;
  const step = index % STEPS_PER_BAR;
  const chord = PROGRESSION[bar];
  const notes = [];

  if (step === 0) {
    notes.push({ bus: 'music', wave: 'sine', freq: chord.tones[0] / 2, dur: 2.2, gain: 0.028 });
    notes.push({ bus: 'music', wave: 'sine', freq: (chord.tones[2] / 2) * 1.012, dur: 2.2, gain: 0.018 });
    notes.push({
      bus: 'music', wave: 'triangle', freq: chord.bass, dur: 0.36, gain: 0.1,
      filter: { type: 'lowpass', freq: 280, q: 0.7 }
    });
  } else if (step === 7) {
    notes.push({
      bus: 'music', wave: 'triangle', freq: chord.bass * 2, dur: 0.12, gain: 0.045,
      filter: { type: 'lowpass', freq: 420, q: 0.5 }
    });
  } else if (step === 10) {
    notes.push({
      bus: 'music', wave: 'sine', freq: chord.bass * 1.5, dur: 0.16, gain: 0.04,
      filter: { type: 'lowpass', freq: 480, q: 0.4 }
    });
  }

  if (isClave(bar, step)) {
    notes.push({
      bus: 'music', wave: 'square', freq: 980, dur: 0.04, gain: 0.032,
      filter: { type: 'bandpass', freq: 1500, q: 5 }
    });
  }

  if (step % 2 === 1) {
    notes.push({
      bus: 'music', wave: 'noise', dur: 0.04, gain: step % 4 === 3 ? 0.028 : 0.014,
      filter: { type: 'highpass', freq: 5200, q: 0.7 }
    });
  }

  if (step === 0 || step === 8) {
    chord.tones.forEach((freq, i) => {
      notes.push({ bus: 'music', wave: 'triangle', freq, dur: 0.22, gain: 0.026, at: i * 0.02 });
    });
  }

  if (step === 4 || step === 12) {
    notes.push({
      bus: 'music', wave: 'noise', dur: 0.14, gain: 0.02,
      filter: { type: 'bandpass', freq: 1200, freqTo: 2600, q: 3.2 }
    });
  }

  if (step === 0) {
    notes.push({
      bus: 'tension', wave: 'sawtooth', freq: chord.bass * 1.06, dur: 1.1, gain: 0.045,
      filter: { type: 'lowpass', freq: 260, q: 0.8 }
    });
  }
  if (step % 2 === 0) {
    notes.push({
      bus: 'tension', wave: 'noise', dur: 0.03, gain: 0.03,
      filter: { type: 'highpass', freq: 6800, q: 0.5 }
    });
  }
  if (step === 4 || step === 12) {
    notes.push({ bus: 'tension', wave: 'sine', freq: 466.16, freqTo: 493.88, dur: 0.22, gain: 0.028 });
  }

  return notes;
}

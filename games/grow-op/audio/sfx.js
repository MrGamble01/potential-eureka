// Short original cues. Each list is scheduled from t = 0 on the SFX bus.

export const SFX_NAMES = [
  'build',
  'truckDepart',
  'truckArrive',
  'cashDirty',
  'cashClean',
  'launder',
  'siren',
  'bribe',
  'research',
  'click'
];

const low = (freq, q = 0.7) => ({ type: 'lowpass', freq, q });

export const SFX = {
  build: [
    { at: 0, wave: 'sine', freq: 92, freqTo: 48, dur: 0.18, gain: 0.12 },
    { at: 0.01, wave: 'noise', dur: 0.09, gain: 0.07, filter: low(700, 0.6) },
    { at: 0.07, wave: 'triangle', freq: 196, dur: 0.1, gain: 0.05 }
  ],
  truckDepart: [
    { at: 0, wave: 'sawtooth', freq: 68, freqTo: 148, dur: 0.32, gain: 0.05, filter: { type: 'lowpass', freq: 380, freqTo: 980, q: 0.8 } },
    { at: 0.06, wave: 'square', freq: 311, dur: 0.08, gain: 0.028 }
  ],
  truckArrive: [
    { at: 0, wave: 'noise', dur: 0.22, gain: 0.07, filter: { type: 'bandpass', freq: 2200, freqTo: 360, q: 2.4 } },
    { at: 0.12, wave: 'sine', freq: 78, dur: 0.12, gain: 0.08 }
  ],
  cashDirty: [
    { at: 0, wave: 'noise', dur: 0.12, gain: 0.055, filter: { type: 'bandpass', freq: 840, q: 0.6 } },
    { at: 0.04, wave: 'triangle', freq: 156, dur: 0.11, gain: 0.05 }
  ],
  cashClean: [
    { at: 0, wave: 'sine', freq: 880, dur: 0.08, gain: 0.05 },
    { at: 0.07, wave: 'sine', freq: 1320, dur: 0.13, gain: 0.042 }
  ],
  launder: [
    { at: 0, wave: 'noise', dur: 0.22, gain: 0.05, filter: { type: 'bandpass', freq: 480, freqTo: 1500, q: 1.5 } },
    { at: 0.16, wave: 'sine', freq: 988, dur: 0.16, gain: 0.05 }
  ],
  siren: [
    { at: 0, wave: 'sawtooth', freq: 540, freqTo: 410, dur: 0.24, gain: 0.04, filter: low(1600, 0.7) },
    { at: 0.22, wave: 'sawtooth', freq: 410, freqTo: 640, dur: 0.24, gain: 0.04, filter: low(1600, 0.7) },
    { at: 0.44, wave: 'sawtooth', freq: 640, freqTo: 450, dur: 0.26, gain: 0.034, filter: low(1600, 0.7) }
  ],
  bribe: [
    { at: 0, wave: 'noise', dur: 0.08, gain: 0.04, filter: { type: 'highpass', freq: 1400, q: 0.5 } },
    { at: 0.08, wave: 'noise', dur: 0.07, gain: 0.032, filter: { type: 'highpass', freq: 1800, q: 0.5 } },
    { at: 0.1, wave: 'triangle', freq: 220, dur: 0.14, gain: 0.04 }
  ],
  research: [523.25, 659.25, 783.99, 1046.5].map((freq, i) => ({
    at: i * 0.09, wave: 'triangle', freq, dur: 0.18, gain: 0.048
  })),
  click: [
    { at: 0, wave: 'square', freq: 740, dur: 0.035, gain: 0.02, filter: { type: 'highpass', freq: 400, q: 0.4 } }
  ]
};

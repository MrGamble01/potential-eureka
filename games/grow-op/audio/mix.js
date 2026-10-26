// Persisted master / music / SFX levels. The legacy mute flag still wins
// the first time, so an older save stays quiet.

export const MIX_KEY = 'growop-audio-mix';
export const LEGACY_MUTE_KEY = 'growop-cartel-mute';

export function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function defaultMix() {
  return { master: 0.8, music: 0.62, sfx: 0.85, muted: false };
}

export function loadMix(storage) {
  const mix = defaultMix();
  if (!storage) return mix;
  try {
    const raw = storage.getItem(MIX_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      mix.master = clamp01(data.master);
      mix.music = clamp01(data.music);
      mix.sfx = clamp01(data.sfx);
      mix.muted = !!data.muted;
      return mix;
    }
    if (storage.getItem(LEGACY_MUTE_KEY) === '1') mix.muted = true;
  } catch (e) { /* private mode or a bad blob */ }
  return mix;
}

export function saveMix(storage, mix) {
  if (!storage) return;
  const next = {
    master: clamp01(mix.master),
    music: clamp01(mix.music),
    sfx: clamp01(mix.sfx),
    muted: !!mix.muted
  };
  try {
    storage.setItem(MIX_KEY, JSON.stringify(next));
    storage.setItem(LEGACY_MUTE_KEY, next.muted ? '1' : '0');
  } catch (e) { /* private mode */ }
}

/* ============================================
   HALL OF FAME BACKUP — export and restore.

   The file is { v, when, data }. data is a map
   of localStorage keys to the strings already
   stored. Only the allowlist is written, and
   only after the whole file checks out. A bad
   file returns an error and does not call
   setItem, so a restore cannot wipe or mix
   the progress that is already there.
   ============================================ */

(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  if (root) root.HofBackup = exported;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SCHEMA = 1;
  const MAX_VALUE = 1500000;

  // The eight flagship saves the board reads. Age of War's line is the
  // best run (waves, then the achievement tally). The quick games store
  // a single score. The long games and Ashmarch store a JSON save.
  const FLAGSHIP_KEYS = [
    'voxel-garden-v1',
    'aow-best-run',
    'startup-tycoon-v7',
    'hearthvale-v1',
    'ashmarch-chronicle-v1',
    'gutter-best',
    'crate-best',
    'tetris-high',
  ];

  // Coins carry the balance and the equipped Coin Shop accent.
  // Rivals are the imported board. The other keys are the cabinet
  // scores and the Age of War tally the same board already shows.
  const EXTRA_KEYS = [
    'aow-achievements',
    'arcade-coins',
    'arcade-achievements',
    'arcade-rivals',
    'rival-name',
    'snake-high',
    'breakout-high',
    'asteroids-high',
    'g2048-best',
    'mines-best-beginner',
    'connect4-streak',
    'word5-streak',
    'cycles-streak',
    'pong-streak',
    'matrix-best',
    'stacker-best',
    'vector-best',
    'cascade-best',
    'maze-best',
    'inkflip-best',
    'homeless_village_v1',
    'drug-lab-v1',
  ];

  const KEYS = FLAGSHIP_KEYS.concat(EXTRA_KEYS);
  const ALLOW = new Set(KEYS);

  function fail(error) {
    return { ok: false, error: error };
  }

  function kept(error) {
    return fail(error + ' Your progress was left as it was.');
  }

  function exportPayload(storage, when) {
    const data = {};
    for (const key of KEYS) {
      let value = null;
      try { value = storage.getItem(key); } catch { value = null; }
      if (typeof value === 'string') data[key] = value;
    }
    const stamp = (typeof when === 'string' && when) ? when : new Date().toISOString();
    return { v: SCHEMA, when: stamp, data: data };
  }

  function validate(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return kept('That file is not a Eureka backup.');
    }
    const data = payload.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return kept('That file is not a Eureka backup.');
    }
    if (payload.v !== SCHEMA) {
      return kept('That backup version is not supported.');
    }
    const present = Object.keys(data);
    if (!present.length) return kept('That backup is empty.');
    for (const key of present) {
      const value = data[key];
      if (!ALLOW.has(key) || typeof value !== 'string' || value.length > MAX_VALUE) {
        return kept('That backup includes entries this arcade will not restore.');
      }
    }
    return { ok: true, data: data, keys: KEYS.filter(function (key) { return Object.prototype.hasOwnProperty.call(data, key); }) };
  }

  function read(text) {
    if (typeof text !== 'string' || !text.trim()) return kept('That file is empty.');
    let payload;
    try { payload = JSON.parse(text); }
    catch { return kept('That file is not valid JSON.'); }
    return validate(payload);
  }

  function restore(storage, payload) {
    const verdict = typeof payload === 'string' ? read(payload) : validate(payload);
    if (!verdict.ok) return { ok: false, error: verdict.error };
    const prev = {};
    try {
      for (const key of verdict.keys) prev[key] = storage.getItem(key);
    } catch (e) {
      return kept('Restore could not be saved.');
    }
    const written = [];
    try {
      for (const key of verdict.keys) {
        storage.setItem(key, verdict.data[key]);
        written.push(key);
      }
    } catch (e) {
      for (let i = written.length - 1; i >= 0; i--) {
        const key = written[i];
        try {
          if (prev[key] == null) storage.removeItem(key);
          else storage.setItem(key, prev[key]);
        } catch (err) { break; }
      }
      return kept('Restore could not be saved.');
    }
    const n = verdict.keys.length;
    return {
      ok: true,
      keys: verdict.keys.slice(),
      message: 'Restored ' + n + ' saved ' + (n === 1 ? 'entry' : 'entries') + '. The board, coins, accent, and rivals are updated.',
    };
  }

  return {
    SCHEMA: SCHEMA,
    FLAGSHIP_KEYS: FLAGSHIP_KEYS.slice(),
    KEYS: KEYS.slice(),
    exportPayload: exportPayload,
    validate: validate,
    read: read,
    restore: restore,
  };
});

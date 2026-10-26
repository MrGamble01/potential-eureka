// District heat, patrols, and the choice to bribe or go dark.
// A patrol that arrives becomes a raid. Hiding only works before that.

export function notePatrol(reg, heat) {
  if (!reg || reg.raidActive || (reg.patrol && reg.patrol.active)) return;
  if (heat < 58 || heat >= 96) return;
  reg.patrol = {
    active: true,
    kind: heat >= 78 ? 'army' : 'police',
    eta: heat >= 78 ? 14 : 18
  };
}

export function tickPatrol(reg, dt) {
  if (!reg || !reg.patrol || !reg.patrol.active) return null;
  reg.patrol.eta -= dt;
  if (reg.patrol.eta > 0) return null;
  reg.patrol = null;
  return 'escalate';
}

export function hide(state, id) {
  const reg = (state.regions && state.regions[id]) || (state.zones && state.zones[id]);
  if (!reg) return { ok: false, reason: 'Unknown district.' };
  if (reg.raidActive) return { ok: false, reason: 'The raid is already on a building. Bribe them or ride it out.' };
  reg.heat = Math.max(0, (Number(reg.heat) || 0) - 16);
  reg.hiddenUntil = state.elapsedSeconds + 18;
  const had = !!(reg.patrol && reg.patrol.active);
  reg.patrol = null;
  if (had) {
    state.heatHandled = (state.heatHandled || 0) + 1;
    if (state.dea) state.dea.case = Math.max(0, (Number(state.dea.case) || 0) - 4);
  }
  state.patrolsHandled = (state.patrolsHandled || 0) + (had ? 1 : 0);
  return { ok: true, slipped: had };
}

export function hiddenNow(state, reg) {
  return !!(reg && reg.hiddenUntil && state.elapsedSeconds < reg.hiddenUntil);
}

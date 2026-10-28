// Zone gates and neighborhood control. Owning operating buildings
// raises control. Heat and the local rival push it back down.

import { ZONES, zoneById } from '../data/zones.js';
import { lotDef } from '../data/lots.js';
import { RIVALS } from '../data/rivals.js';
import { coreMode } from '../data/config.js';

const SIZE_WEIGHT = { small: 6, medium: 10, large: 15 };

export function zoneCost(zone) {
  if (!zone) return 0;
  if (coreMode() && zone.id === 'jungle_alta') return zone.coreUnlock || 1500;
  return (zone.unlock && zone.unlock.clean) || 0;
}

export function unlockBlockers(state, zone) {
  const reasons = [];
  if (!zone || zone.starter) return reasons;
  const cost = zoneCost(zone);
  if (coreMode() && zone.id === 'jungle_alta') {
    if ((state.dirtyCash || 0) < cost) reasons.push(`Need $${cost}.`);
    return reasons;
  }
  if (!state.mapOpen) reasons.push('Finish the valley tutorial. The rest of the map is still shut.');
  const need = zone.unlock || {};
  if ((state.reputation || 0) < (need.reputation || 0)) {
    reasons.push(`Reputation ${need.reputation} required.`);
  }
  if (need.mission && !(state.completedMissions || []).includes(need.mission)) {
    reasons.push('A valley objective is still open.');
  }
  const purse = coreMode() ? state.dirtyCash : state.cleanCash;
  const label = coreMode() ? 'Dirty' : 'Clean';
  if ((purse || 0) < cost) {
    reasons.push(`Need $${cost} ${label} Cash.`);
  }
  return reasons;
}

export function unlockZone(state, zoneId) {
  const zone = zoneById(zoneId);
  const live = state.zones[zoneId];
  if (!zone || !live) return { ok: false, reason: 'Unknown zone.' };
  if (live.unlocked) return { ok: false, reason: 'Already open.' };
  const reasons = unlockBlockers(state, zone);
  if (reasons.length) return { ok: false, reason: reasons[0] };
  const cost = zoneCost(zone);
  if (coreMode()) state.dirtyCash -= cost;
  else state.cleanCash -= cost;
  live.unlocked = true;
  return { ok: true, zone, cost };
}

export function measureControl(state, zoneId) {
  const zone = zoneById(zoneId);
  if (!zone) return 0;
  let control = zone.baseControl;
  for (const lot of Object.values(state.lots || {})) {
    if (lot.zoneId !== zoneId || !lot.owned) continue;
    if (lot.phase !== 'operating' && lot.phase !== 'building') continue;
    control += SIZE_WEIGHT[lot.size] || 6;
  }
  const live = state.zones[zoneId];
  const heat = live ? Number(live.heat) || 0 : 0;
  control -= heat * 0.22;
  if (zone.rival && state.rivals && state.rivals[zone.rival]) {
    const rival = RIVALS[zone.rival];
    const threat = state.rivals[zone.rival].threat;
    if (rival && threat < rival.threatStart * 0.35) control -= 8;
  }
  return Math.max(0, Math.min(100, Math.round(control)));
}

export function refreshControl(state) {
  if (!state.zones) return;
  for (const zone of ZONES) {
    if (!state.zones[zone.id]) continue;
    state.zones[zone.id].control = measureControl(state, zone.id);
  }
}

export function syncMap(state) {
  if (coreMode()) {
    const next = state.zones && state.zones.jungle_alta;
    if (next && next.unlocked) state.mapOpen = true;
    return;
  }
  if (state.tutorialDone || (state.tutorialStep || 0) >= 4) state.mapOpen = true;
}

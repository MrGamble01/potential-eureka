// Loyalty scales a lieutenant's perk. Traits drift loyalty and add a side effect.

import { LIEUTENANTS } from '../data/missions.js';

export function loyaltyScale(loyalty) {
  if (loyalty >= 80) return 1;
  if (loyalty >= 50) return 0.6;
  if (loyalty >= 30) return 0.25;
  return 0;
}

function scaled(base, scale) {
  return 1 + ((base || 1) - 1) * scale;
}

export function betrayalFloor(lt) {
  const traits = (lt && lt.traits) || [];
  let floor = 12;
  if (traits.includes('loyal')) floor = 8;
  if (traits.includes('volatile')) floor = 18;
  return floor;
}

// 0–100. A hired lieutenant at or under the floor betrays on the next day.
export function betrayalRisk(lt, row) {
  if (!row || !row.hired || row.betrayed) return row && row.betrayed ? 100 : 0;
  const floor = betrayalFloor(lt);
  if (row.loyalty <= floor) return 100;
  const span = 40;
  const into = floor + span - row.loyalty;
  return Math.max(0, Math.min(99, Math.round((into / span) * 100)));
}

export function crewMods(state, regionId) {
  let prodMult = 1;
  let launderMult = 1;
  let heatMult = 1;
  let defensePower = 0;
  const notes = [];
  for (const lt of LIEUTENANTS) {
    const row = state.lieutenants[lt.id];
    const place = row && (row.zoneId || row.regionId);
    if (!row || !row.hired || row.betrayed || place !== regionId) continue;
    const scale = loyaltyScale(row.loyalty);
    prodMult *= scaled(lt.prodMult, scale);
    launderMult *= scaled(lt.launderMult, scale);
    heatMult *= scaled(lt.heatMult, scale);
    defensePower += Math.round((lt.defensePower || 0) * scale);
    const traits = lt.traits || [];
    if (traits.includes('volatile')) heatMult *= 1.06;
    if (traits.includes('paranoid')) heatMult *= 0.94;
    if (traits.includes('route_mind')) prodMult *= 1 + 0.08 * scale;
    notes.push({ id: lt.id, loyalty: row.loyalty, scale, traits });
  }
  return { prodMult, launderMult, heatMult, defensePower, notes };
}

export function tickLoyalty(state) {
  for (const lt of LIEUTENANTS) {
    const row = state.lieutenants[lt.id];
    if (!row || !row.hired) continue;
    const traits = lt.traits || [];
    let drift = -0.4;
    if (traits.includes('loyal')) drift += 0.6;
    if (traits.includes('greedy')) drift -= 0.5;
    if (traits.includes('volatile')) drift -= 0.2;
    if (traits.includes('by_the_book') && state.heatHandled > 2) drift -= 0.15;
    row.loyalty = Math.max(0, Math.min(100, row.loyalty + drift));
  }
}

// Loyalty at or under the floor walks the lieutenant out the same day.
// They skim dirty cash, heat the zone they held, and feed Ruiz's file.
export function tickBetrayal(state) {
  const notes = [];
  for (const lt of LIEUTENANTS) {
    const row = state.lieutenants[lt.id];
    if (!row || !row.hired || row.betrayed) continue;
    if (row.loyalty > betrayalFloor(lt)) continue;
    const zoneId = row.zoneId || row.regionId;
    row.hired = false;
    row.betrayed = true;
    row.regionId = null;
    row.zoneId = null;
    const skim = state.noSeizure ? 0 : Math.floor((state.dirtyCash || 0) * 0.12);
    if (!state.noSeizure) state.dirtyCash = Math.max(0, (state.dirtyCash || 0) - skim);
    const region = state.regions && state.regions[zoneId];
    const zone = state.zones && state.zones[zoneId];
    if (region) region.heat = Math.min(100, (Number(region.heat) || 0) + 18);
    if (zone && !region) zone.heat = Math.min(100, (Number(zone.heat) || 0) + 18);
    if (!state.dea) state.dea = { agent: 'Helen Ruiz', case: 0 };
    state.dea.case = Math.min(100, (Number(state.dea.case) || 0) + 10);
    notes.push({ id: lt.id, name: lt.name, skim, zoneId });
  }
  return notes;
}

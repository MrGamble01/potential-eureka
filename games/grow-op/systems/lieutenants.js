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

export function crewMods(state, regionId) {
  let prodMult = 1;
  let launderMult = 1;
  let heatMult = 1;
  let defensePower = 0;
  const notes = [];
  for (const lt of LIEUTENANTS) {
    const row = state.lieutenants[lt.id];
    if (!row || !row.hired || row.regionId !== regionId) continue;
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

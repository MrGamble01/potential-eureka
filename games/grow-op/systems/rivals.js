// Los Lobos and Costa Negra. Each crew leans on the zones they care
// about and knocks a building offline when their timer runs out.

import { BUILDINGS } from '../data/buildings.js';
import { RIVALS } from '../data/rivals.js';

function ownedTargets(state, rivalId) {
  const rival = RIVALS[rivalId];
  const hits = [];
  for (const slot of Object.values(state.slots || {})) {
    if (!slot.buildingId || slot.raidLocked) continue;
    if (!rival.zones.includes(slot.regionId)) continue;
    hits.push({ kind: 'slot', row: slot });
  }
  for (const lot of Object.values(state.lots || {})) {
    if (!lot.owned || lot.phase !== 'operating' || lot.slotId) continue;
    if (!rival.zones.includes(lot.zoneId)) continue;
    hits.push({ kind: 'lot', row: lot });
  }
  return hits;
}

export function tickRivals(state, elapsed) {
  const notes = [];
  const rate = state.difficultyMods && state.difficultyMods.rival ? state.difficultyMods.rival : 1;
  for (const rival of Object.values(RIVALS)) {
    const row = state.rivals && state.rivals[rival.id];
    if (!row) continue;
    if (rival.id === 'costa') {
      const cityOpen = Object.values(state.zones || {}).some((zone) => zone.unlocked && String(zone.id).startsWith('ps_'));
      const deltaOpen = state.zones && state.zones.river_delta && state.zones.river_delta.unlocked;
      if (!cityOpen && !deltaOpen) continue;
    }
    row.threat = Math.max(0, row.threat - 4 * rate);
    if (row.threat > 0) continue;
    row.threat = rival.threatReset;
    row.attacks += 1;
    const targets = ownedTargets(state, rival.id);
    if (!targets.length) {
      notes.push({ rivalId: rival.id, text: `${rival.name} scouts the edge of the map.` });
      continue;
    }
    const hit = targets[state.day % targets.length];
    if (hit.kind === 'slot') {
      hit.row.raidLocked = true;
      hit.row.rivalLock = true;
      hit.row.rivalUntil = elapsed + 14;
      const name = BUILDINGS[hit.row.buildingId] ? BUILDINGS[hit.row.buildingId].shortName : 'a lot';
      const stolen = hit.row.outputBuffer || {};
      for (const key of Object.keys(stolen)) stolen[key] = Math.floor((stolen[key] || 0) * 0.7);
      notes.push({
        rivalId: rival.id,
        slotId: hit.row.slotId,
        text: `${rival.name} hit ${name} and took a cut of the stock.`
      });
    } else {
      hit.row.disabledUntil = elapsed + 14;
      notes.push({
        rivalId: rival.id,
        lotId: hit.row.id,
        text: `${rival.name} shot up ${hit.row.id.replace('lot_', '').replace(/_/g, ' ')}.`
      });
    }
    if (rival.id === 'lobos' && state.rival) state.rival.defeatedCount = state.rival.defeatedCount || 0;
  }
  if (state.rival && state.rivals && state.rivals.lobos) {
    state.rival.threatTimer = state.rivals.lobos.threat;
    state.rival.name = 'Los Lobos Syndicate';
  }
  return notes;
}

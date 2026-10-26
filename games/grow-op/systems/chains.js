// Valley herb, coffee cover, and the highland brick. Storage caps
// stall a stage when the pile is full.

import { BUILDINGS } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';

export const CHAINS = [
  {
    id: 'valley',
    name: 'Valley herb',
    act: 1,
    stages: [
      { buildingId: 'plantation', good: 'raw_herb' },
      { buildingId: 'drying_barn', good: 'cured_pack' },
      { buildingId: 'packaging_mill', good: 'smuggled_coffee', optional: true },
      { role: 'export' }
    ]
  },
  {
    id: 'cover',
    name: 'Coffee cover',
    act: 1,
    stages: [
      { buildingId: 'coffee_estate', good: 'coffee_cherry' },
      { buildingId: 'packaging_mill', good: 'smuggled_coffee' },
      { role: 'export' }
    ]
  },
  {
    id: 'highland',
    name: 'Highland distillate',
    act: 2,
    stages: [
      { buildingId: 'highland_farm', good: 'coca_leaf' },
      { buildingId: 'chem_lab', good: 'refined_extract' },
      { role: 'export' }
    ]
  }
];

export function storageCap(def, level = 1, extra = 0) {
  const base = Number(def && def.storageCap) || 0;
  const scaled = Math.round(base * (1 + Math.max(0, level - 1) * 0.35));
  return scaled + extra;
}

export function capExtra(state, def) {
  if (!def) return 0;
  let extra = 0;
  if (state.research && state.research.cold_store && (def.role === 'warehouse' || def.id === 'warehouse')) extra += 12;
  if (state.research && state.research.irrigation && def.id === 'plantation') extra += 4;
  return extra;
}

function count(buffer) {
  let sum = 0;
  for (const value of Object.values(buffer || {})) sum += value || 0;
  return sum;
}

export function chainReport(state) {
  const slots = Object.values(state.slots || {});
  return CHAINS.map((chain) => ({
    id: chain.id,
    name: chain.name,
    act: chain.act,
    stages: chain.stages.map((stage) => {
      if (stage.role === 'export') {
        const exports = slots.filter((slot) => {
          const def = slot.buildingId && BUILDINGS[slot.buildingId];
          return def && def.role === 'smuggling';
        });
        const stock = exports.reduce((sum, slot) => sum + count(slot.inputBuffer), 0);
        return { role: 'export', stock, buildings: exports.length };
      }
      const def = BUILDINGS[stage.buildingId];
      const matches = slots.filter((slot) => slot.buildingId === stage.buildingId);
      const stock = matches.reduce((sum, slot) => sum + (slot.outputBuffer[stage.good] || 0), 0);
      const cap = matches.reduce((sum, slot) => sum + storageCap(def, slot.level || 1, capExtra(state, def)), 0);
      return {
        buildingId: stage.buildingId,
        good: stage.good,
        goodName: GOODS[stage.good] ? GOODS[stage.good].shortName : stage.good,
        stock,
        cap,
        stalled: cap > 0 && stock >= cap,
        optional: !!stage.optional
      };
    })
  }));
}

// Lots sit under zones. Rural land is either an open plot (build it)
// or a standing building (buy and convert, or buy the lot, demolish, build).
// City lots are standing buildings only. The valley starter plots reuse
// BUILD_SLOTS ids so the current map keeps working.

import { BUILD_SLOTS } from './missions.js';

export const ROLES = [
  'launder',
  'stash',
  'lab',
  'distribution',
  'safehouse',
  'hq',
  'produce',
  'process',
  'export',
  'warehouse'
];

const NO = Object.fromEntries(ROLES.map((id) => [id, 'no']));

function roles(map) {
  return { ...NO, ...map };
}

export const PROPERTY_TYPES = {
  gas_station: {
    id: 'gas_station',
    label: 'Roadside gas station',
    suspicion: 0.2,
    upkeep: 16,
    capacity: 8,
    roles: roles({ launder: 'boost', distribution: 'ok', stash: 'limit', warehouse: 'limit' })
  },
  laundromat: {
    id: 'laundromat',
    label: 'Laundromat',
    suspicion: 0.12,
    upkeep: 14,
    capacity: 10,
    roles: roles({ launder: 'boost', stash: 'ok', distribution: 'limit' })
  },
  diner: {
    id: 'diner',
    label: 'Diner',
    suspicion: 0.18,
    upkeep: 18,
    capacity: 8,
    roles: roles({ launder: 'ok', distribution: 'ok', safehouse: 'limit', hq: 'no' })
  },
  pawn: {
    id: 'pawn',
    label: 'Pawn shop',
    suspicion: 0.22,
    upkeep: 12,
    capacity: 12,
    roles: roles({ launder: 'ok', stash: 'boost', distribution: 'ok' })
  },
  apartments: {
    id: 'apartments',
    label: 'Apartment block',
    suspicion: 0.1,
    upkeep: 22,
    capacity: 14,
    roles: roles({ stash: 'ok', safehouse: 'boost', launder: 'limit', hq: 'limit' })
  },
  warehouse_old: {
    id: 'warehouse_old',
    label: 'Old warehouse',
    suspicion: 0.16,
    upkeep: 20,
    capacity: 28,
    roles: roles({ warehouse: 'boost', stash: 'boost', distribution: 'boost', lab: 'limit' })
  },
  fish_house: {
    id: 'fish_house',
    label: 'Fish house',
    suspicion: 0.14,
    upkeep: 15,
    capacity: 16,
    roles: roles({ distribution: 'boost', export: 'ok', stash: 'ok', warehouse: 'ok' })
  },
  garage: {
    id: 'garage',
    label: 'Garage',
    suspicion: 0.15,
    upkeep: 14,
    capacity: 12,
    roles: roles({ distribution: 'ok', stash: 'ok', lab: 'limit', warehouse: 'ok' })
  },
  car_lot: {
    id: 'car_lot',
    label: 'Car lot',
    suspicion: 0.2,
    upkeep: 24,
    capacity: 14,
    roles: roles({ launder: 'boost', distribution: 'ok', hq: 'limit' })
  },
  office: {
    id: 'office',
    label: 'Office floor',
    suspicion: 0.08,
    upkeep: 30,
    capacity: 10,
    roles: roles({ hq: 'boost', launder: 'ok', safehouse: 'limit' })
  },
  bank: {
    id: 'bank',
    label: 'Corner bank',
    suspicion: 0.06,
    upkeep: 40,
    capacity: 16,
    roles: roles({ launder: 'boost', hq: 'ok' })
  },
  motel: {
    id: 'motel',
    label: 'Motel',
    suspicion: 0.14,
    upkeep: 18,
    capacity: 12,
    roles: roles({ launder: 'ok', safehouse: 'boost', stash: 'ok', distribution: 'limit' })
  },
  nightclub: {
    id: 'nightclub',
    label: 'Nightclub',
    suspicion: 0.28,
    upkeep: 36,
    capacity: 18,
    roles: roles({ launder: 'boost', distribution: 'ok', hq: 'limit' })
  },
  casino: {
    id: 'casino',
    label: 'Casino',
    suspicion: 0.34,
    upkeep: 48,
    capacity: 22,
    roles: roles({ launder: 'boost', hq: 'ok', distribution: 'limit' })
  },
  hangar: {
    id: 'hangar',
    label: 'Hangar',
    suspicion: 0.24,
    upkeep: 34,
    capacity: 20,
    roles: roles({ distribution: 'boost', export: 'boost', warehouse: 'ok', lab: 'limit' })
  },
  freight_shed: {
    id: 'freight_shed',
    label: 'Freight shed',
    suspicion: 0.18,
    upkeep: 20,
    capacity: 24,
    roles: roles({ distribution: 'boost', warehouse: 'boost', stash: 'ok', export: 'ok' })
  },
  villa: {
    id: 'villa',
    label: 'Hill villa',
    suspicion: 0.08,
    upkeep: 28,
    capacity: 10,
    roles: roles({ safehouse: 'boost', hq: 'boost', stash: 'limit' })
  },
  hacienda: {
    id: 'hacienda',
    label: 'Hacienda',
    suspicion: 0.1,
    upkeep: 18,
    capacity: 16,
    roles: roles({ produce: 'boost', process: 'ok', stash: 'ok', safehouse: 'ok', warehouse: 'limit' })
  },
  farmhouse: {
    id: 'farmhouse',
    label: 'Barn',
    suspicion: 0.08,
    upkeep: 8,
    capacity: 8,
    roles: roles({ produce: 'ok', stash: 'ok', safehouse: 'boost', process: 'limit' })
  },
  sawmill: {
    id: 'sawmill',
    label: 'Sawmill',
    suspicion: 0.12,
    upkeep: 16,
    capacity: 20,
    roles: roles({ warehouse: 'boost', process: 'ok', distribution: 'ok', produce: 'limit' })
  },
  river_dock: {
    id: 'river_dock',
    label: 'River dock',
    suspicion: 0.16,
    upkeep: 14,
    capacity: 14,
    roles: roles({ export: 'boost', distribution: 'ok', warehouse: 'limit' })
  },
  airstrip: {
    id: 'airstrip',
    label: 'Abandoned airstrip',
    suspicion: 0.2,
    upkeep: 22,
    capacity: 18,
    roles: roles({ export: 'boost', distribution: 'ok', warehouse: 'ok', hq: 'limit' })
  },
  outpost: {
    id: 'outpost',
    label: 'Rival outpost',
    suspicion: 0.3,
    upkeep: 10,
    capacity: 8,
    roles: roles({ stash: 'ok', safehouse: 'limit', hq: 'limit' })
  }
};

export const BUILDING_SIZE = {
  plantation: 'medium',
  coffee_estate: 'medium',
  highland_farm: 'large',
  drying_barn: 'medium',
  packaging_mill: 'medium',
  chem_lab: 'large',
  warehouse: 'medium',
  transport_depot: 'medium',
  river_pier: 'medium',
  aerodrome: 'large',
  taxi_co: 'small',
  salsa_club: 'medium',
  banco_regional: 'large'
};

export const ROLE_FOR_BUILDING = {
  plantation: 'produce',
  coffee_estate: 'produce',
  highland_farm: 'produce',
  drying_barn: 'process',
  packaging_mill: 'process',
  chem_lab: 'process',
  warehouse: 'warehouse',
  transport_depot: 'distribution',
  river_pier: 'export',
  aerodrome: 'export',
  taxi_co: 'launder',
  salsa_club: 'launder',
  banco_regional: 'launder'
};

const SIZE_RANK = { small: 1, medium: 2, large: 3 };

export function sizeRank(size) {
  return SIZE_RANK[size] || 1;
}

export function buildingFits(lotSize, buildingId) {
  const need = BUILDING_SIZE[buildingId];
  if (!need) return false;
  return sizeRank(lotSize) >= sizeRank(need);
}

export function roleForBuilding(buildingId) {
  return ROLE_FOR_BUILDING[buildingId] || null;
}

const STARTER_BUILDING = {
  slot_rp_farm1: 'plantation',
  slot_rp_barn1: 'drying_barn',
  slot_rp_wh1: 'warehouse',
  slot_rp_pier: 'river_pier'
};

const STARTER_SIZE = {
  slot_rp_farm1: 'medium',
  slot_rp_barn1: 'medium',
  slot_rp_wh1: 'medium',
  slot_rp_pier: 'medium',
  slot_rp_south: 'medium',
  slot_rp_town1: 'small'
};

function starterLots() {
  return BUILD_SLOTS.map((slot) => {
    const rival = !!slot.rivalControlled;
    const buildingId = STARTER_BUILDING[slot.id] || null;
    return {
      id: slot.id,
      zoneId: slot.regionId,
      slotId: slot.id,
      label: slot.label,
      kind: rival ? 'standing' : 'open',
      size: STARTER_SIZE[slot.id] || 'medium',
      owner: rival ? 'rival' : 'player',
      rivalId: rival ? 'lobos' : null,
      propertyType: rival ? 'outpost' : null,
      starterBuilding: buildingId,
      baseBuy: rival ? 900 : 0,
      baseLot: rival ? 1500 : 0,
      demolishCost: rival ? 350 : 200,
      demolishSeconds: rival ? 10 : 8,
      bonus: null
    };
  });
}

// Standing rural prizes and the Puerto Sol grid. No scene coordinates:
// the map agent places these from gameplayView().lots.
const EXTRA_LOTS = [
  {
    id: 'lot_rp_gas',
    zoneId: 'rio_plata',
    label: 'Mile 4 gas station',
    kind: 'standing',
    size: 'small',
    owner: 'market',
    propertyType: 'gas_station',
    baseBuy: 360,
    baseLot: 700,
    demolishCost: 140,
    demolishSeconds: 8,
    bonus: null
  },
  {
    id: 'lot_rp_hacienda',
    zoneId: 'rio_plata',
    label: 'Creekside hacienda',
    kind: 'standing',
    size: 'medium',
    owner: 'local',
    propertyType: 'hacienda',
    baseBuy: 980,
    baseLot: 1600,
    demolishCost: 260,
    demolishSeconds: 12,
    bonus: { storage: 8, heatMult: 0.82, growMult: 1.18, level: 2 }
  },
  {
    id: 'lot_ja_clearing',
    zoneId: 'jungle_alta',
    label: 'Canopy clearing',
    kind: 'open',
    size: 'large',
    owner: 'player',
    propertyType: null,
    baseBuy: 0,
    baseLot: 0,
    demolishCost: 200,
    demolishSeconds: 8,
    bonus: null
  },
  {
    id: 'lot_ja_hacienda',
    zoneId: 'jungle_alta',
    label: 'Lobos hacienda',
    kind: 'standing',
    size: 'large',
    owner: 'rival',
    rivalId: 'lobos',
    propertyType: 'hacienda',
    baseBuy: 1600,
    baseLot: 2600,
    demolishCost: 400,
    demolishSeconds: 16,
    bonus: { storage: 10, growMult: 1.22, heatMult: 0.9, level: 2 }
  },
  {
    id: 'lot_ja_gas',
    zoneId: 'jungle_alta',
    label: 'Jungle gas station',
    kind: 'standing',
    size: 'small',
    owner: 'market',
    propertyType: 'gas_station',
    baseBuy: 280,
    baseLot: 170,
    demolishCost: 100,
    demolishSeconds: 8,
    bonus: null
  },
  {
    id: 'lot_ja_wh',
    zoneId: 'jungle_alta',
    label: 'Old warehouse',
    kind: 'standing',
    size: 'medium',
    owner: 'market',
    propertyType: 'warehouse_old',
    baseBuy: 1500,
    baseLot: 520,
    demolishCost: 160,
    demolishSeconds: 10,
    bonus: { storage: 10 }
  },
  {
    id: 'lot_ja_farm',
    zoneId: 'jungle_alta',
    label: 'Old barn',
    kind: 'standing',
    size: 'small',
    owner: 'local',
    propertyType: 'farmhouse',
    baseBuy: 420,
    baseLot: 760,
    demolishCost: 120,
    demolishSeconds: 8,
    bonus: { storage: 4, growMult: 1.08 }
  },
  {
    id: 'lot_rd_plot',
    zoneId: 'river_delta',
    label: 'Delta plot',
    kind: 'open',
    size: 'medium',
    owner: 'player',
    propertyType: null,
    baseBuy: 0,
    baseLot: 0,
    demolishCost: 180,
    demolishSeconds: 8,
    bonus: null
  },
  {
    id: 'lot_rd_dock',
    zoneId: 'river_delta',
    label: 'Old river dock',
    kind: 'standing',
    size: 'medium',
    owner: 'local',
    propertyType: 'river_dock',
    baseBuy: 1100,
    baseLot: 1800,
    demolishCost: 300,
    demolishSeconds: 12,
    bonus: { boatRisk: -0.1, boatCapacity: 2, level: 2 }
  },
  {
    id: 'lot_rd_mill',
    zoneId: 'river_delta',
    label: 'Delta sawmill',
    kind: 'standing',
    size: 'medium',
    owner: 'market',
    propertyType: 'sawmill',
    baseBuy: 860,
    baseLot: 1400,
    demolishCost: 240,
    demolishSeconds: 12,
    bonus: { storage: 12, heatMult: 0.9 }
  },
  {
    id: 'lot_ms_plot',
    zoneId: 'mesa_strip',
    label: 'Ridge plot',
    kind: 'open',
    size: 'large',
    owner: 'player',
    propertyType: null,
    baseBuy: 0,
    baseLot: 0,
    demolishCost: 200,
    demolishSeconds: 8,
    bonus: null
  },
  {
    id: 'lot_ms_strip',
    zoneId: 'mesa_strip',
    label: 'Abandoned airstrip',
    kind: 'standing',
    size: 'large',
    owner: 'rival',
    rivalId: 'lobos',
    propertyType: 'airstrip',
    baseBuy: 2100,
    baseLot: 3400,
    demolishCost: 500,
    demolishSeconds: 18,
    bonus: { planeRisk: -0.08, planeCapacity: 4, heatMult: 0.92, level: 2 }
  },
  {
    id: 'lot_ba_laundry',
    zoneId: 'ps_barrio',
    label: 'Calle 8 laundromat',
    kind: 'standing',
    size: 'small',
    owner: 'market',
    propertyType: 'laundromat',
    baseBuy: 480,
    baseLot: 860,
    demolishCost: 160,
    demolishSeconds: 8,
    bonus: null
  },
  {
    id: 'lot_ba_diner',
    zoneId: 'ps_barrio',
    label: 'Marta\'s diner',
    kind: 'standing',
    size: 'small',
    owner: 'local',
    propertyType: 'diner',
    baseBuy: 420,
    baseLot: 800,
    demolishCost: 150,
    demolishSeconds: 8,
    bonus: null
  },
  {
    id: 'lot_ba_pawn',
    zoneId: 'ps_barrio',
    label: 'Pawn on 12th',
    kind: 'standing',
    size: 'small',
    owner: 'market',
    propertyType: 'pawn',
    baseBuy: 540,
    baseLot: 920,
    demolishCost: 160,
    demolishSeconds: 8,
    bonus: null
  },
  {
    id: 'lot_ba_apts',
    zoneId: 'ps_barrio',
    label: 'Walk-up apartments',
    kind: 'standing',
    size: 'medium',
    owner: 'local',
    propertyType: 'apartments',
    baseBuy: 980,
    baseLot: 1700,
    demolishCost: 280,
    demolishSeconds: 12,
    bonus: null
  },
  {
    id: 'lot_dk_wh',
    zoneId: 'ps_docks',
    label: 'Pier 3 warehouse',
    kind: 'standing',
    size: 'large',
    owner: 'market',
    propertyType: 'warehouse_old',
    baseBuy: 1400,
    baseLot: 2400,
    demolishCost: 420,
    demolishSeconds: 16,
    bonus: { storage: 8 }
  },
  {
    id: 'lot_dk_fish',
    zoneId: 'ps_docks',
    label: 'Fish house',
    kind: 'standing',
    size: 'medium',
    owner: 'local',
    propertyType: 'fish_house',
    baseBuy: 760,
    baseLot: 1300,
    demolishCost: 220,
    demolishSeconds: 12,
    bonus: null
  },
  {
    id: 'lot_dk_garage',
    zoneId: 'ps_docks',
    label: 'Dock garage',
    kind: 'standing',
    size: 'medium',
    owner: 'market',
    propertyType: 'garage',
    baseBuy: 690,
    baseLot: 1200,
    demolishCost: 200,
    demolishSeconds: 10,
    bonus: null
  },
  {
    id: 'lot_dt_office',
    zoneId: 'ps_downtown',
    label: 'Flagler office',
    kind: 'standing',
    size: 'medium',
    owner: 'market',
    propertyType: 'office',
    baseBuy: 1600,
    baseLot: 2800,
    demolishCost: 360,
    demolishSeconds: 14,
    bonus: null
  },
  {
    id: 'lot_dt_cars',
    zoneId: 'ps_downtown',
    label: 'Ocean Drive motors',
    kind: 'standing',
    size: 'medium',
    owner: 'market',
    propertyType: 'car_lot',
    baseBuy: 1200,
    baseLot: 2100,
    demolishCost: 300,
    demolishSeconds: 12,
    bonus: null
  },
  {
    id: 'lot_dt_bank',
    zoneId: 'ps_downtown',
    label: 'Corner bank',
    kind: 'standing',
    size: 'large',
    owner: 'local',
    propertyType: 'bank',
    baseBuy: 2600,
    baseLot: 4200,
    demolishCost: 520,
    demolishSeconds: 18,
    bonus: null
  },
  {
    id: 'lot_bh_motel',
    zoneId: 'ps_beach',
    label: 'Sea Breeze motel',
    kind: 'standing',
    size: 'medium',
    owner: 'market',
    propertyType: 'motel',
    baseBuy: 1100,
    baseLot: 1900,
    demolishCost: 280,
    demolishSeconds: 12,
    bonus: null
  },
  {
    id: 'lot_bh_club',
    zoneId: 'ps_beach',
    label: 'Club Marea',
    kind: 'standing',
    size: 'large',
    owner: 'rival',
    rivalId: 'costa',
    propertyType: 'nightclub',
    baseBuy: 2200,
    baseLot: 3600,
    demolishCost: 480,
    demolishSeconds: 16,
    bonus: null
  },
  {
    id: 'lot_bh_casino',
    zoneId: 'ps_beach',
    label: 'Sol Casino',
    kind: 'standing',
    size: 'large',
    owner: 'market',
    propertyType: 'casino',
    baseBuy: 3000,
    baseLot: 4800,
    demolishCost: 600,
    demolishSeconds: 18,
    bonus: null
  },
  {
    id: 'lot_ap_hangar',
    zoneId: 'ps_airport',
    label: 'Hangar B',
    kind: 'standing',
    size: 'large',
    owner: 'market',
    propertyType: 'hangar',
    baseBuy: 2400,
    baseLot: 3900,
    demolishCost: 500,
    demolishSeconds: 16,
    bonus: { planeCapacity: 2 }
  },
  {
    id: 'lot_ap_freight',
    zoneId: 'ps_airport',
    label: 'Freight shed',
    kind: 'standing',
    size: 'medium',
    owner: 'market',
    propertyType: 'freight_shed',
    baseBuy: 1300,
    baseLot: 2100,
    demolishCost: 300,
    demolishSeconds: 12,
    bonus: null
  },
  {
    id: 'lot_hi_villa',
    zoneId: 'ps_hills',
    label: 'Cerro villa',
    kind: 'standing',
    size: 'large',
    owner: 'local',
    propertyType: 'villa',
    baseBuy: 2000,
    baseLot: 3400,
    demolishCost: 420,
    demolishSeconds: 14,
    bonus: { heatMult: 0.8 }
  },
  {
    id: 'lot_hi_motel',
    zoneId: 'ps_hills',
    label: 'Hill motel',
    kind: 'standing',
    size: 'small',
    owner: 'market',
    propertyType: 'motel',
    baseBuy: 700,
    baseLot: 1200,
    demolishCost: 180,
    demolishSeconds: 8,
    bonus: null
  }
];

export function allLotDefs() {
  return starterLots().concat(EXTRA_LOTS);
}

export function lotDef(id) {
  return allLotDefs().find((lot) => lot.id === id) || null;
}

export function createLotBook() {
  const lots = {};
  for (const def of allLotDefs()) {
    const operating = !!def.starterBuilding;
    lots[def.id] = {
      id: def.id,
      zoneId: def.zoneId,
      slotId: def.slotId || null,
      kind: def.kind,
      size: def.size,
      owned: def.owner === 'player',
      owner: def.owner,
      access: def.owner === 'player' || def.owner === 'market' ? 'open' : 'locked',
      phase: operating ? 'operating' : 'wild',
      role: operating ? roleForBuilding(def.starterBuilding) : null,
      buildingId: operating ? def.starterBuilding : null,
      propertyType: def.propertyType || null,
      level: 1,
      progress: 0,
      constructLeft: 0,
      demolishLeft: 0,
      pendingBuildingId: null,
      priceMult: 1,
      inputBuffer: {},
      outputBuffer: {},
      rivalId: def.rivalId || null
    };
  }
  return lots;
}

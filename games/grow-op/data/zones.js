// Unlockable map. Act 1 is only the valley. After the tutorial the rest
// of the map opens: more countryside, then the coastal city Puerto Sol.
// The scene still draws REGIONS. These zones are the gameplay map.

export const CITY_NAME = 'Puerto Sol';

export const DIFFICULTIES = {
  casual: {
    id: 'casual',
    label: 'Casual',
    heat: 0.65,
    rival: 0.6,
    prices: 1.1,
    dirty: 12000,
    clean: 8000,
    reputation: 24
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    heat: 1,
    rival: 1,
    prices: 1,
    dirty: 8000,
    clean: 4500,
    reputation: 10
  },
  brutal: {
    id: 'brutal',
    label: 'Brutal',
    heat: 1.4,
    rival: 1.5,
    prices: 0.85,
    dirty: 3200,
    clean: 900,
    reputation: 0
  }
};

export const ZONES = [
  {
    id: 'rio_plata',
    name: 'Río Plata Valley',
    kind: 'rural',
    city: null,
    act: 1,
    starter: true,
    town: 'Puerto Plata',
    unlock: { clean: 0, reputation: 0, mission: null },
    baseHeat: 14,
    baseControl: 58,
    bonus: { fertility: 1.15 },
    rival: null,
    desc: 'The starter valley. Farm, barn, warehouse, pier. Learn the chain before the map opens.'
  },
  {
    id: 'jungle_alta',
    name: 'Selva Alta',
    kind: 'rural',
    city: null,
    act: 2,
    starter: false,
    town: 'El Manglar',
    unlock: { clean: 4000, reputation: 10, mission: 'm2_first_front' },
    coreUnlock: 1500,
    baseHeat: 20,
    baseControl: 24,
    bonus: { fertility: 1.28, heatMult: 1.08 },
    rival: 'lobos',
    desc: 'Jungle highlands. Open plots plus a hacienda Los Lobos already like.'
  },
  {
    id: 'river_delta',
    name: 'Boca del Río',
    kind: 'rural',
    city: null,
    act: 2,
    starter: false,
    town: 'Boca',
    unlock: { clean: 2000, reputation: 8, mission: 'm1_first_export' },
    baseHeat: 16,
    baseControl: 30,
    bonus: { boatRisk: -0.08, boatCapacity: 2 },
    rival: 'costa',
    desc: 'River delta. A dock and a sawmill sit on the water. Boats leave quieter.'
  },
  {
    id: 'mesa_strip',
    name: 'Mesa Grande',
    kind: 'rural',
    city: null,
    act: 2,
    starter: false,
    town: 'Mesa',
    unlock: { clean: 8000, reputation: 18, mission: 'm2_first_front' },
    baseHeat: 18,
    baseControl: 18,
    bonus: { planeRisk: -0.07, planeCapacity: 4 },
    rival: 'lobos',
    desc: 'Mountain airstrip. The abandoned runway is the prize.'
  },
  {
    id: 'ps_barrio',
    name: 'Barrio Sol',
    kind: 'city',
    city: CITY_NAME,
    act: 2,
    starter: false,
    town: 'Little Sol',
    unlock: { clean: 2000, reputation: 8, mission: 'm2_first_front' },
    baseHeat: 22,
    baseControl: 28,
    bonus: { launder: 1.1 },
    rival: 'costa',
    desc: 'Low streets, laundromats, diners, pawn shops. The way into Puerto Sol.'
  },
  {
    id: 'ps_docks',
    name: 'Puerto Sol Docks',
    kind: 'city',
    city: CITY_NAME,
    act: 2,
    starter: false,
    town: 'The Docks',
    unlock: { clean: 4000, reputation: 12, mission: 'm2_first_front' },
    baseHeat: 26,
    baseControl: 22,
    bonus: { distribution: 1.15 },
    rival: 'costa',
    desc: 'Warehouses and a fish house. Rural crates land here.'
  },
  {
    id: 'ps_downtown',
    name: 'Downtown',
    kind: 'city',
    city: CITY_NAME,
    act: 2,
    starter: false,
    town: 'Downtown',
    unlock: { clean: 6000, reputation: 16, mission: 'm2_first_front' },
    baseHeat: 30,
    baseControl: 20,
    bonus: { launder: 1.2 },
    rival: null,
    desc: 'Towers, a car lot, a bank. Clean cash likes this grid.'
  },
  {
    id: 'ps_beach',
    name: 'Beachfront',
    kind: 'city',
    city: CITY_NAME,
    act: 2,
    starter: false,
    town: 'The Beach',
    unlock: { clean: 6000, reputation: 14, mission: 'm2_first_front' },
    baseHeat: 24,
    baseControl: 26,
    bonus: { suspicion: 0.85 },
    rival: 'costa',
    desc: 'Motels, a nightclub, a casino. Costa Negra works the strip.'
  },
  {
    id: 'ps_airport',
    name: 'Airport',
    kind: 'city',
    city: CITY_NAME,
    act: 3,
    starter: false,
    town: 'Sol International',
    unlock: { clean: 10000, reputation: 22, mission: 'm2_first_front' },
    baseHeat: 28,
    baseControl: 16,
    bonus: { planeRisk: -0.05, planeCapacity: 2 },
    rival: 'lobos',
    desc: 'Hangars and a freight shed on the 1980s airport loop.'
  },
  {
    id: 'ps_hills',
    name: 'The Hills',
    kind: 'city',
    city: CITY_NAME,
    act: 3,
    starter: false,
    town: 'Los Cerros',
    unlock: { clean: 8000, reputation: 18, mission: 'm2_first_front' },
    baseHeat: 14,
    baseControl: 34,
    bonus: { safehouse: 1.2 },
    rival: 'lobos',
    desc: 'Villas above the city. Quiet, watched, expensive.'
  }
];

export function zoneById(id) {
  return ZONES.find((zone) => zone.id === id) || null;
}

export function createZoneBook() {
  const zones = {};
  for (const zone of ZONES) {
    zones[zone.id] = {
      id: zone.id,
      unlocked: !!zone.starter,
      heat: zone.baseHeat,
      control: zone.baseControl,
      patrol: null,
      raidActive: false,
      raidTimer: 0,
      hiddenUntil: 0
    };
  }
  return zones;
}

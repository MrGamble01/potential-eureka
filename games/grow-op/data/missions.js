// Grow Op: San Verde '84 — Lieutenants, Regions, Rival Cartel & Act/Mission Progression
// Grounded in Cartel Tycoon's capo/lieutenant succession, territory contest, and regional heat.

export const REGIONS = [
  {
    id: 'rio_plata',
    name: 'Río Plata Valley',
    subtitle: 'Fertile River Lowlands',
    actUnlock: 1,
    unlockCostClean: 0,
    fertilityBonus: 1.15,
    baseHeatDecay: 0.45,
    townName: 'Puerto Plata',
    bounds: { x: 140, y: 210, w: 680, h: 860 },
    headerPos: { x: 530, y: 258 },
    unlockPos: { x: 530, y: 312 },
    tint: 0x4c5e35,
    borderColor: 0x7fa668,
    desc: 'Lush alluvial valley where your operation begins. Ideal for Botanical Plantations, Drying Barns, and River Pier exports.'
  },
  {
    id: 'san_marco',
    name: 'San Marco District',
    subtitle: 'Commercial Port & Highway Hub',
    actUnlock: 1,
    unlockCostClean: 550,
    fertilityBonus: 1.0,
    baseHeatDecay: 0.55,
    townName: 'Ciudad San Marco',
    bounds: { x: 850, y: 210, w: 680, h: 860 },
    headerPos: { x: 1190, y: 258 },
    unlockPos: { x: 1190, y: 316 },
    tint: 0x5c533b,
    borderColor: 0x58a6ff,
    desc: 'Bustling urban corridor and customs port. Prime territory for Taxi Fronts, Salsa Clubs, Packaging Mills, and high-volume laundering.'
  },
  {
    id: 'sierra_alta',
    name: 'Sierra Alta Highlands',
    subtitle: 'Misty Mountain Terraces & Frontier',
    actUnlock: 2,
    unlockCostClean: 1400,
    fertilityBonus: 1.25,
    baseHeatDecay: 0.35,
    townName: 'Villa Dorada',
    bounds: { x: 1560, y: 180, w: 860, h: 900 },
    headerPos: { x: 1900, y: 258 },
    unlockPos: { x: 1900, y: 316 },
    tint: 0x475442,
    borderColor: 0xd98a4e,
    desc: 'Remote mountain plateaus contested by Los Lobos Syndicate. Home to Highland Alkaloid Terraces, Synthesis Labs, and Bush Aerodromes.'
  }
];

// Build slots across the 3 regions (collision-free layout with >=180px separation and clear of district headers)
export const BUILD_SLOTS = [
  // ── Region 1: Río Plata Valley (Starter region) ──
  {
    id: 'slot_rp_farm1',
    regionId: 'rio_plata',
    label: 'Old Garage Clearing',
    x: 280,
    y: 460,
    allowedCategories: ['production', 'processing', 'logistics'],
    starterBuilding: 'plantation'
  },
  {
    id: 'slot_rp_barn1',
    regionId: 'rio_plata',
    label: 'Creekside Mill Lot',
    x: 640,
    y: 440,
    allowedCategories: ['processing', 'production', 'logistics'],
    starterBuilding: 'drying_barn'
  },
  {
    id: 'slot_rp_wh1',
    regionId: 'rio_plata',
    label: 'Crossroads Depot',
    x: 450,
    y: 700,
    allowedCategories: ['logistics', 'processing', 'laundering'],
    starterBuilding: 'warehouse'
  },
  {
    id: 'slot_rp_south',
    regionId: 'rio_plata',
    label: 'South Valley Terrace',
    x: 760,
    y: 680,
    allowedCategories: ['production', 'processing', 'logistics'],
    starterBuilding: null
  },
  {
    id: 'slot_rp_town1',
    regionId: 'rio_plata',
    label: 'Puerto Plata Plaza',
    x: 640,
    y: 920,
    allowedCategories: ['laundering', 'logistics', 'production'],
    starterBuilding: null
  },
  {
    id: 'slot_rp_pier',
    regionId: 'rio_plata',
    label: 'Río Plata Embarcadero',
    x: 280,
    y: 960,
    allowedCategories: ['export'],
    starterBuilding: 'river_pier'
  },

  // ── Region 2: San Marco District ──
  {
    id: 'slot_sm_west',
    regionId: 'san_marco',
    label: 'Highway 4 Industrial Lot',
    x: 1020,
    y: 460,
    allowedCategories: ['processing', 'logistics', 'production'],
    starterBuilding: null
  },
  {
    id: 'slot_sm_plaza',
    regionId: 'san_marco',
    label: 'Avenida Central Front',
    x: 1360,
    y: 460,
    allowedCategories: ['laundering', 'logistics'],
    starterBuilding: null
  },
  {
    id: 'slot_sm_hub',
    regionId: 'san_marco',
    label: 'San Marco Freight Yard',
    x: 1180,
    y: 720,
    allowedCategories: ['logistics', 'processing', 'laundering'],
    starterBuilding: null
  },
  {
    id: 'slot_sm_bank',
    regionId: 'san_marco',
    label: 'Cathedral Financial Block',
    x: 1480,
    y: 700,
    allowedCategories: ['laundering', 'processing'],
    starterBuilding: null
  },
  {
    id: 'slot_sm_port',
    regionId: 'san_marco',
    label: 'San Marco Customs Pier',
    x: 1280,
    y: 960,
    allowedCategories: ['export', 'logistics'],
    starterBuilding: null
  },

  // ── Region 3: Sierra Alta Highlands (Contested by Rival) ──
  {
    id: 'slot_sa_ridge1',
    regionId: 'sierra_alta',
    label: 'Cordillera North Terrace',
    x: 1780,
    y: 480,
    allowedCategories: ['production', 'processing'],
    starterBuilding: null,
    rivalControlled: true
  },
  {
    id: 'slot_sa_lab1',
    regionId: 'sierra_alta',
    label: 'Canyon Hideout',
    x: 2140,
    y: 500,
    allowedCategories: ['processing', 'production', 'logistics'],
    starterBuilding: null,
    rivalControlled: true
  },
  {
    id: 'slot_sa_town',
    regionId: 'sierra_alta',
    label: 'Villa Dorada Outpost',
    x: 1820,
    y: 760,
    allowedCategories: ['laundering', 'logistics', 'processing'],
    starterBuilding: null
  },
  {
    id: 'slot_sa_airstrip',
    regionId: 'sierra_alta',
    label: 'Mesa Grande Runway',
    x: 2120,
    y: 940,
    allowedCategories: ['export'],
    starterBuilding: null
  }
];

// A highway and short spurs. Every build slot is a vertex so trucks
// stay on the pavement instead of cutting across the districts.
export const ROAD_NETWORK = [
  [
    { x: 280, y: 460 },
    { x: 450, y: 460 },
    { x: 640, y: 440 },
    { x: 1020, y: 460 },
    { x: 1180, y: 460 },
    { x: 1360, y: 460 },
    { x: 1480, y: 460 },
    { x: 1780, y: 480 },
    { x: 1820, y: 480 },
    { x: 2140, y: 500 }
  ],
  [
    { x: 450, y: 460 },
    { x: 450, y: 700 },
    { x: 280, y: 960 }
  ],
  [
    { x: 450, y: 700 },
    { x: 640, y: 920 },
    { x: 1280, y: 960 }
  ],
  [
    { x: 640, y: 440 },
    { x: 760, y: 680 },
    { x: 640, y: 920 }
  ],
  [
    { x: 1180, y: 460 },
    { x: 1180, y: 720 },
    { x: 1280, y: 960 }
  ],
  [
    { x: 1360, y: 460 },
    { x: 1480, y: 700 },
    { x: 1280, y: 960 }
  ],
  [
    { x: 1780, y: 480 },
    { x: 1820, y: 480 },
    { x: 1820, y: 760 },
    { x: 2120, y: 940 }
  ],
  [
    { x: 2140, y: 500 },
    { x: 2120, y: 940 }
  ]
];

// Compute road path between two build slots so trucks drive along road segments
export function findRoadPath(fromSlotId, toSlotId) {
  const fromSlot = BUILD_SLOTS.find((s) => s.id === fromSlotId);
  const toSlot = BUILD_SLOTS.find((s) => s.id === toSlotId);
  if (!fromSlot || !toSlot) return [];

  // Build adjacency graph from ROAD_NETWORK vertices
  const nodes = [];
  const adj = new Map();
  const keyOf = (pt) => `${Math.round(pt.x)},${Math.round(pt.y)}`;

  const ensureNode = (pt) => {
    const k = keyOf(pt);
    if (!adj.has(k)) {
      adj.set(k, []);
      nodes.push({ key: k, x: pt.x, y: pt.y });
    }
    return k;
  };

  for (const poly of ROAD_NETWORK) {
    for (let i = 0; i < poly.length - 1; i++) {
      const ka = ensureNode(poly[i]);
      const kb = ensureNode(poly[i + 1]);
      const d = Math.hypot(poly[i + 1].x - poly[i].x, poly[i + 1].y - poly[i].y);
      adj.get(ka).push({ to: kb, cost: d });
      adj.get(kb).push({ to: ka, cost: d });
    }
  }

  const startKey = ensureNode(fromSlot);
  const endKey = ensureNode(toSlot);
  if (startKey === endKey) return [{ x: toSlot.x, y: toSlot.y }];

  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  for (const n of nodes) dist.set(n.key, Infinity);
  dist.set(startKey, 0);

  while (visited.size < nodes.length) {
    let u = null;
    let best = Infinity;
    for (const [k, d] of dist.entries()) {
      if (!visited.has(k) && d < best) {
        best = d;
        u = k;
      }
    }
    if (!u || u === endKey) break;
    visited.add(u);
    for (const edge of adj.get(u) || []) {
      const alt = best + edge.cost;
      if (alt < dist.get(edge.to)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, u);
      }
    }
  }

  const path = [];
  let curr = endKey;
  while (curr && curr !== startKey) {
    const [nx, ny] = curr.split(',').map(Number);
    path.unshift({ x: nx, y: ny });
    curr = prev.get(curr);
  }
  if (path.length === 0) {
    return [{ x: toSlot.x, y: toSlot.y }];
  }
  return path;
}

// Lieutenants with Cartel Tycoon-inspired perks, loyalty, upkeep, and regional assignment
export const LIEUTENANTS = [
  {
    id: 'cesar',
    name: 'César "El Ingeniero" Vega',
    role: 'Logistics & Fleet Chief',
    perkName: 'Truck Supplier & Route Master',
    perkDesc: '+35% production & transport speed in assigned region; +2 fleet trucks.',
    hireCostClean: 0,
    upkeepClean: 15,
    power: 4,
    loyalty: 85,
    prodMult: 1.35,
    launderMult: 1.0,
    heatMult: 0.9,
    defensePower: 4,
    traits: ['route_mind', 'loyal'],
    unlockedAtStart: true,
    avatarBg: '#27455c',
    avatarAccent: '#67b0e8'
  },
  {
    id: 'nia',
    name: 'Nia "La Contadora" Morales',
    role: 'Financial Architect',
    perkName: 'Laundering Manager',
    perkDesc: '+40% laundering volume in assigned region and -25% regional heat accumulation.',
    hireCostClean: 400,
    upkeepClean: 25,
    power: 3,
    loyalty: 80,
    prodMult: 1.05,
    launderMult: 1.4,
    heatMult: 0.75,
    defensePower: 3,
    traits: ['books', 'paranoid'],
    unlockedAtStart: false,
    avatarBg: '#2b4a3e',
    avatarAccent: '#3ddc97'
  },
  {
    id: 'mateo',
    name: 'Mateo "El Químico" Solís',
    role: 'Master Agronomist & Chemist',
    perkName: 'Cultivator & Lab Savant',
    perkDesc: '+50% output speed for Plantations, Drying Barns, and Extraction Labs in region.',
    hireCostClean: 900,
    upkeepClean: 40,
    power: 3,
    loyalty: 78,
    prodMult: 1.5,
    launderMult: 1.0,
    heatMult: 1.05,
    defensePower: 3,
    traits: ['green_thumb', 'volatile'],
    unlockedAtStart: false,
    avatarBg: '#3e3554',
    avatarAccent: '#bc8cff'
  },
  {
    id: 'valeria',
    name: 'Comandante Valeria Cruz',
    role: 'Security & Territory Enforcer',
    perkName: 'Peace Maker & Coordinator',
    perkDesc: 'Repels police raids automatically, suppresses rival cartel incursions, and drops regional heat by 0.6/s.',
    hireCostClean: 1500,
    upkeepClean: 55,
    power: 8,
    loyalty: 82,
    prodMult: 1.1,
    launderMult: 1.1,
    heatMult: 0.55,
    defensePower: 8,
    traits: ['iron', 'by_the_book'],
    unlockedAtStart: false,
    avatarBg: '#542f35',
    avatarAccent: '#f85149'
  }
];

export const ACTS = {
  1: {
    id: 1,
    badge: 'ACT I — THE VALLEY FOOTPRINT',
    name: 'Act I: The Valley Footprint',
    summary: 'Establish your first botanical supply chain in Río Plata Valley and open a laundering front to turn street bills into clean capital.'
  },
  2: {
    id: 2,
    badge: 'ACT II — LOGISTICS & LAUNDERING',
    name: 'Act II: Logistics & Laundering',
    summary: 'Expand into San Marco District, recruit specialist lieutenants, and scale legal fronts to fund high-purity processing.'
  },
  3: {
    id: 3,
    badge: 'ACT III — SYNDICATE SOVEREIGNTY',
    name: 'Act III: Syndicate Sovereignty',
    summary: 'Seize Sierra Alta Highlands from Los Lobos Syndicate, build a Bush Aerodrome, and cement an untouchable regional empire.'
  }
};

export const MISSIONS = [
  {
    id: 'm1_first_export',
    act: 1,
    title: 'First River Export',
    desc: 'Run your Río Plata supply chain (Plantation → Drying Barn → River Pier) until you accumulate $1,200 in total Dirty Cash.',
    rewardClean: 250,
    rewardDirty: 200,
    targetValue: 1200,
    metric: 'totalDirtyEarned'
  },
  {
    id: 'm2_first_front',
    act: 1,
    title: 'Open a Legal Front',
    desc: 'Build a San Verde Taxi Fleet on an open lot (such as Puerto Plata Plaza) and launder $500 in Clean Cash.',
    rewardClean: 400,
    rewardDirty: 0,
    targetValue: 500,
    metric: 'totalCleanEarned',
    requireBuilding: 'taxi_co'
  },
  {
    id: 'm3_expand_san_marco',
    act: 2,
    title: 'Cross into San Marco',
    desc: 'Unlock the San Marco District, recruit a second Lieutenant, and operate at least 6 facilities across the map.',
    rewardClean: 750,
    rewardDirty: 500,
    targetValue: 6,
    metric: 'buildingCount',
    requireRegion: 'san_marco',
    requireLieutenants: 2
  },
  {
    id: 'm4_industrial_scale',
    act: 2,
    title: 'High-Purity Operations',
    desc: 'Construct an Extraction Lab or Coffee Packer Mill and launder $3,500 lifetime Clean Cash.',
    rewardClean: 1200,
    rewardDirty: 800,
    targetValue: 3500,
    metric: 'totalCleanEarned',
    requireAnyBuilding: ['chem_lab', 'packaging_mill']
  },
  {
    id: 'm5_contest_sierra',
    act: 3,
    title: 'Break Los Lobos in Sierra Alta',
    desc: 'Unlock Sierra Alta Highlands, neutralize Los Lobos Syndicate outposts, and build a Bush Aerodrome.',
    rewardClean: 2500,
    rewardDirty: 2000,
    targetValue: 1,
    metric: 'aerodromeBuilt',
    requireRegion: 'sierra_alta',
    requireRivalCleared: true
  },
  {
    id: 'm6_cartel_sovereign',
    act: 3,
    title: 'Sovereign of San Verde',
    desc: 'Accumulate $15,000 lifetime Clean Cash through banks, clubs, and legal exports to secure permanent regional dominance.',
    rewardClean: 5000,
    rewardDirty: 5000,
    targetValue: 15000,
    metric: 'totalCleanEarned'
  },
  {
    id: 'm7_rural_zone',
    act: 2,
    title: 'Another stretch of country',
    desc: 'Unlock Selva Alta, Boca del Río, or Mesa Grande. Open plots are cheap. Standing farms cost more and come ready.',
    rewardClean: 900,
    rewardDirty: 400,
    targetValue: 1,
    metric: 'ruralZones'
  },
  {
    id: 'm8_buy_city',
    act: 2,
    title: 'A deed in Puerto Sol',
    desc: 'Buy a standing city building and convert it, or clear the lot and build to fit.',
    rewardClean: 1200,
    rewardDirty: 600,
    targetValue: 1,
    metric: 'cityProperties'
  },
  {
    id: 'm9_hold_block',
    act: 3,
    title: 'Hold the block',
    desc: 'Own enough of a Puerto Sol neighborhood to push control to 45%.',
    rewardClean: 2000,
    rewardDirty: 1000,
    targetValue: 45,
    metric: 'cityControl'
  }
];

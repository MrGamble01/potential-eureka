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
    bounds: { x: 120, y: 140, w: 680, h: 640 },
    tint: 0x5d7042,
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
    bounds: { x: 820, y: 140, w: 680, h: 640 },
    tint: 0x6e6547,
    borderColor: 0x7aa2f7,
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
    bounds: { x: 1520, y: 140, w: 660, h: 640 },
    tint: 0x586651,
    borderColor: 0xd98a4e,
    desc: 'Remote mountain plateaus contested by Los Lobos Syndicate. Home to Highland Alkaloid Terraces, Synthesis Labs, and Bush Aerodromes.'
  }
];

// Build slots across the 3 regions (pre-surveyed clearings along the road network)
export const BUILD_SLOTS = [
  // ── Region 1: Río Plata Valley (Starter region) ──
  {
    id: 'slot_rp_farm1',
    regionId: 'rio_plata',
    label: 'Old Garage Clearing',
    x: 270,
    y: 310,
    allowedCategories: ['production', 'processing', 'logistics'],
    starterBuilding: 'plantation'
  },
  {
    id: 'slot_rp_barn1',
    regionId: 'rio_plata',
    label: 'Creekside Mill Lot',
    x: 470,
    y: 260,
    allowedCategories: ['processing', 'production', 'logistics'],
    starterBuilding: 'drying_barn'
  },
  {
    id: 'slot_rp_wh1',
    regionId: 'rio_plata',
    label: 'Crossroads Depot',
    x: 450,
    y: 440,
    allowedCategories: ['logistics', 'processing', 'laundering'],
    starterBuilding: 'warehouse'
  },
  {
    id: 'slot_rp_pier',
    regionId: 'rio_plata',
    label: 'Río Plata Embarcadero',
    x: 280,
    y: 610,
    allowedCategories: ['export'],
    starterBuilding: 'river_pier'
  },
  {
    id: 'slot_rp_town1',
    regionId: 'rio_plata',
    label: 'Puerto Plata Plaza',
    x: 650,
    y: 560,
    allowedCategories: ['laundering', 'logistics', 'production'],
    starterBuilding: null
  },
  {
    id: 'slot_rp_south',
    regionId: 'rio_plata',
    label: 'South Valley Terrace',
    x: 660,
    y: 330,
    allowedCategories: ['production', 'processing', 'logistics'],
    starterBuilding: null
  },

  // ── Region 2: San Marco District ──
  {
    id: 'slot_sm_west',
    regionId: 'san_marco',
    label: 'Highway 4 Industrial Lot',
    x: 960,
    y: 290,
    allowedCategories: ['processing', 'logistics', 'production'],
    starterBuilding: null
  },
  {
    id: 'slot_sm_plaza',
    regionId: 'san_marco',
    label: 'Avenida Central Front',
    x: 1170,
    y: 260,
    allowedCategories: ['laundering', 'logistics'],
    starterBuilding: null
  },
  {
    id: 'slot_sm_hub',
    regionId: 'san_marco',
    label: 'San Marco Freight Yard',
    x: 1080,
    y: 450,
    allowedCategories: ['logistics', 'processing', 'laundering'],
    starterBuilding: null
  },
  {
    id: 'slot_sm_bank',
    regionId: 'san_marco',
    label: 'Cathedral Financial Block',
    x: 1350,
    y: 360,
    allowedCategories: ['laundering', 'processing'],
    starterBuilding: null
  },
  {
    id: 'slot_sm_port',
    regionId: 'san_marco',
    label: 'San Marco Customs Pier',
    x: 1220,
    y: 630,
    allowedCategories: ['export', 'logistics'],
    starterBuilding: null
  },

  // ── Region 3: Sierra Alta Highlands (Contested by Rival) ──
  {
    id: 'slot_sa_ridge1',
    regionId: 'sierra_alta',
    label: 'Cordillera North Terrace',
    x: 1660,
    y: 260,
    allowedCategories: ['production', 'processing'],
    starterBuilding: null,
    rivalControlled: true
  },
  {
    id: 'slot_sa_lab1',
    regionId: 'sierra_alta',
    label: 'Canyon Hideout',
    x: 1880,
    y: 320,
    allowedCategories: ['processing', 'production', 'logistics'],
    starterBuilding: null,
    rivalControlled: true
  },
  {
    id: 'slot_sa_town',
    regionId: 'sierra_alta',
    label: 'Villa Dorada Outpost',
    x: 1710,
    y: 490,
    allowedCategories: ['laundering', 'logistics', 'processing'],
    starterBuilding: null
  },
  {
    id: 'slot_sa_airstrip',
    regionId: 'sierra_alta',
    label: 'Mesa Grande Runway',
    x: 1980,
    y: 580,
    allowedCategories: ['export'],
    starterBuilding: null
  }
];

// Road network waypoints connecting regions and slots
export const ROAD_NETWORK = [
  // Main trunk highway across all 3 regions
  [
    { x: 270, y: 310 },
    { x: 470, y: 260 },
    { x: 660, y: 330 },
    { x: 960, y: 290 },
    { x: 1170, y: 260 },
    { x: 1350, y: 360 },
    { x: 1660, y: 260 },
    { x: 1880, y: 320 }
  ],
  // Southern valley & river road
  [
    { x: 270, y: 310 },
    { x: 450, y: 440 },
    { x: 280, y: 610 }
  ],
  // Valley to San Marco freight corridor
  [
    { x: 470, y: 260 },
    { x: 450, y: 440 },
    { x: 650, y: 560 },
    { x: 1080, y: 450 },
    { x: 1220, y: 630 }
  ],
  // San Marco internal connector
  [
    { x: 660, y: 330 },
    { x: 650, y: 560 }
  ],
  [
    { x: 960, y: 290 },
    { x: 1080, y: 450 },
    { x: 1350, y: 360 }
  ],
  // Highland pass to Airstrip
  [
    { x: 1350, y: 360 },
    { x: 1710, y: 490 },
    { x: 1980, y: 580 }
  ],
  [
    { x: 1880, y: 320 },
    { x: 1710, y: 490 }
  ],
  [
    { x: 1880, y: 320 },
    { x: 1980, y: 580 }
  ]
];

// Lieutenants with Cartel Tycoon-inspired perks, loyalty, upkeep, and regional assignment
export const LIEUTENANTS = [
  {
    id: 'cesar',
    name: 'César "El Ingeniero" Vega',
    role: 'Logistics & Fleet Chief',
    perkName: 'Truck Supplier & Route Master',
    perkDesc: '+35% production & transport speed in assigned region; +2 fleet trucks.',
    hireCostClean: 0, // Starter lieutenant / Capo right-hand
    upkeepClean: 15,
    power: 4,
    loyalty: 85,
    prodMult: 1.35,
    launderMult: 1.0,
    heatMult: 0.9,
    defensePower: 4,
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
    unlockedAtStart: false,
    avatarBg: '#542f35',
    avatarAccent: '#f85149'
  }
];

// Acts & Missions (Bridging Grow Op's 3-Act structure with Cartel Tycoon's campaign objectives)
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
  }
];

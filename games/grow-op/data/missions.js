// Grow Op: San Verde '84 — Lieutenants, the drawn regions, and the campaign.
// Act I is the valley, Act II is the other countryside, Act III is Puerto Sol
// neighborhood by neighborhood. REGIONS and BUILD_SLOTS stay the drawn map.

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

// People the campaign can put on a card. Lieutenants are also payroll.
export const CAST = [
  { id: 'cesar', name: 'César "El Ingeniero" Vega', title: 'Logistics chief', side: 'crew' },
  { id: 'nia', name: 'Nia "La Contadora" Morales', title: 'Books', side: 'crew' },
  { id: 'mateo', name: 'Mateo "El Químico" Solís', title: 'Chemist', side: 'crew' },
  { id: 'valeria', name: 'Comandante Valeria Cruz', title: 'Security', side: 'crew' },
  { id: 'ruiz', name: 'Special Agent Helen Ruiz', title: 'DEA, Miami field office', side: 'law' },
  { id: 'garza', name: 'Don Emilio "El Lobo" Garza', title: 'Boss, Los Lobos', side: 'lobos' },
  { id: 'reina', name: 'Reina Solano', title: 'Boss, Costa Negra', side: 'costa' }
];

export const FAIL_STATES = [
  {
    id: 'indictment',
    speaker: 'ruiz',
    title: 'The indictment',
    text: 'Special Agent Helen Ruiz files the indictment. The case file is full.'
  },
  {
    id: 'valley_seized',
    speaker: 'cesar',
    title: 'The valley is gone',
    text: 'Five seizures in Río Plata. César says the starter chain is finished.'
  },
  {
    id: 'betrayed',
    speaker: 'nia',
    title: 'Empty payroll',
    text: 'Every lieutenant you hired has walked. There is nobody left to run it.'
  },
  {
    id: 'broke',
    speaker: 'nia',
    title: 'Nothing growing',
    text: 'The purses are empty and nothing on the plots is producing.'
  }
];

export const ACTS = {
  1: {
    id: 1,
    badge: 'ACT I — THE VALLEY',
    name: 'Act I: The Valley',
    summary: 'César runs the Río Plata chain from the farm to the pier. Special Agent Helen Ruiz is already writing your name down. Open a front before the heat does.'
  },
  2: {
    id: 2,
    badge: 'ACT II — THE COUNTRY',
    name: 'Act II: Rural Expansion',
    summary: 'Take Boca del Río, then a second stretch of country. Put a lieutenant on the new ground and land a boat before Reina Solano and Don Emilio Garza decide the rivers are theirs.'
  },
  3: {
    id: 3,
    badge: 'ACT III — PUERTO SOL',
    name: 'Act III: Puerto Sol',
    summary: 'Take the city neighborhood by neighborhood: Barrio Sol, the Docks, Downtown, the Beach, then the Hills. Hold a block. Do not let Ruiz close the case.'
  }
};

export const MISSIONS = [
  {
    id: 'm1_first_export',
    act: 1,
    speaker: 'cesar',
    title: 'First River Export',
    beat: 'César stands on the embarcadero. "If the river pays, we stay. If it doesn\'t, Ruiz already has the plate number."',
    desc: 'Run the valley chain — farm, barn, warehouse, pier — until lifetime dirty cash reaches $55,000.',
    failHint: 'A dead pier and an empty purse is how the valley ends.',
    rewardClean: 500,
    rewardDirty: 0,
    targetValue: 55000,
    metric: 'totalDirtyEarned'
  },
  {
    id: 'm1_heat',
    act: 1,
    speaker: 'ruiz',
    title: 'Ruiz Writes It Down',
    beat: 'A sedan with government plates idles on the plaza. Special Agent Helen Ruiz has a notepad, not a warrant. Yet. Bribe the commandante or kill the lights.',
    desc: 'Handle the valley heat once: pay the authorities, or slip a patrol.',
    failHint: 'Ignore her and the seizures stack toward an empty valley.',
    rewardClean: 180,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'heatHandled'
  },
  {
    id: 'm2_first_front',
    act: 1,
    speaker: 'nia',
    title: 'Open a Legal Front',
    beat: 'Nia will not touch the books until a taxi fleet exists. "The city takes clean cash. Street bills are how you get arrested."',
    desc: 'Build a taxi fleet on an open valley lot and launder lifetime clean cash to $5,000.',
    failHint: 'No front means no city, and a broke crew walks.',
    rewardClean: 500,
    rewardDirty: 0,
    targetValue: 5000,
    metric: 'totalCleanEarned',
    requireBuilding: 'taxi_co'
  },
  {
    id: 'm2_open_delta',
    act: 2,
    speaker: 'cesar',
    title: 'Open Boca del Río',
    beat: 'César wants the delta. "The valley road is a confession. Boats leave Boca quieter, and Costa Negra already knows the bends."',
    desc: 'Open Boca del Río, then keep washing until lifetime clean cash reaches $55,000.',
    failHint: 'Stay in the valley and Reina Solano keeps the water.',
    rewardClean: 500,
    rewardDirty: 0,
    targetValue: 55000,
    metric: 'totalCleanEarned',
    zoneId: 'river_delta',
    requireZone: 'river_delta'
  },
  {
    id: 'm2_delta_work',
    act: 2,
    speaker: 'mateo',
    title: 'A Site Outside the Valley',
    beat: 'Mateo wants dirt that is not the starter farm. "Buy the sawmill or raise a new plot in the delta. I will not cook in a rented barn forever."',
    desc: 'Own a working operation in a rural zone that is not Río Plata. The delta sawmill converts today. An open plot takes build time.',
    failHint: 'One valley farm is not an expansion.',
    rewardClean: 250,
    rewardDirty: 150,
    targetValue: 1,
    metric: 'ruralOperations'
  },
  {
    id: 'm2_second_country',
    act: 2,
    speaker: 'garza',
    title: 'A Second Stretch of Country',
    beat: 'Don Emilio "El Lobo" Garza sends word from Selva Alta. "The highlands are mine until you pay the gate. Bring a second countryside or stay a valley rumor."',
    desc: 'Unlock a second rural zone beyond the valley. Selva Alta is the cheaper gate. Mesa Grande can wait.',
    failHint: 'One new river is not the country.',
    rewardClean: 300,
    rewardDirty: 0,
    targetValue: 2,
    metric: 'ruralZones'
  },
  {
    id: 'm2_second_lieutenant',
    act: 2,
    speaker: 'nia',
    title: 'Someone on the New Ground',
    beat: 'Nia will take Boca if you put her on the payroll and send her. "César in the valley is one man. One man is how lieutenants start skimming."',
    desc: 'Hire a second lieutenant and assign them to a zone that is not the valley.',
    failHint: 'An unpaid, unposted crew is how betrayal starts.',
    rewardClean: 200,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'assignedOutside',
    requireLieutenants: 2
  },
  {
    id: 'm2_boat_run',
    act: 2,
    speaker: 'reina',
    title: 'Land a Boat',
    beat: 'Reina Solano hears you have water. "If the boat lands, Costa Negra knows your name. If it sinks, Helen Ruiz does. I prefer the first."',
    desc: 'Finish one boat run. Load cured packs, or whatever the chain is holding, from a lot you operate.',
    failHint: 'A lost load feeds Ruiz\'s file.',
    rewardClean: 400,
    rewardDirty: 200,
    targetValue: 1,
    metric: 'boatRuns'
  },
  {
    id: 'm3_barrio',
    act: 3,
    speaker: 'reina',
    title: 'Barrio Sol',
    beat: 'Reina taps the map at Calle 8. "Puerto Sol starts in the barrio. Buy the laundromat and wash there, or you are a tourist with a boat."',
    desc: 'Open Barrio Sol, own a working property there, and push lifetime dirty cash to $450,000.',
    failHint: 'No barrio deed and the city never opens.',
    rewardClean: 500,
    rewardDirty: 0,
    targetValue: 450000,
    metric: 'totalDirtyEarned',
    zoneId: 'ps_barrio',
    requireZone: 'ps_barrio',
    requireProperty: 'ps_barrio'
  },
  {
    id: 'm3_docks',
    act: 3,
    speaker: 'cesar',
    title: 'The Docks',
    beat: 'César wants the docks moving valley crates. "A garage or a warehouse, I don\'t care, as long as it distributes. Postcards do not pay the pier."',
    desc: 'Unlock the docks and run a distribution front there.',
    failHint: 'Rural crates with nowhere to land just sit and rot.',
    rewardClean: 350,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'zoneRole',
    zoneId: 'ps_docks',
    role: 'distribution'
  },
  {
    id: 'm3_downtown',
    act: 3,
    speaker: 'nia',
    title: 'Downtown',
    beat: 'Nia will not call it a city until Downtown has your name on a deed. "The car lot washes better than the bank, and the bank asks worse questions."',
    desc: 'Unlock Downtown and own a working property on that grid.',
    failHint: 'A city without the grid is still a neighborhood.',
    rewardClean: 400,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'zoneProperty',
    zoneId: 'ps_downtown'
  },
  {
    id: 'm3_beach',
    act: 3,
    speaker: 'reina',
    title: 'The Beach',
    beat: 'The beach is Reina\'s living room. "Take the Sea Breeze motel. Leave Club Marea until you can afford Don Emilio\'s kind of fight and mine."',
    desc: 'Unlock the beach and own the Sea Breeze motel. The rival nightclub is a different war.',
    failHint: 'The motel is the deed. The club is how you pick a fight you cannot finish.',
    rewardClean: 350,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'lotOwned',
    lotId: 'lot_bh_motel'
  },
  {
    id: 'm3_hold_barrio',
    act: 3,
    speaker: 'ruiz',
    title: 'Hold Barrio Sol',
    beat: 'Ruiz\'s informant says a neighborhood is yours when the block answers to you. "Forty percent and I have to admit it in the file. Under that, you are a guest."',
    desc: 'Push Barrio Sol to 40% control. More deeds raise it. Heat and the local crew pull it down.',
    failHint: 'Lose the block and the indictment writes itself.',
    rewardClean: 500,
    rewardDirty: 0,
    targetValue: 40,
    metric: 'zoneControl',
    zoneId: 'ps_barrio'
  },
  {
    id: 'm3_hills',
    act: 3,
    speaker: 'garza',
    title: 'The Hills',
    beat: 'Don Emilio watches Los Cerros. "The villas are mine to look at. Open the hills and put any deed in your pocket, or stay down in the heat."',
    desc: 'Unlock the Hills and own a working property there. The market motel is enough. The villa can wait.',
    failHint: 'Leave the hills and Los Lobos keep the quiet ground.',
    rewardClean: 400,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'zoneProperty',
    zoneId: 'ps_hills'
  },
  {
    id: 'm3_city',
    act: 3,
    speaker: 'valeria',
    title: 'Neighborhood by Neighborhood',
    beat: 'Valeria counts the deeds out loud. Barrio, docks, downtown, beach, hills. "Five. Puerto Sol is no longer a rumor. Ruiz can file whatever she wants."',
    desc: 'Hold working properties in five Puerto Sol neighborhoods.',
    failHint: 'A city you do not hold is just a place Ruiz can search.',
    rewardClean: 1200,
    rewardDirty: 600,
    targetValue: 5,
    metric: 'cityNeighborhoods'
  }
];

// Core mode only. Cartel Tycoon's early loop, one step at a time:
// production building, processing, storage, transport, then sale.
// The sell target is the Act I clock. Flag off uses MISSIONS above.
export const CORE_ACT1_EARN = 39000;

export const CORE_MISSIONS = [
  {
    id: 'c1_grow',
    act: 1,
    speaker: 'cesar',
    title: 'Grow the crop',
    beat: 'The plantation is in the ground. Let the first cutting come up.',
    desc: 'Grow 8 raw botanicals on the valley plantation.',
    failHint: 'A quiet field does not pay the pier.',
    rewardClean: 0,
    rewardDirty: 0,
    targetValue: 8,
    metric: 'producedRaw'
  },
  {
    id: 'c1_process',
    act: 1,
    speaker: 'cesar',
    title: 'Process the harvest',
    beat: 'The barn cures what the field cuts.',
    desc: 'Cure 8 packs in the drying barn.',
    failHint: 'Raw leaf does not sell.',
    rewardClean: 0,
    rewardDirty: 0,
    targetValue: 8,
    metric: 'producedCured'
  },
  {
    id: 'c1_store',
    act: 1,
    speaker: 'cesar',
    title: 'Store the packs',
    beat: 'The warehouse is the pile between the barn and the road.',
    desc: 'Truck 6 crates into the valley warehouse.',
    failHint: 'Packs left in the barn never reach the pier.',
    rewardClean: 0,
    rewardDirty: 0,
    targetValue: 6,
    metric: 'stored'
  },
  {
    id: 'c1_haul',
    act: 1,
    speaker: 'cesar',
    title: 'Haul it down the road',
    beat: 'Trucks are the chain. Nothing moves itself.',
    desc: 'Finish 4 truck runs on the valley road.',
    failHint: 'A full shed with no truck is just a shed.',
    rewardClean: 0,
    rewardDirty: 0,
    targetValue: 4,
    metric: 'hauled'
  },
  {
    id: 'c1_sell',
    act: 1,
    speaker: 'cesar',
    title: 'Sell at the pier',
    beat: 'The pier is the sale. Keep the chain moving until the river has paid.',
    desc: `Sell downriver until lifetime dirty cash reaches $${CORE_ACT1_EARN.toLocaleString()}.`,
    failHint: 'A pier that does not ship does not pay.',
    rewardClean: 0,
    rewardDirty: 0,
    targetValue: CORE_ACT1_EARN,
    metric: 'totalDirtyEarned',
    alsoComplete: ['m1_first_export']
  },
  {
    id: 'c1_plot',
    act: 1,
    speaker: 'cesar',
    title: 'Build the next field',
    beat: 'One plantation is the lesson. The south terrace is the next field.',
    desc: 'Build a plantation on the south valley terrace.',
    failHint: 'The chain you have is the chain you keep until you build.',
    rewardClean: 0,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'slotBuilding',
    slotId: 'slot_rp_south',
    buildingId: 'plantation',
    alsoComplete: ['m2_first_front']
  },
  {
    id: 'c2_zone',
    act: 2,
    speaker: 'cesar',
    title: 'Open the next stretch',
    beat: 'The valley road ends. Boca del Río is the next gate.',
    desc: 'Unlock Boca del Río. The price comes out of dirty cash.',
    failHint: 'Stay in one valley and the chain never grows.',
    rewardClean: 0,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'zoneUnlocked',
    zoneId: 'river_delta'
  },
  {
    id: 'c2_lot',
    act: 2,
    speaker: 'cesar',
    title: 'Buy the sawmill',
    beat: 'The sawmill is already standing. Pay the price and it stores for you.',
    desc: 'Buy the Boca sawmill and run it as a warehouse.',
    failHint: 'A locked gate with no deed is not a route.',
    rewardClean: 0,
    rewardDirty: 0,
    targetValue: 1,
    metric: 'zoneProperty',
    zoneId: 'river_delta'
  }
];

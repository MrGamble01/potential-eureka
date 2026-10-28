// games/homeless-village/data/npcs.js
// Preserves workers, regulars, favors, city petitions, clinic & storm companions, and Biscuit.

export const WORKER_DEFS = [
  { id: 'scrapper', icon: '🔍', name: 'Scrapper', cost: 8,  role: 'Forager', desc: 'Auto-scavenges scraps and cans every dawn.' },
  { id: 'builder',  icon: '🔨', name: 'Builder',  cost: 12, role: 'Artisan', desc: 'Speeds up all crafting by 2x.' },
  { id: 'cook',     icon: '👨‍🍳', name: 'Cook',     cost: 10, role: 'Steward', desc: 'Turns 3 food into warm meals (+2 goodwill) each dawn.' },
  { id: 'lookout',  icon: '👁️', name: 'Lookout',  cost: 15, role: 'Watcher', desc: 'Reveals tomorrow’s weather and gives 30s warning before sweeps.' }
];

export const REGULARS = [
  {
    id: 'marisol',
    icon: '🌮',
    name: 'Marisol',
    who: 'runs the taquería on the corner',
    how: 'Trade goods — she respects honest dealing',
    perk: 'sends leftovers to the camp some mornings & stows goods in her garage before a sweep',
    color: 0xd97736
  },
  {
    id: 'ray',
    icon: '🎖️',
    name: 'Old Ray',
    who: 'holds the bench by the bridge',
    how: 'Rest nearby — he likes the company',
    perk: 'points out which dumpsters are worth the walk & fronts goodwill on his ledger',
    color: 0x6b8e78
  },
  {
    id: 'dee',
    icon: '🩺',
    name: 'Dee',
    who: 'walks home from night shifts at County',
    how: 'Panhandle her route — she always stops',
    perk: 'patches you up when you’re in rough shape & takes a friendly rain bet',
    color: 0x5c88b8
  }
];

export const FAVORS = {
  marisol: {
    need: { cans: 3 },
    give: { goodwill: 4 },
    ask: 'Marisol could use 3 cans for the taquería’s recycling run.'
  },
  ray: {
    need: { food: 2 },
    give: { goodwill: 3 },
    ask: 'Old Ray hasn’t eaten right in days — 2 food would fix that.'
  },
  dee: {
    need: { scraps: 2 },
    give: { goodwill: 3 },
    ask: 'Dee’s bike rack needs 2 scraps of steel.'
  }
};

export const PETITIONS = [
  {
    id: 'sanitation',
    icon: '🚻',
    name: 'Sanitation Unit',
    cost: 15,
    desc: 'The city drops a portable unit by the underpass. Everyone wakes +1 health at dawn and illness hits half as hard.'
  },
  {
    id: 'streetlight',
    icon: '💡',
    name: 'Street Light',
    cost: 20,
    desc: 'A working municipal light over the camp. Thieves take half as much at night.'
  },
  {
    id: 'grant',
    icon: '📋',
    name: 'Community Grant',
    cost: 30,
    desc: 'A one-time neighborhood grant: +8 food, +8 wood, +8 scraps delivered to the corner.'
  }
];

export const REP_TIERS = [
  { at: 0,  name: 'A Stranger', icon: '💬' },
  { at: 25, name: 'Known',      icon: '💬' },
  { at: 50, name: 'Respected',  icon: '🤝' },
  { at: 75, name: 'Beloved',    icon: '💛' }
];

export const ODD_JOBS = [
  { id: 'depot',   icon: '📦', label: 'Unload at the depot',      time: 8000, gives: { goodwill: 5 },           desc: 'A morning of honest lifting. +5 goodwill.' },
  { id: 'flyers',  icon: '📄', label: 'Hand out flyers',          time: 6000, gives: { goodwill: 3, morale: 4 }, desc: 'A local shop pays a little, and the owner is kind. +3 goodwill, +4 hope.' },
  { id: 'gardenh', icon: '🌿', label: 'Weed the community lot',   time: 7000, gives: { food: 4 },               desc: 'The garden co-op shares the harvest. +4 food.' },
  { id: 'scrapyd', icon: '🔩', label: 'Sort at the scrapyard',    time: 8000, gives: { scraps: 5, cans: 2 },     desc: 'Dirty work, decent haul. +5 scraps, +2 cans.' },
  { id: 'dogwalk', icon: '🐕', label: 'Walk the neighbor’s dogs', time: 5000, gives: { goodwill: 2, morale: 6 }, desc: 'Fresh air, wagging tails. +2 goodwill, +6 hope.' }
];

export const MURAL_PANELS = 4;
export const MURAL_LINES = [
  'The first panel goes up: a sunrise over the bridge, in traffic-cone orange.',
  'Second panel: the camp’s barrel fire, painted bigger than life.',
  'Third panel: every regular on the block gets a face on the wall.',
  'The last panel: a door standing open. Everyone paints a piece of it.'
];
export const MURAL_BEATS = [
  'Sunrise over the bridge',
  'Barrel fire on the wall',
  'Faces on the wall',
  'A door standing open'
];

export const CLINIC_CONSTANTS = {
  CARE_MAX: 100,
  DROP: 8,
  JUNE_DROP: 4,
  DRESS_CARE: 25,
  DRESS_HEALTH: 8,
  JUNE_AT: 3,
  STEADY_LINE: 40,
  NEGLECT_HEALTH: 6,
  ASK_HIT: 12,
  REBUILD_CARE: 45
};

export const STORM_CONSTANTS = {
  PHASE_MS: 8000,
  FAIL_WARMTH: 8,
  FAIL_HEALTH: 4,
  PHASES: [
    {
      id: 'tarp',
      title: 'Weight the tarp',
      need: 'scraps',
      cost: 2,
      player: 'You pile scrap on the windward corners.',
      rio: 'Rio drops scrap on the corner that is lifting.'
    },
    {
      id: 'fire',
      title: 'Feed the barrel',
      need: 'wood',
      cost: 2,
      player: 'You feed the barrel. The flame stands up.',
      rio: 'Rio shoves two sticks in. The wind does not get the fire.'
    },
    {
      id: 'heads',
      title: 'Count heads',
      need: null,
      cost: 0,
      player: 'You count everyone still under the bridge.',
      rio: 'Rio already has the count. Nobody is left in the lot.'
    }
  ]
};

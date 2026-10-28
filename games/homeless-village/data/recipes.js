// games/homeless-village/data/recipes.js
// Preserves all recipes, costs, timings, descriptions, and prerequisites from Homeless Village.

export const BUILDER_CRAFT_MULT = 0.5;
export const BARREL_CAP = 3;
export const COATS_CUT = 0.5;
export const AWNING_DRY = 2;
export const TOOLBOX_JOB_BONUS = 2;

export const RECIPES = [
  {
    id: 'fire_ration',
    icon: '🔥',
    name: 'Firewood',
    category: 'survival',
    station: 'barrel_fire',
    cost: { wood: 3 },
    gives: { warmth: 10 },
    time: 2000,
    desc: 'Keep the barrel burning. Restores warmth and relights a dead fire.'
  },
  {
    id: 'blanket',
    icon: '🧣',
    name: 'Blanket',
    category: 'survival',
    station: 'camp',
    cost: { scraps: 3, cardboard: 2 },
    gives: { warmth: 15 },
    time: 4000,
    desc: 'Keeps someone warm tonight.'
  },
  {
    id: 'meal',
    icon: '🥣',
    name: 'Hot Meal',
    category: 'survival',
    station: 'barrel_fire',
    cost: { food: 4, cans: 1 },
    gives: { goodwill: 3 },
    time: 3000,
    desc: 'Feed a community member over the barrel fire.'
  },
  {
    id: 'shelter',
    icon: '⛺',
    name: 'Patch Shelter',
    category: 'survival',
    station: 'camp',
    cost: { cardboard: 4, scraps: 2 },
    gives: { warmth: 8 },
    time: 5000,
    desc: 'Reinforce a sleeping spot against the wind.'
  },
  {
    id: 'workbench',
    icon: '🔧',
    name: 'Workbench',
    category: 'structure',
    station: 'workbench',
    cost: { wood: 5, scraps: 4 },
    gives: { structure: 'workbench' },
    time: 8000,
    desc: 'Enables crafting camp upgrades and shelters.'
  },
  {
    id: 'tent',
    icon: '🏕️',
    name: 'Tent',
    category: 'structure',
    station: 'tent',
    cost: { cardboard: 8, scraps: 6, wood: 3 },
    gives: { structure: 'tent', warmth: 20 },
    time: 10000,
    requires: 'workbench',
    desc: 'A roof of sorts. Keeps warmth in and gives newcomers a bed.'
  },
  {
    id: 'soup_kitchen',
    icon: '🍲',
    name: 'Soup Kitchen',
    category: 'structure',
    station: 'soup_kitchen',
    cost: { wood: 10, scraps: 8, cans: 5, goodwill: 5 },
    gives: { structure: 'soup_kitchen' },
    time: 15000,
    requires: 'workbench',
    desc: 'Soup night: feeds everyone at dawn (1 food each) for +4 hope, +2 health — and neighbors sometimes chip in.'
  },
  {
    id: 'garden',
    icon: '🌱',
    name: 'Community Garden',
    category: 'structure',
    station: 'garden',
    cost: { wood: 6, goodwill: 8, food: 3 },
    gives: { structure: 'garden' },
    time: 12000,
    requires: 'workbench',
    desc: 'Slowly generates food each day. Winter sleeps the beds. Gets destroyed in sweeps.'
  },
  {
    id: 'clinic',
    icon: '🏥',
    name: 'Night Clinic',
    category: 'structure',
    station: 'clinic',
    cost: { wood: 7, scraps: 5, cardboard: 3, goodwill: 4 },
    gives: { structure: 'clinic' },
    time: 11000,
    requires: 'workbench',
    desc: 'A tarp, a cot, and a red cross cut from a reflector. Care falls every dawn. Dress wounds here, and a street medic named June may stay.'
  },
  {
    id: 'gauze',
    icon: '🩹',
    name: 'Gauze Roll',
    category: 'survival',
    station: 'clinic',
    cost: { scraps: 2, cardboard: 1 },
    gives: { bandages: 2 },
    time: 3000,
    requires: 'clinic',
    desc: 'Two clean rolls from scrap cloth. The clinic keeps them dry. Each roll dresses one wound.'
  },
  {
    id: 'gate',
    icon: '🚪',
    name: 'Storm Gate',
    category: 'structure',
    station: 'gate',
    cost: { wood: 6, scraps: 4, goodwill: 3 },
    gives: { structure: 'gate' },
    time: 9000,
    requires: 'clinic',
    desc: 'Posts and a rope across the path to the river lot. Opens a new ground, and a watcher named Rio comes up from the water.'
  },
  {
    id: 'radio',
    icon: '📻',
    name: 'Radio',
    category: 'structure',
    station: 'workbench',
    cost: { scraps: 5, cans: 3 },
    gives: { structure: 'radio' },
    time: 6000,
    requires: 'workbench',
    desc: 'A crackly weather band — see tomorrow’s sky coming.'
  },
  {
    id: 'stash',
    icon: '🕳️',
    name: 'Hidden Stash',
    category: 'structure',
    station: 'stash',
    cost: { wood: 4, scraps: 3, cardboard: 2 },
    gives: { structure: 'stash' },
    time: 7000,
    requires: 'workbench',
    desc: 'A buried cache under the fence line. Thieves and sweeps take half as much — and nobody ever finds the hole itself.'
  },
  {
    id: 'guitar',
    icon: '🎸',
    name: 'Scrap Guitar',
    category: 'structure',
    station: 'corner',
    cost: { scraps: 8, wood: 4 },
    gives: { structure: 'guitar' },
    time: 9000,
    requires: 'workbench',
    desc: 'Strings from a fence, a body from a pallet. One set a day on the corner — the take rides the camp’s spirits.'
  },
  {
    id: 'cart',
    icon: '🛒',
    name: 'Shopping Cart',
    category: 'structure',
    station: 'dumpster',
    cost: { scraps: 6, wood: 2 },
    gives: { structure: 'cart' },
    time: 7000,
    requires: 'workbench',
    desc: 'A liberated cart with a true wheel. Makes the deposit run possible: haul every can to the redemption center in one trip.'
  },
  {
    id: 'pantry',
    icon: '🥣',
    name: 'Free Pantry',
    category: 'structure',
    station: 'corner',
    cost: { wood: 6, scraps: 2 },
    gives: { structure: 'pantry' },
    time: 8000,
    requires: 'workbench',
    desc: 'A little box on a post: take what you need, leave what you can. Some dawns the neighborhood leaves something.'
  },
  {
    id: 'coats',
    icon: '🧥',
    name: 'Coat Rack',
    category: 'structure',
    station: 'barrel_fire',
    cost: { scraps: 5, goodwill: 6 },
    gives: { structure: 'coats' },
    time: 9000,
    requires: 'workbench',
    desc: 'Donated coats on a rail by the fire — on bitter dawns the cold cuts half as deep.'
  },
  {
    id: 'toolbox',
    icon: '🧰',
    name: 'Tool Box',
    category: 'structure',
    station: 'workbench',
    cost: { scraps: 6, cans: 2 },
    gives: { structure: 'toolbox' },
    time: 7000,
    requires: 'workbench',
    desc: 'Good tools, oiled and kept — the workbench never falls apart again, and an odd job done with the right tools earns +2 goodwill.'
  },
  {
    id: 'compost',
    icon: '♻️',
    name: 'Compost Bin',
    category: 'structure',
    station: 'garden',
    cost: { scraps: 3, food: 2 },
    gives: { structure: 'compost' },
    time: 6000,
    requires: 'workbench',
    desc: 'Scraps in, black gold out — the garden yields +1 every day it gives, and the bin’s heat keeps one bed alive through frost.'
  },
  {
    id: 'awning',
    icon: '⛱️',
    name: 'Awning',
    category: 'structure',
    station: 'corner',
    cost: { scraps: 4, cans: 2 },
    gives: { structure: 'awning' },
    time: 8000,
    requires: 'workbench',
    desc: 'A salvaged shop awning rigged over the corner — rain doesn’t close the panhandling spot anymore.'
  },
  {
    id: 'barrel',
    icon: '🛢️',
    name: 'Rain Barrel',
    category: 'structure',
    station: 'garden',
    cost: { scraps: 5, cans: 1 },
    gives: { structure: 'barrel' },
    time: 7000,
    requires: 'workbench',
    desc: 'A salvaged drum under the downspout — every rainy dawn stores a day of water (up to 3), watering dry garden beds +1.'
  }
];

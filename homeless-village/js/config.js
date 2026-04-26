var SAVE_KEY = 'homeless_village_v1';

var G = {
  days: 0,
  timeOfDay: 0,
  daySpeed: 0.00025,
  season: 0,

  food: 0, scraps: 0, cans: 0, cardboard: 0, wood: 0, goodwill: 0,
  health: 100, warmth: 80, morale: 50, population: 1,

  workers: { scrapper:false, builder:false, cook:false, lookout:false },
  structures: { barrel_fire:true, workbench:false, tent:false, soup_kitchen:false, garden:false },

  cooldowns: {},
  sweepWarned: false, sweepCountdown: 0,
  injuredUntil: 0, lastEventDay: -2,

  totalScavenged: 0, totalCrafted: 0, peakPopulation: 1, timesSwept: 0,
};

var RECIPES = [
  {id:'blanket',     icon:'🧣', name:'Blanket',       cost:{scraps:3,cardboard:2},           gives:{warmth:15},              time:4000,  desc:'Keeps someone warm tonight.'},
  {id:'meal',        icon:'🥣', name:'Hot Meal',       cost:{food:4,cans:1},                  gives:{goodwill:3},             time:3000,  desc:'Feed a community member.'},
  {id:'shelter',     icon:'⛺', name:'Patch Shelter',  cost:{cardboard:4,scraps:2},           gives:{warmth:8},               time:5000,  desc:'Reinforce a sleeping spot.'},
  {id:'workbench',   icon:'🔧', name:'Workbench',      cost:{wood:5,scraps:4},                gives:{structure:'workbench'},  time:8000,  desc:'Enables crafting upgrades.'},
  {id:'tent',        icon:'🏕️', name:'Tent',           cost:{cardboard:8,scraps:6,wood:3},   gives:{structure:'tent',warmth:20}, time:10000, desc:'A roof of sorts.'},
  {id:'fire_ration', icon:'🔥', name:'Firewood',       cost:{wood:3},                         gives:{warmth:10},              time:2000,  desc:'Keep the barrel burning.'},
  {id:'soup_kitchen',icon:'🍲', name:'Soup Kitchen',   cost:{wood:10,scraps:8,cans:5,goodwill:5}, gives:{structure:'soup_kitchen'}, time:15000, desc:'Feed more people, gain more goodwill.'},
  {id:'garden',      icon:'🌱', name:'Community Garden',cost:{wood:6,goodwill:8,food:3},      gives:{structure:'garden'},     time:12000, desc:'Slowly generates food each day. Gets destroyed in sweeps.'},
];

var ACTIONS = [
  {id:'scavenge',  icon:'🗑️', label:'Scavenge Dumpster', time:5000, cooldown:8000,  tooltip:'Dig through dumpsters for scraps, cans, or food.'},
  {id:'forage',    icon:'🌿', label:'Forage Area',        time:4000, cooldown:12000, tooltip:'Search the surroundings for cardboard and wood.'},
  {id:'panhandle', icon:'🪙', label:'Panhandle',          time:6000, cooldown:15000, tooltip:'Ask strangers for change. Degrading, but sometimes necessary.'},
  {id:'rest',      icon:'💤', label:'Rest',               time:3000, cooldown:20000, tooltip:'Recover health and morale slightly.'},
  {id:'trade',     icon:'🤝', label:'Trade Goods',        time:2000, cooldown:18000, tooltip:'Trade cans for food (3 cans → 2 food).'},
];

var WORKER_DEFS = [
  {id:'scrapper', icon:'🔍', name:'Scrapper', cost:8,  desc:'Auto-scavenges every day'},
  {id:'builder',  icon:'🔨', name:'Builder',  cost:12, desc:'Speeds up crafting x2'},
  {id:'cook',     icon:'👨‍🍳', name:'Cook',     cost:10, desc:'Makes meals from food automatically'},
  {id:'lookout',  icon:'👁️', name:'Lookout',  cost:15, desc:'Warns before police sweeps'},
];

var activeJobs = {};

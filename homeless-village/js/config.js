var SAVE_KEY = 'homeless_village_v1';

// One in-game day in real milliseconds. The old per-ms daySpeed
// multiplier (0.00025) made a full day last 4 real seconds — a units
// bug that had onNewDay's decay/warmth/event rolls firing ~15x per
// minute while action cooldowns were tuned in real seconds. Lives
// OUTSIDE G on purpose: saveGame serializes G wholesale, so a stale
// daySpeed in an old save must not be able to shrink the day again.
var DAY_LENGTH_MS = 600000; // 10 minutes per day

var G = {
  days: 0,
  timeOfDay: 0,
  season: 0,
  weather: 'clear', forecast: null,   // HV-5: today's sky + tomorrow's roll

  food: 0, scraps: 0, cans: 0, cardboard: 0, wood: 0, goodwill: 0,
  health: 100, warmth: 80, morale: 50, population: 1,

  workers: { scrapper:false, builder:false, cook:false, lookout:false },
  structures: { barrel_fire:true, workbench:false, tent:false, soup_kitchen:false, garden:false, radio:false },

  cooldowns: {},
  activeCrafts: {},   // id → {start, duration}; persisted so paid-for crafts survive reloads
  sweepWarned: false, sweepCountdown: 0, packedUp: false,
  injuredUntil: 0, lastEventDay: -2,

  // HV-6: the stray dog. 0 = not met, 1 = wary stray at the fence line,
  // 2 = Biscuit is part of the camp. Staged deterministically (checkDog),
  // like the Case Worker arc, so the companion can't be missed by RNG.
  dog: 0, dogMetDay: 0, dogHungry: false,

  // HV-7: the regulars — named neighborhood figures whose affinity grows
  // through the actions you already take. 0-10 each; 5+ is friendship
  // and unlocks their standing favor.
  regulars: { marisol: 0, ray: 0, dee: 0 }, lastDeeDay: -9,

  // HV-8: the day the posted odd job was last completed (-1 = never)
  oddJobDay: -1,

  // HV-9: Word on the Street — 0–100 neighborhood reputation. Earned by
  // odd jobs, trades, panhandle successes and regular friendships; fades
  // a point each dawn. repGiftDay caps Beloved gifts at one per day.
  rep: 0, repGiftDay: -1,

  // HV-10: nights the Soup Kitchen fed the whole camp
  soupNights: 0,

  totalScavenged: 0, totalCrafted: 0, peakPopulation: 1, timesSwept: 0,
  goalIndex: 0,
  // Case Worker arc (IDEA-HV-3): 0 = not met, 1 = card left, 2 = paperwork
  // started, 3 = housed. arcDone marks the post-ending sandbox.
  arcStage: 0, arcDone: false,
};

// `requires` gates a recipe on an already-built structure (checked by
// canCraft() in ui.js). Only the Workbench's "upgrade" recipes — the
// bigger structures — are gated; basic survival crafts stay available
// from day one so a fresh camp with no Workbench isn't soft-locked.
var RECIPES = [
  {id:'blanket',     icon:'🧣', name:'Blanket',       cost:{scraps:3,cardboard:2},           gives:{warmth:15},              time:4000,  desc:'Keeps someone warm tonight.'},
  {id:'meal',        icon:'🥣', name:'Hot Meal',       cost:{food:4,cans:1},                  gives:{goodwill:3},             time:3000,  desc:'Feed a community member.'},
  {id:'shelter',     icon:'⛺', name:'Patch Shelter',  cost:{cardboard:4,scraps:2},           gives:{warmth:8},               time:5000,  desc:'Reinforce a sleeping spot.'},
  {id:'workbench',   icon:'🔧', name:'Workbench',      cost:{wood:5,scraps:4},                gives:{structure:'workbench'},  time:8000,  desc:'Enables crafting upgrades.'},
  {id:'tent',        icon:'🏕️', name:'Tent',           cost:{cardboard:8,scraps:6,wood:3},   gives:{structure:'tent',warmth:20}, time:10000, desc:'A roof of sorts.', requires:'workbench'},
  {id:'fire_ration', icon:'🔥', name:'Firewood',       cost:{wood:3},                         gives:{warmth:10},              time:2000,  desc:'Keep the barrel burning.'},
  {id:'soup_kitchen',icon:'🍲', name:'Soup Kitchen',   cost:{wood:10,scraps:8,cans:5,goodwill:5}, gives:{structure:'soup_kitchen'}, time:15000, desc:'Soup night: feeds everyone at dusk (1 food each) for +4 morale, +2 health — and neighbors sometimes chip in.', requires:'workbench'},
  {id:'garden',      icon:'🌱', name:'Community Garden',cost:{wood:6,goodwill:8,food:3},      gives:{structure:'garden'},     time:12000, desc:'Slowly generates food each day. Gets destroyed in sweeps.', requires:'workbench'},
  {id:'radio',       icon:'📻', name:'Radio',           cost:{scraps:5,cans:3},                gives:{structure:'radio'},      time:6000,  desc:'A crackly weather band — see tomorrow\u2019s sky coming.', requires:'workbench'},
];

// ── Weather (HV-5) ────────────────────────────────────────────
// One sky per day, rolled a day AHEAD so preparation is possible: the
// Lookout (or a crafted Radio) reveals tomorrow's weather, turning
// "craft firewood or panhandle?" into an informed call instead of luck.
// warmth: extra drain at dawn (negative = a warm day gives some back).
// pan: multiplier on panhandle success. scav: multiplier on dumpster yield.
var WEATHERS = {
  clear: {icon:'\u2600\ufe0f',  name:'Clear',     warmth:0,   pan:1,    scav:1},
  rain:  {icon:'\ud83c\udf27\ufe0f', name:'Rain',      warmth:5,   pan:0.5,  scav:1.25},
  cold:  {icon:'\u2744\ufe0f',  name:'Cold Snap', warmth:12,  pan:0.75, scav:0.75},
  heat:  {icon:'\ud83e\udd75',  name:'Heat Wave', warmth:-8,  pan:1.5,  scav:1},
};
function rollWeather(){
  var r=Math.random();
  if(G.season===3){ return r<.35?'cold':(r<.65?'clear':(r<.9?'rain':'cold')); }   // winter bites
  if(G.season===1){ return r<.3?'heat':(r<.75?'clear':'rain'); }                  // summer swelters
  if(G.season===2){ return r<.55?'clear':(r<.8?'rain':(r<.92?'cold':'clear')); }  // autumn turns
  return r<.6?'clear':(r<.9?'rain':'clear');                                      // spring showers
}
function weatherDef(){ return WEATHERS[G.weather]||WEATHERS.clear; }
function forecastVisible(){ return G.workers.lookout || G.structures.radio; }

// ── The regulars (HV-7) ───────────────────────────────────────
// Everyone on this block has a name if you're around long enough to learn
// it. Affinity grows through actions you already take (no new buttons):
// how counts, so each regular watches a different part of your routine.
var REGULARS = [
  {id:'marisol', icon:'🌮', name:'Marisol', who:'runs the taquería on the corner',
   how:'Trade goods — she respects honest dealing', perk:'sends leftovers to the camp some mornings'},
  {id:'ray',     icon:'🎖️', name:'Old Ray', who:'holds the bench by the bridge',
   how:'Rest nearby — he likes the company', perk:'points out which dumpsters are worth the walk'},
  {id:'dee',     icon:'🩺', name:'Dee',     who:'walks home from night shifts at County',
   how:'Panhandle her route — she always stops', perk:'patches you up when you’re in bad shape'},
];
function regularDef(id){ for(var i=0;i<REGULARS.length;i++) if(REGULARS[i].id===id) return REGULARS[i]; return null; }
function regularStage(id){ var a=(G.regulars&&G.regulars[id])||0; return a>=5?2:(a>=1?1:0); } // 0 stranger, 1 known, 2 friend

// ── The bulletin board (HV-8) ─────────────────────────────────
// One posted odd job a day, rotating deterministically with the date —
// bigger, themed payouts than the grind actions, done once and gone
// until tomorrow. Rendered as an extra action button by buildActionUI.
var ODD_JOBS = [
  {id:'depot',   icon:'📦', label:'Unload at the depot',      time:8000, gives:{goodwill:5},           desc:'A morning of honest lifting. +5 goodwill.'},
  {id:'flyers',  icon:'📄', label:'Hand out flyers',          time:6000, gives:{goodwill:3, morale:4}, desc:'A local shop pays a little, and the owner is kind. +3 goodwill, +4 morale.'},
  {id:'gardenh', icon:'🌿', label:'Weed the community lot',   time:7000, gives:{food:4},               desc:'The garden co-op shares the harvest. +4 food.'},
  {id:'scrapyd', icon:'🔩', label:'Sort at the scrapyard',    time:8000, gives:{scraps:5, cans:2},     desc:'Dirty work, decent haul. +5 scraps, +2 cans.'},
  {id:'dogwalk', icon:'🐕', label:'Walk the neighbor’s dogs', time:5000, gives:{goodwill:2, morale:6}, desc:'Fresh air, wagging tails. +2 goodwill, +6 morale.'},
];
function todaysJob(){ return ODD_JOBS[((G.days % ODD_JOBS.length) + ODD_JOBS.length) % ODD_JOBS.length]; }
function oddJobDone(){ return G.oddJobDay === G.days; }
function oddJobAction(){
  var j = todaysJob();
  return { id:'oddjob', icon:'📋', label:'Odd job: ' + j.icon + ' ' + j.label, time:j.time, cooldown:0,
    tooltip:'Today’s posting on the bulletin board. ' + j.desc + ' Once per day.' };
}

// ── HV-9: Word on the Street ──
// The neighborhood notices how you carry yourself. Tiers gate real
// effects: Known lifts panhandle odds, Respected halves the complaint
// calls that bring sweeps, Beloved means some mornings a neighbor
// leaves something at the fence.
var REP_TIERS = [
  {at:0,  name:'A Stranger', icon:'💬'},
  {at:25, name:'Known',      icon:'💬'},
  {at:50, name:'Respected',  icon:'🤝'},
  {at:75, name:'Beloved',    icon:'💛'},
];
function repTier(){ var r=G.rep||0, t=0; for(var i=0;i<REP_TIERS.length;i++) if(r>=REP_TIERS[i].at) t=i; return t; }
function addRep(n){
  var before=repTier();
  G.rep=Math.max(0,Math.min(100,(G.rep||0)+n));
  var after=repTier();
  if(after>before) log(REP_TIERS[after].icon+' Word gets around — the neighborhood counts you as '+REP_TIERS[after].name+' now.');
  else if(after<before) log('💬 Word fades — around here you are '+REP_TIERS[after].name+' again.');
}

var ACTIONS = [
  {id:'scavenge',  icon:'🗑️', label:'Scavenge Dumpster', time:5000, cooldown:8000,  tooltip:'Dig through dumpsters for scraps, cans, or food.'},
  {id:'forage',    icon:'🌿', label:'Forage Area',        time:4000, cooldown:12000, tooltip:'Search the surroundings for cardboard and wood.'},
  {id:'panhandle', icon:'🪙', label:'Panhandle',          time:6000, cooldown:15000, tooltip:'Ask strangers for change.'},
  {id:'rest',      icon:'💤', label:'Rest',               time:3000, cooldown:20000, tooltip:'Recover health and morale slightly.'},
  {id:'trade',     icon:'🤝', label:'Trade Goods',        time:2000, cooldown:18000, tooltip:'Trade cans for food (3 cans → 2 food).'},
];

var WORKER_DEFS = [
  {id:'scrapper', icon:'🔍', name:'Scrapper', cost:8,  desc:'Auto-scavenges every day'},
  {id:'builder',  icon:'🔨', name:'Builder',  cost:12, desc:'Speeds up crafting x2'},
  {id:'cook',     icon:'👨‍🍳', name:'Cook',     cost:10, desc:'Makes meals from food automatically'},
  {id:'lookout',  icon:'👁️', name:'Lookout',  cost:15, desc:'Warns before police sweeps'},
];

// Sequential goal ladder surfaced in the HUD (checkGoals in ui.js).
// Each goal reads counters G already tracks, so progress accrues even
// before a goal becomes current; only goalIndex is new state, and it
// lives in G so it persists with the rest of the save automatically.
var GOALS = [
  {id:'survive3',   desc:'Survive 3 days',            target:3,  reward:3,  value:function(){ return G.days; }},
  {id:'craft5',     desc:'Craft 5 items',             target:5,  reward:3,  value:function(){ return G.totalCrafted; }},
  {id:'residents3', desc:'Reach 3 residents',         target:3,  reward:4,  value:function(){ return G.population; }},
  {id:'workbench',  desc:'Build the Workbench',       target:1,  reward:4,  value:function(){ return G.structures.workbench?1:0; }},
  {id:'survive14',  desc:'Survive 14 days',           target:14, reward:6,  value:function(){ return G.days; }},
  {id:'village5',   desc:'Full village: 5 residents', target:5,  reward:6,  value:function(){ return G.population; }},
  {id:'kitchen',    desc:'Build the Soup Kitchen',    target:1,  reward:8,  value:function(){ return G.structures.soup_kitchen?1:0; }},
  {id:'survive30',  desc:'Survive 30 days',           target:30, reward:10, value:function(){ return G.days; }},
  {id:'dog',        desc:'Befriend the stray dog',    target:1,  reward:5,  value:function(){ return G.dog===2?1:0; }},
  {id:'respected',  desc:'Become Respected (50 rep)', target:50, reward:8,  value:function(){ return Math.floor(G.rep||0); }},
  {id:'soup7',      desc:'Serve 7 soup nights',       target:7,  reward:6,  value:function(){ return G.soupNights||0; }},
];

var activeJobs = {};

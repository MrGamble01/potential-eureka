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
  structures: { barrel_fire:true, workbench:false, tent:false, soup_kitchen:false, garden:false, radio:false, stash:false, guitar:false, cart:false, pantry:false, coats:false, toolbox:false, compost:false, awning:false, barrel:false },

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

  // HV-11: the Underpass Mural — panels painted (0..4) and the day of
  // the last painting session (one per day).
  mural: 0, muralDay: -1,
  // HV-14: camp meetings held, and the day the circle last convened
  meetings: 0, meetingDay: -9,
  // HV-15: city petitions won at the notice board
  petitions: {},
  // HV-16: a friend's favor on the books, and the running tally
  favor: null, favorsDone: 0, lastFavorDay: -9,

  totalScavenged: 0, totalCrafted: 0, peakPopulation: 1, timesSwept: 0,
  goalIndex: 0,
  // Case Worker arc (IDEA-HV-3): 0 = not met, 1 = card left, 2 = paperwork
  // started, 3 = housed. arcDone marks the post-ending sandbox.
  arcStage: 0, arcDone: false,
  // HV-31: true once the corner fridge's ledger has counted (and
  // seeded) this camp — a genuinely fresh camp starts false.
  fridgeSeeded: false,
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
  {id:'stash',       icon:'🕳️', name:'Hidden Stash',    cost:{wood:4,scraps:3,cardboard:2},    gives:{structure:'stash'},      time:7000,  desc:'A buried cache under the fence line. Thieves and sweeps take half as much — and nobody ever finds the hole itself.', requires:'workbench'},
  {id:'guitar',      icon:'🎸', name:'Scrap Guitar',    cost:{scraps:8,wood:4},                gives:{structure:'guitar'},     time:9000,  desc:'Strings from a fence, a body from a pallet. One set a day on the corner — the take rides the camp\u2019s spirits.', requires:'workbench'},
  {id:'cart',        icon:'🛒', name:'Shopping Cart',   cost:{scraps:6,wood:2},                gives:{structure:'cart'},       time:7000,  desc:'A liberated cart with a true wheel. Makes the deposit run possible: haul every can to the redemption center in one trip.', requires:'workbench'},
  {id:'pantry',      icon:'🥣', name:'Free Pantry',     cost:{wood:6,scraps:2},                gives:{structure:'pantry'},     time:8000,  desc:'A little box on a post: take what you need, leave what you can. Some dawns the neighborhood leaves something \u2014 and a stocked pantry gets the camp remembered.', requires:'workbench'},
  {id:'coats',       icon:'🧥', name:'Coat Rack',       cost:{scraps:5,goodwill:6},            gives:{structure:'coats'},      time:9000,  desc:'Donated coats on a rail by the fire \u2014 on bitter dawns the cold cuts half as deep.', requires:'workbench'},
  {id:'toolbox',     icon:'🧰', name:'Tool Box',        cost:{scraps:6,cans:2},                gives:{structure:'toolbox'},    time:7000,  desc:'Good tools, oiled and kept \u2014 the workbench never falls apart again, and an odd job done with the right tools earns +2 goodwill on top.', requires:'workbench'},
  {id:'compost',     icon:'\u267B\uFE0F', name:'Compost Bin',     cost:{scraps:3,food:2},                gives:{structure:'compost'},    time:6000,  desc:'Scraps in, black gold out \u2014 the garden yields +1 every day it gives, and the bin\u2019s heat keeps one bed alive through frost.', requires:'workbench'},
  {id:'awning',      icon:'\u26F1\uFE0F', name:'Awning',          cost:{scraps:4,cans:2},                gives:{structure:'awning'},     time:8000,  desc:'A salvaged shop awning rigged over the corner \u2014 rain doesn\u2019t close the panhandling spot anymore.', requires:'workbench'},
  {id:'barrel',      icon:'\ud83d\udee2\ufe0f', name:'Rain Barrel',     cost:{scraps:5,cans:1},                gives:{structure:'barrel'},     time:7000,  desc:'A salvaged drum under the downspout \u2014 every rainy dawn stores a day of water (up to 3), and a stored rainfall waters the beds +1 on dry garden days.', requires:'workbench'},
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

// ── HV-16: Regulars' Favors ──────────────────────────────────
// Friendship runs both ways. Once a regular counts you as a friend,
// every few days one of them asks a small favor at dawn — cans for the
// taquería, food for Ray's bench, a scrap for Dee's bike rack. Filling
// it pays goodwill and rep; a favor left two days goes quietly unasked
// again. Only one favor sits on the books at a time.
var FAVORS = {
  marisol: { need:{cans:3},   give:{goodwill:4}, ask:'Marisol could use 3 cans for the taquería\u2019s recycling run.' },
  ray:     { need:{food:2},   give:{goodwill:3}, ask:'Old Ray hasn\u2019t eaten right in days \u2014 2 food would fix that.' },
  dee:     { need:{scraps:2}, give:{goodwill:3}, ask:'Dee\u2019s bike rack needs 2 scraps of steel.' },
};
function maybePostFavor(){
  if(G.favor || G.days - (G.lastFavorDay||-9) < 3) return;
  var friends=REGULARS.filter(function(r){ return regularStage(r.id)===2 && FAVORS[r.id]; });
  if(!friends.length) return;
  var r=friends[Math.floor(Math.random()*friends.length)];
  G.favor={who:r.id, day:G.days};
  G.lastFavorDay=G.days;
  log(r.icon+' '+FAVORS[r.id].ask);
  if(typeof buildWorkersUI==='function') buildWorkersUI();
}
function favorLapsed(){
  if(G.favor && G.days - G.favor.day >= 2){
    var r=regularDef(G.favor.who);
    log((r?r.icon+' ':'')+'The favor went quietly unasked again.');
    G.favor=null;
    if(typeof buildWorkersUI==='function') buildWorkersUI();
  }
}

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
  // HV-11: crossing into (or out of) Known changes whether the mural
  // session is offered — rebuild the action list on tier changes only.
  if(after!==before && typeof buildActionUI==='function') buildActionUI();
}

// ── HV-11: the Underpass Mural ────────────────────────────────
// A multi-day community art project on the bridge pillars. Once the
// neighborhood knows you (Known+), one painting session a day — 2
// scraps of salvaged paint each — fills one of four panels. The
// finished wall is permanent (sweeps take tents, not paint): it greets
// every morning with a little morale, and passers-by slow down for it.
var MURAL_PANELS = 4;
var MURAL_LINES = [
  'The first panel goes up: a sunrise over the bridge, in traffic-cone orange.',
  'Second panel: the camp’s barrel fire, painted bigger than life.',
  'Third panel: every regular on the block gets a face on the wall.',
  'The last panel: a door standing open. Everyone paints a piece of it.',
];
function muralAvailable(){ return repTier()>=1 && (G.mural||0)<MURAL_PANELS; }
function muralDone(){ return G.muralDay===G.days; }
function muralAction(){
  return { id:'mural', icon:'🎨', label:'Paint the mural ('+(G.mural||0)+'/'+MURAL_PANELS+')', time:7000, cooldown:0,
    tooltip:'One session a day on the underpass wall. Costs 2 scraps of salvaged paint. +3 morale, and the block takes notice.' };
}

// ── HV-14: the Camp Meeting ──────────────────────────────────
// Once the fire draws more people than just you, an evening circle
// every few days keeps the camp a village instead of strangers: every
// voice raised is morale, and everyone tosses something in the pot.
var MEETING_EVERY = 3;
function meetingAvailable(){ return (G.population||1) >= 2; }
function meetingDone(){ return G.days - (typeof G.meetingDay==='number'?G.meetingDay:-9) < MEETING_EVERY; }
function meetingAction(){
  return { id:'meeting', icon:'🗣️', label:'Hold a camp meeting', time:6000, cooldown:0,
    tooltip:'Gather everyone around the fire. +2 morale a head, a little something for the pot from each resident — and the block hears a village, not a camp.' };
}

// ── HV-19: the Busker's Guitar ───────────────────────────────
// A second street verb, earned not begged: a scrap guitar built at
// the workbench buys one set a day on the corner. The take rides the
// camp's spirits — +1 goodwill per 25 morale — doubles on a scorcher
// (foot traffic), and a good set is remembered (+1 rep) and lifts
// the player too (+2 morale).
function buskAvailable(){ return !!G.structures.guitar; }
function buskDone(){ return G.buskDay===G.days; }
function buskPay(){ var base=1+Math.floor((G.morale||0)/25); return G.weather==='heat'?base*2:base; }
function buskAction(){
  return { id:'busk', icon:'🎸', label:'Busk a set', time:6000, cooldown:0,
    tooltip:'Play for the block — one set a day. The take rides the camp\u2019s spirits (+1 goodwill per 25 morale, doubled on a scorcher), a good set is remembered (+1 rep), and playing lifts you (+2 morale).' };
}

// ── HV-20: the Cart & the Deposit Run ────────────────────────
// Cans finally have a bulk market. With a liberated cart, one run a
// day hauls EVERY can to the redemption center: 1 goodwill per 2
// cans, and the block notices industry — +1 rep per 10 cans hauled.
// Five cans minimum to be worth the walk.
var DEPOSIT_MIN = 5;
function depositAvailable(){ return !!G.structures.cart && (G.cans||0) >= DEPOSIT_MIN; }
function depositDone(){ return G.depositDay===G.days; }
function depositAction(){
  return { id:'deposit', icon:'🛒', label:'Deposit run ('+(G.cans||0)+'🫙)', time:7000, cooldown:0,
    tooltip:'Haul every can to the redemption center — 1 goodwill per 2 cans, +1 rep per 10 hauled. One run a day; '+DEPOSIT_MIN+' cans minimum.' };
}

// ── HV-18: the Cold Snap ─────────────────────────────────────
// Winter already bites; some winters bite harder. A quarter of winter
// dawns open a two-day cold snap — the fire drains faster and foot
// traffic thins — but the block shows up for a camp it respects, and
// a camp that weathers it comes out prouder.
var SNAP_DAYS = 2;          // a snap grips the block for two days
var SNAP_WARMTH = 10;       // extra warmth lost at each snap dawn
var SNAP_CHANCE = 0.25;     // rolled at every quiet winter dawn
function snapActive(){ return typeof G.snapUntil==='number' && G.snapUntil!==null && G.days < G.snapUntil; }

// ── HV-17: the Bus Ticket ────────────────────────────────────
// The village's best ending isn't a bigger camp — it's someone going
// home. Once the camp is three strong and the block calls it
// Respected, a resident opens up about family a bus ride away. The
// moment holds for a few days: buy the ticket and they go — and
// letters with a little something inside come back from the city.
var TICKET_COST_GW = 12, TICKET_COST_SCRAPS = 8;
var TICKET_ASK_DAYS = 4;    // the moment passes if the fare never comes
var TICKET_EVERY = 10;      // days before someone else opens up
var LETTER_EVERY = 6;       // a letter from the city every few days
function ticketAvailable(){ return !!G.ticketAsk; }
function ticketAction(){
  return { id:'ticket', icon:'🚌', label:'Buy the bus ticket ('+TICKET_COST_GW+'🩶 + '+TICKET_COST_SCRAPS+'🧱)', time:6000, cooldown:0,
    tooltip:'One of the residents has family a bus ride away. '+TICKET_COST_GW+' goodwill and '+TICKET_COST_SCRAPS+' scraps put them on the morning bus — a smaller camp, and a friend in the city.' };
}

// ── HV-22: the Little Free Pantry ────────────────────────────
// A box on a post by the sidewalk: take what you need, leave what
// you can. Once it's built, some dawns (half of them) a neighbor
// leaves a couple of food \u2014 and every fifth fill, the block
// remembers who keeps the box up (+1 rep).
var PANTRY_CHANCE = 0.5;
var PANTRY_FOOD = 2;
var PANTRY_REP_EVERY = 5;

// HV-23: the coat rack. Donated coats blunt the bitter dawns — the
// cold weather's bite and the snap's extra are HALVED. The season's
// base drain stays (winter is winter, coats or not), and a heat
// wave's warmth is never touched.
var COATS_CUT = 0.5;

// HV-26: the awning. Rain halves the panhandle odds (pan 0.5) --- a
// salvaged shop awning over the corner puts them back to clear-day
// odds. Rain only: cold keeps its bite, heat keeps its gift.
var AWNING_DRY = 2;

// HV-27: the rain barrel. Rain was pure weather — now it stores.
// Every rainy dawn banks a day of water (cap 3); a dry garden day
// spends one for +1 food. Frost is still the compost's fight.
var BARREL_CAP = 3;

// HV-28: the rain bet. Dee lays 5 goodwill against your 2 that
// tomorrow stays dry — you always hold the rain side. Fair-ish odds
// blind; the crafted radio (or the Lookout) turns it into a read.
var RAINBET_STAKE = 2, RAINBET_PAY = 5;

// HV-29: Marisol's garage. The insurance round's answer to the sweep:
// 2 goodwill stows the camp's loose goods across the street until the
// next sweep — the confiscation finds nothing. The stash halves
// losses forever; the garage zeroes one. Tents still fall.
var GARAGE_COST = 2;

// HV-30: the borrowed favor. Old Ray fronts 4 goodwill on the spot;
// his ledger takes one back every dawn until 5 is repaid — the extra
// one is for the trouble. He never presses on a broke morning; he
// just remembers. No new loan while one stands.
var BORROW_AMT = 4, BORROW_OWED = 5;
// HV-31: the legacy round under the bridge. The Corner Fridge lives
// in its own localStorage key OUTSIDE the save — Start Over wipes the
// camp, never the corner. 15 goodwill sets it humming, and every
// fresh camp that forms beside it starts 3 goodwill known: anyone can
// give, anyone can take. The camp's first gift that outlives the camp.
var FRIDGE_KEY = 'hv-fridge', FRIDGE_COST = 15, FRIDGE_SEED = 3;
// HV-36: the bulletin board — the second-story round. Once the
// fridge has welcomed three camps, somebody bolts a bulletin board
// to its side, and every fresh camp starts 5 goodwill known instead
// of 3. Nobody bought it. The corner earned it.
var FRIDGE_BOARD_AT = 3, FRIDGE_SEED2 = 5;
function fridgeHasBoard(){ var f=loadFridge(); return f.built && (f.camps||0) >= FRIDGE_BOARD_AT; }
// HV-39: the third-story round under the bridge — at six camps the
// fridge grows a COMMUNITY SHELF beside the board: blankets, spare
// socks, a can opener that works. Every fresh camp starts seven
// goodwill known instead of five. The corner keeps growing.
var FRIDGE_SHELF_AT = 6, FRIDGE_SEED3 = 7;
function fridgeHasShelf(){ var f=loadFridge(); return f.built && (f.camps||0) >= FRIDGE_SHELF_AT; }
// HV-37: the potluck — the festival round. When the bulletin board
// stands, every fresh camp opens with a potluck: folding tables by
// the fridge, everyone brings a dish. +4 food and +5 morale before
// the first scavenge. Potlucks tallied across camps.
var POTLUCK_KEY='hv-festival', POTLUCK_FOOD=4, POTLUCK_MORALE=5;
function loadPotluck(){
  try{ var p=JSON.parse(localStorage.getItem(POTLUCK_KEY)||'null');
    if(p&&typeof p==='object') return {days:Math.max(0,Math.floor(p.days||0))};
  }catch(e){}
  return {days:0};
}
function savePotluck(p){ try{ localStorage.setItem(POTLUCK_KEY, JSON.stringify(p)); }catch(e){} }
function fridgeSeedNow(){ return fridgeHasShelf() ? FRIDGE_SEED3 : fridgeHasBoard() ? FRIDGE_SEED2 : FRIDGE_SEED; }
function loadFridge(){
  try{ var f=JSON.parse(localStorage.getItem(FRIDGE_KEY)||'null');
    if(f&&typeof f==='object') return {built:!!f.built, camps:Math.max(0,Math.floor(f.camps||0))};
  }catch(e){}
  return {built:false, camps:0};
}
function saveFridge(f){ try{ localStorage.setItem(FRIDGE_KEY, JSON.stringify(f)); }catch(e){} }
function fridgeCamps(){ return loadFridge().camps; }
// HV-32: the record round under the bridge. The most dawns any camp
// here has ever seen lives in its own key, across every Start Over.
// The mark standing when the session opened is the bar — outlast it
// once a session and the fire feels it. The bridge keeps score.
var HVREC_KEY='hv-record', HVREC_MORALE=3;
var hvRecMark=null, hvRecRung=false;
function loadHvRec(){
  try{ var r=JSON.parse(localStorage.getItem(HVREC_KEY)||'null');
    if(r&&typeof r==='object') return {days:Math.max(0,Math.floor(r.days||0)), beats:Math.max(0,Math.floor(r.beats||0))};
  }catch(e){}
  return {days:0, beats:0};
}
function saveHvRec(r){ try{ localStorage.setItem(HVREC_KEY, JSON.stringify(r)); }catch(e){} }
// HV-38: the plaque round under the bridge — the records round comes
// back around. Three beaten holds earn the underpass wall a chalk
// star over its numbers, and every hold beaten under it spreads the
// story: neighbors leave groceries at the fence, +3 food on the
// spot. The bridge's score starts feeding the camp.
var HVSTAR_KEY='hv-plaque', HVSTAR_AT=3, HVSTAR_FOOD=3;
function loadHvStar(){
  try{ var s=JSON.parse(localStorage.getItem(HVSTAR_KEY)||'null');
    if(s&&typeof s==='object') return {cheers:Math.max(0,Math.floor(s.cheers||0))};
  }catch(e){}
  return {cheers:0};
}
function saveHvStar(s){ try{ localStorage.setItem(HVSTAR_KEY, JSON.stringify(s)); }catch(e){} }
function wallHasStar(){ return (loadHvRec().beats||0)>=HVSTAR_AT; }
// HV-33: the letters round under the bridge. Every genuinely fresh
// camp with a history to cite finds a note taped inside the corner
// fridge's door — it quotes the fridge's welcomed camps and the
// bridge's longest hold by their real numbers, and reading it lifts
// the fire.
var HVNOTE_KEY='hv-letter', HVNOTE_MORALE=2;
function loadHvNote(){
  try{ var n=JSON.parse(localStorage.getItem(HVNOTE_KEY)||'null');
    if(n&&typeof n==='object') return {read:Math.max(0,Math.floor(n.read||0))};
  }catch(e){}
  return {read:0};
}
function saveHvNote(n){ try{ localStorage.setItem(HVNOTE_KEY, JSON.stringify(n)); }catch(e){} }
function composeHvNote(){
  var fr=loadFridge(), rec=loadHvRec();
  var s='\ud83d\udcdd A note taped in the fridge door: "';
  if(fr.camps>0) s+='Camp #'+fr.camps+' to find this. ';
  if(rec.days>0) s+='Longest any of us held was '+rec.days+' dawns. ';
  s+='Take the milk, leave a story."';
  return s;
}
function deliverHvNote(){
  if(!(loadFridge().camps>0 || loadHvRec().days>0)) return;
  var n=loadHvNote();
  saveHvNote({read:(n.read||0)+1});
  G.morale=Math.min(100,(G.morale||0)+HVNOTE_MORALE);
  var s=composeHvNote();
  log(s+' (+'+HVNOTE_MORALE+'\ud83d\ude0a)');
  floatText('+'+HVNOTE_MORALE+'\ud83d\ude0a');
}
// HV-34: the almanac round under the bridge. Somebody chalked the
// numbers on the underpass wall — the fridge's camps, the longest
// hold, the notes found — and reading them out is an action like any
// other. The wall is the bridge's whole memory in one place.
var HVWALL_KEY='hv-history';
function loadHvWall(){
  try{ var w=JSON.parse(localStorage.getItem(HVWALL_KEY)||'null');
    if(w&&typeof w==='object') return {opens:Math.max(0,Math.floor(w.opens||0))};
  }catch(e){}
  return {opens:0};
}
function saveHvWall(w){ try{ localStorage.setItem(HVWALL_KEY, JSON.stringify(w)); }catch(e){} }
function bridgeHasWall(){
  return loadFridge().camps>0 || loadFridge().built || loadHvRec().days>0 || loadHvNote().read>0;
}
function composeHvWall(){
  var fr=loadFridge(), rec=loadHvRec(), nt=loadHvNote();
  var lines=[];
  lines.push(fr.built ? '\ud83e\uddca The fridge hums \u2014 '+(fr.camps||0)+' camp'+((fr.camps||0)===1?'':'s')+' welcomed' : '\ud83e\uddca No fridge on the corner yet');
  lines.push(rec.days>0 ? '\ud83d\udcc8 Longest hold: '+rec.days+' dawns (beaten '+(rec.beats||0)+' morning'+((rec.beats||0)===1?'':'s')+')' : '\ud83d\udcc8 No hold marked yet');
  lines.push('\ud83d\udcdd '+(nt.read||0)+' note'+((nt.read||0)===1?'':'s')+' found in the door');
  return lines;
}
// HV-35: the heirloom round under the bridge. Somebody's
// grandfather's thermos, left at the fridge years ago and never
// claimed. Once a session, pass it around — morale lifts by 2 base,
// +1 per longest-hold morning (to 5), +1 per note found (to 3). The
// deeper the bridge's memory, the further the coffee goes.
var THERMOS_KEY='hv-thermos', THERMOS_BASE=2;
var thermosUsed=false;
function loadThermos(){
  try{ var t=JSON.parse(localStorage.getItem(THERMOS_KEY)||'null');
    if(t&&typeof t==='object') return {uses:Math.max(0,Math.floor(t.uses||0))};
  }catch(e){}
  return {uses:0};
}
function saveThermos(t){ try{ localStorage.setItem(THERMOS_KEY, JSON.stringify(t)); }catch(e){} }
function thermosHasWarmth(){ return loadHvRec().days>0 || loadHvNote().read>0; }
// HV-40: the visitor round under the bridge — once a session,
// Marisol from the garage swings past any bridge with a story. She
// brings a casserole: 2 food base, +1 per hold beaten under the
// chalk star (cap 3). Old friends check on the camp.
var MARISOL_KEY='hv-visitor', MARISOL_BASE=2;
var marisolCame=false;
function loadMarisol(){
  try{ var m=JSON.parse(localStorage.getItem(MARISOL_KEY)||'null');
    if(m&&typeof m==='object') return {visits:Math.max(0,Math.floor(m.visits||0))};
  }catch(e){}
  return {visits:0};
}
function saveMarisol(m){ try{ localStorage.setItem(MARISOL_KEY, JSON.stringify(m)); }catch(e){} }
function marisolHasStory(){ return loadHvRec().days>0 || loadHvNote().read>0; }
function marisolDish(){ return MARISOL_BASE + Math.min(loadHvStar().cheers||0,3); }
// HV-41: the keepsake round under the bridge — after three visits,
// Marisol leaves a set of spare mugs from the garage on the shelf.
// Every thermos round with the mugs out stretches to breakfast:
// +2 food on the spot. Pays tallied in 'hv-keepsake'.
var HVKEEP_KEY='hv-keepsake', HVKEEP_FOOD=2;
function loadHvKeep(){
  try{ var k=JSON.parse(localStorage.getItem(HVKEEP_KEY)||'null');
    if(k&&typeof k==='object') return {pays:Math.max(0,Math.floor(k.pays||0))};
  }catch(e){}
  return {pays:0};
}
function saveHvKeep(k){ try{ localStorage.setItem(HVKEEP_KEY, JSON.stringify(k)); }catch(e){} }
function thermosHasMugs(){ return loadMarisol().visits>=3; }
// HV-42: the reunion round under the bridge — when the whole story
// stands (three chalk-star holds AND three of Marisol's visits),
// the camp throws the bridge reunion once a session. Everyone who
// ever slept here comes back through: 2 food base + 1 per hold + 1
// per visit (caps 3). Held tallied in 'hv-reunion'.
var HVREU_KEY='hv-reunion', HVREU_BASE=2, HVREU_PER=1;
var bridgeReunionHeld=false;
function loadHvReunion(){
  try{ var r=JSON.parse(localStorage.getItem(HVREU_KEY)||'null');
    if(r&&typeof r==='object') return {held:Math.max(0,Math.floor(r.held||0))};
  }catch(e){}
  return {held:0};
}
function saveHvReunion(r){ try{ localStorage.setItem(HVREU_KEY, JSON.stringify(r)); }catch(e){} }
function hvReunionStands(){ return (loadHvStar().cheers||0)>=3 && loadMarisol().visits>=3; }
function hvReunionDish(){
  return HVREU_BASE + HVREU_PER*Math.min(loadHvStar().cheers||0,3)
    + HVREU_PER*Math.min(loadMarisol().visits||0,3);
}
// HV-43: the portrait round under the bridge — after three Bridge
// Reunions, a snapshot from the reunion is tucked into the corner
// fridge door. Once a session a look pays: 2 food base + 1 per
// reunion held (cap 5). Looks tallied in 'hv-portrait'.
var HVSNAP_KEY='hv-portrait', HVSNAP_BASE=2, HVSNAP_PER=1;
var snapshotLooked=false;
function loadHvSnap(){
  try{ var s=JSON.parse(localStorage.getItem(HVSNAP_KEY)||'null');
    if(s&&typeof s==='object') return {looks:Math.max(0,Math.floor(s.looks||0))};
  }catch(e){}
  return {looks:0};
}
function saveHvSnap(s){ try{ localStorage.setItem(HVSNAP_KEY, JSON.stringify(s)); }catch(e){} }
function snapshotHangs(){ return loadHvReunion().held>=3; }
function snapshotDish(){ return HVSNAP_BASE + HVSNAP_PER*Math.min(loadHvReunion().held||0,5); }
// HV-44: the anniversary round under the bridge \u2014 after three
// looks at the snapshot, somebody counts the winters: the camp has
// held a whole year. Once a session a candle is lit for it: 3 food
// base + 1 per snapshot look (cap 5). Markings tallied in
// 'hv-anniversary'.
var HVANN_KEY='hv-anniversary', HVANN_BASE=3, HVANN_PER=1;
var annivMarked=false;
function loadHvAnniv(){
  try{ var a=JSON.parse(localStorage.getItem(HVANN_KEY)||'null');
    if(a&&typeof a==='object') return {toasts:Math.max(0,Math.floor(a.toasts||0))};
  }catch(e){}
  return {toasts:0};
}
function saveHvAnniv(a){ try{ localStorage.setItem(HVANN_KEY, JSON.stringify(a)); }catch(e){} }
function annivCounts(){ return loadHvSnap().looks>=3; }
function annivDish(){ return HVANN_BASE + HVANN_PER*Math.min(loadHvSnap().looks||0,5); }
// HV-45: the guest-book round under the bridge \u2014 after three
// anniversary candles, a spiral notebook sits by the fridge:
// everyone who ever slept here signs it. Once a session a
// leaf-through pays: 4 food base + 1 per candle (cap 5). Leafs
// tallied in 'hv-guestbook'.
var HVGB_KEY='hv-guestbook', HVGB_BASE=4, HVGB_PER=1;
var notebookLeafed=false;
function loadHvGb(){
  try{ var g=JSON.parse(localStorage.getItem(HVGB_KEY)||'null');
    if(g&&typeof g==='object') return {leafs:Math.max(0,Math.floor(g.leafs||0))};
  }catch(e){}
  return {leafs:0};
}
function saveHvGb(g){ try{ localStorage.setItem(HVGB_KEY, JSON.stringify(g)); }catch(e){} }
function notebookOut(){ return loadHvAnniv().toasts>=3; }
function notebookDish(){ return HVGB_BASE + HVGB_PER*Math.min(loadHvAnniv().toasts||0,5); }
function thermosPower(){
  return THERMOS_BASE + Math.min(loadHvRec().beats||0,5) + Math.min(loadHvNote().read||0,3);
}
function recordDays(d){
  var r=loadHvRec();
  if(hvRecMark===null) hvRecMark=r.days;
  if(d>r.days){ r.days=d; saveHvRec(r); }
  if(!hvRecRung && hvRecMark>0 && d>hvRecMark){
    hvRecRung=true;
    r=loadHvRec();
    var starStood=(r.beats||0)>=HVSTAR_AT;
    r.beats=(r.beats||0)+1; saveHvRec(r);
    G.morale=Math.min(100,(G.morale||0)+HVREC_MORALE);
    floatText('+'+HVREC_MORALE+'\ud83d\ude0a');
    log('\ud83d\udcc8 Day '+d+' \u2014 no camp under this bridge has ever held longer. The fire feels it.');
    // HV-38: under the chalk star, the story feeds the camp.
    if(starStood){
      var st=loadHvStar(); saveHvStar({cheers:st.cheers+1});
      G.food=(G.food||0)+HVSTAR_FOOD;
      floatText('+'+HVSTAR_FOOD+'\ud83c\udf5e');
      log('\u2b50 A hold like that under the chalk star \u2014 word gets around, and neighbors leave groceries at the fence. +'+HVSTAR_FOOD+'\ud83c\udf5e');
    }
  }
}

// HV-24: the tool box. Good tools change two small things that add
// up: the workbench never falls apart again (the daily wobble gets
// tightened instead), and the daily odd job pays a little extra.
var TOOLBOX_JOB_BONUS = 2;

// ── HV-21: the Newcomer ──────────────────────────────────────
// The mirror of the bus ticket. Once the camp is Respected and warm
// enough to share (a tent up, room by the fire), word gets around:
// every so often a newcomer stands at the edge of the light asking to
// stay. Six food and four wood make a bed and a first meal. The ask
// holds three days; the fire decides.
var NEWCOMER_COST_FOOD = 6, NEWCOMER_COST_WOOD = 4;
var NEWCOMER_ASK_DAYS = 3;
var NEWCOMER_EVERY = 9;
var NEWCOMER_POP_MAX = 6;
function newcomerAvailable(){ return !!G.newcomerAsk; }
function newcomerAction(){
  return { id:'newcomer', icon:'🫂', label:'Make room ('+NEWCOMER_COST_FOOD+'🍞 + '+NEWCOMER_COST_WOOD+'🪵)', time:6000, cooldown:0,
    tooltip:'Someone stands at the edge of the light asking to stay. '+NEWCOMER_COST_FOOD+' food and '+NEWCOMER_COST_WOOD+' wood make a bed and a first meal — a bigger camp, another pair of hands.' };
}

// ── HV-15: City Petitions ────────────────────────────────────
// Once the neighborhood counts the camp as Respected, goodwill can be
// spent at the notice board on petitions to the city — civic
// infrastructure no sweep can take and no thief can carry off.
var PETITIONS = [
  {id:'sanitation',  icon:'🚻', name:'Sanitation unit', cost:15, desc:'The city drops a portable unit by the underpass. Everyone wakes +1 health at dawn.'},
  {id:'streetlight', icon:'💡', name:'Street light',    cost:20, desc:'A working light over the camp. Thieves take half as much at night.'},
  {id:'grant',       icon:'📋', name:'Community grant', cost:30, desc:'A one-time neighborhood grant: +8 food, +8 wood, +8 scraps delivered.'},
];
function petitionsAvailable(){ return repTier()>=2; }   // Respected (50 rep)

var ACTIONS = [
  {id:'scavenge',  icon:'🗑️', label:'Scavenge Dumpster', time:5000, cooldown:8000,  tooltip:'Dig through dumpsters for scraps, cans, or food.'},
  {id:'forage',    icon:'🌿', label:'Forage Area',        time:4000, cooldown:12000, tooltip:'Search the surroundings for cardboard and wood.'},
  {id:'panhandle', icon:'🪙', label:'Panhandle',          time:6000, cooldown:15000, tooltip:'Ask strangers for change.'},
  {id:'rest',      icon:'💤', label:'Rest',               time:3000, cooldown:20000, tooltip:'Recover health and morale slightly.'},
  {id:'trade',     icon:'🤝', label:'Trade Goods',        time:2000, cooldown:18000, tooltip:'Trade cans for food (3 cans → 2 food).'},
  {id:'rainbet',   icon:'🎲', label:'Rain Bet',           time:2000, cooldown:30000, tooltip:'Dee’s 5 goodwill against your 2 that tomorrow stays dry. You take the rain side — one bet a day. A radio is the whole edge.'},
  {id:'garage',    icon:'🚙', label:'Garage Favor',       time:2000, cooldown:30000, tooltip:'2 goodwill stows the camp’s loose goods in Marisol’s garage till the next sweep — when it comes, the confiscation finds nothing. Tents still fall.'},
  {id:'borrow',    icon:'🤲', label:'Borrow from Ray',    time:2000, cooldown:30000, tooltip:'Old Ray fronts 4 goodwill on the spot; his ledger takes one back every dawn until 5 is repaid. He never presses — he remembers.'},
  {id:'fridge',    icon:'🧊', label:'Corner Fridge',      time:4000, cooldown:30000, tooltip:'15 goodwill sets a donated fridge humming on the corner — anyone can give, anyone can take. It isn’t the camp’s: Start Over can’t unplug it, and every fresh camp that forms beside it starts 3 goodwill known.'},
  {id:'wall',      icon:'🧱', label:'Read the Wall',      time:2000, cooldown:30000, tooltip:'Somebody chalked the bridge’s numbers on the underpass wall — the fridge’s camps, the longest hold, the notes found. Read them out to whoever’s around.'},
  {id:'thermos',   icon:'🫖', label:'Pass the Thermos',   time:2000, cooldown:30000, tooltip:'Somebody’s grandfather’s thermos, left at the fridge years ago and never claimed. Pass it around once a session — the deeper the bridge’s memory, the further the coffee goes.'},
  {id:'marisol',   icon:'🚗', label:'Wave Marisol Down',  time:2000, cooldown:30000, tooltip:'Marisol from the garage swings past once a session — wave her down and she leaves a casserole. The dish grows with the chalk star’s story.'},
  {id:'reunion',   icon:'🎂', label:'Throw the Reunion',  time:2000, cooldown:30000, tooltip:'When the whole story stands — the chalk star’s holds and Marisol’s visits — the camp throws the bridge reunion once a session, and everyone who ever slept here comes back through with something for the pot.'},
  {id:'snapshot',  icon:'📷', label:'Look at the Snapshot', time:2000, cooldown:30000, tooltip:'A snapshot from the bridge reunion, tucked into the fridge door. Look at it once a session — somebody in the frame always swings by with a little something after.'},
  {id:'anniv',     icon:'🕯️', label:'Mark the Anniversary', time:2000, cooldown:30000, tooltip:'Three looks at the snapshot and somebody counts the winters — the camp has held a whole year under this bridge. Light a candle for it once a session, and the bridge remembers who kept it lit.'},
  {id:'guestbook', icon:'📓', label:'Leaf the Notebook', time:2000, cooldown:30000, tooltip:'Three candles and a spiral notebook sits by the fridge — everyone who ever slept here signs it on the way through. Leaf through it once a session, and one of the names always left something behind.'},
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
  {id:'mural',      desc:'Finish the community mural',target:4,  reward:8,  value:function(){ return G.mural||0; }},
  {id:'meet3',      desc:'Hold 3 camp meetings',      target:3,  reward:5,  value:function(){ return G.meetings||0; }},
  {id:'petition1',  desc:'Win a city petition',       target:1,  reward:6,  value:function(){ return Object.keys(G.petitions||{}).length; }},
  {id:'favor3',     desc:'Do 3 favors for friends',   target:3,  reward:5,  value:function(){ return G.favorsDone||0; }},
  {id:'ticket1',    desc:'Send someone home',         target:1,  reward:10, value:function(){ return G.ticketsSent||0; }},
  {id:'snap2',      desc:'Weather 2 cold snaps',      target:2,  reward:8,  value:function(){ return G.snapsSurvived||0; }},
  {id:'busk5',      desc:'Play 5 sets on the corner', target:5,  reward:6,  value:function(){ return G.busks||0; }},
  {id:'deposit3',   desc:'Make 3 deposit runs',       target:3,  reward:5,  value:function(){ return G.deposits||0; }},
  {id:'welcome2',   desc:'Welcome 2 newcomers',       target:2,  reward:5,  value:function(){ return G.welcomes||0; }},
  {id:'pantry10',   desc:'See the pantry filled 10 times', target:10, reward:5, value:function(){ return G.pantryFills||0; }},
  {id:'coldcut6',   desc:'Blunt 6 cold dawns with the coat rack', target:6, reward:5, value:function(){ return G.coldCut||0; }},
  {id:'bench5',     desc:'Tighten the workbench back up 5 times', target:5, reward:5, value:function(){ return G.benchSaves||0; }},
  {id:'compost8',   desc:'Feed the beds through 8 garden days', target:8, reward:5, value:function(){ return G.compostDays||0; }},
  {id:'awning5',    desc:'Earn 5 rainy-day coins under the awning', target:5, reward:5, value:function(){ return G.awningSaves||0; }},
  {id:'barrel6',    desc:'Water the beds from the barrel 6 times', target:6, reward:5, value:function(){ return G.barrelDays||0; }},
  {id:'rainbet3',   desc:'Win 3 rain bets against Dee', target:3, reward:6, value:function(){ return G.rainBetsWon||0; }},
  {id:'garage2',    desc:'Ride out 2 sweeps covered by Marisol\u2019s garage', target:2, reward:6, value:function(){ return G.garageSaves||0; }},
  {id:'borrow2',    desc:'Repay 2 of Ray\u2019s loans in full', target:2, reward:6, value:function(){ return G.rayLoans||0; }},
  {id:'fridge2',    desc:'See the corner fridge welcome 2 fresh camps', target:2, reward:8, value:function(){ return fridgeCamps(); }},
  {id:'record2',    desc:'Outlast the bridge\u2019s old mark on 2 different mornings', target:2, reward:6, value:function(){ return loadHvRec().beats; }},
  {id:'letters2',   desc:'Find the fridge-door note at 2 fresh camps', target:2, reward:5, value:function(){ return loadHvNote().read; }},
  {id:'wall2',      desc:'Read the writing on the wall out loud twice', target:2, reward:5, value:function(){ return loadHvWall().opens; }},
  {id:'thermos2',   desc:'Pass the old thermos around on 2 sessions', target:2, reward:5, value:function(){ return loadThermos().uses; }},
  {id:'marisol2',   desc:'Wave Marisol down on 2 sessions', target:2, reward:5, value:function(){ return loadMarisol().visits; }},
  {id:'mugs2',      desc:'Pour from Marisol’s spare mugs on 2 sessions', target:2, reward:5, value:function(){ return loadHvKeep().pays; }},
  {id:'reunion2',   desc:'Throw the bridge reunion on 2 sessions', target:2, reward:5, value:function(){ return loadHvReunion().held; }},
  {id:'snapshot2',  desc:'Look at the reunion snapshot on 2 sessions', target:2, reward:5, value:function(){ return loadHvSnap().looks; }},
  {id:'anniv2',     desc:'Mark the bridge anniversary on 2 sessions', target:2, reward:5, value:function(){ return loadHvAnniv().toasts; }},
  {id:'guest2',     desc:'Leaf through the spiral notebook on 2 sessions', target:2, reward:5, value:function(){ return loadHvGb().leafs; }},
  {id:'board3',     desc:'See the fridge earn its bulletin board (3 camps welcomed)', target:3, reward:5, value:function(){ return loadFridge().built ? loadFridge().camps : 0; }},
  {id:'shelf6',     desc:'See the fridge grow its community shelf (6 camps welcomed)', target:6, reward:5, value:function(){ return loadFridge().built ? loadFridge().camps : 0; }},
  {id:'potluck3',   desc:'Open three fresh camps with a potluck', target:3, reward:5, value:function(){ return loadPotluck().days; }},
  {id:'star3',      desc:'Beat the longest hold three times under the chalk star', target:3, reward:5, value:function(){ return loadHvStar().cheers; }},
];

var activeJobs = {};

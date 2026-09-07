// HV-271: the last save string this page wrote or loaded. The leave-save
// in main.js compares the key against it and stands down when another
// writer (a second tab on the same camp, the hub's Reset progress, a
// hand edit) has changed the key since — a page you are leaving must not
// stomp the one you kept playing in.
var hvLastWrite = null;
function saveGame(){
  try{ var s=JSON.stringify(G); localStorage.setItem(SAVE_KEY, s); hvLastWrite=s; }catch(e){}
}

function loadGame(){
  try{
    var raw = localStorage.getItem(SAVE_KEY);
    hvLastWrite = raw;
    if(raw){ Object.assign(G, JSON.parse(raw)); }
    // HV-62: tickDay subtracts 1 and calls onNewDay once a frame while
    // timeOfDay >= 1. A hostile save (50, Infinity, NaN, -1) therefore
    // either burns a dawn per frame until the camp dies, or paints a
    // broken day bar. Park anything outside [0, 1) at dawn — do not
    // modulo; that would pick a random hour.
    if(typeof G.timeOfDay!=='number' || !isFinite(G.timeOfDay) || G.timeOfDay<0 || G.timeOfDay>=1){
      G.timeOfDay=0;
    }
    if(!G.activeCrafts||typeof G.activeCrafts!=='object') G.activeCrafts={}; // saves from before crafts were persisted
    if(!G.cooldowns||typeof G.cooldowns!=='object') G.cooldowns={};
    // HV-272: cooldowns and in-flight crafts are absolute Date.now()
    // stamps. A device clock that ran ahead and got corrected leaves
    // every stamp hours or years out — every action button greys with
    // no message for as long as the skew, and a paid-for craft never
    // lands. Same family as the HV-62 clock clamp above. Cap each
    // cooldown at now + that action's own cooldown (dynamic actions
    // fall back to the longest, 30s), drop junk, park a craft that
    // claims to start in the future at now, and cap its duration at
    // the recipe's own time. Legal stamps are left alone.
    var _skewNow=Date.now(), _cdMax={};
    ACTIONS.forEach(function(a){ _cdMax[a.id]=a.cooldown; });
    Object.keys(G.cooldowns).forEach(function(id){
      var v=G.cooldowns[id], cap=_skewNow+(typeof _cdMax[id]==='number'?_cdMax[id]:30000);
      if(typeof v!=='number'||!isFinite(v)) delete G.cooldowns[id];
      else if(v>cap) G.cooldowns[id]=cap;
    });
    Object.keys(G.activeCrafts).forEach(function(id){
      var j=G.activeCrafts[id], r=RECIPES.find(function(x){ return x.id===id; });
      if(!j||typeof j!=='object'||!r){ delete G.activeCrafts[id]; return; }
      if(typeof j.start!=='number'||!isFinite(j.start)||j.start>_skewNow) j.start=_skewNow;
      if(typeof j.duration!=='number'||!isFinite(j.duration)||j.duration>r.time) j.duration=r.time;
    });
    if(typeof G.goalIndex!=='number'||G.goalIndex<0) G.goalIndex=0; // saves from before the goal ladder
    if(typeof G.arcStage!=='number'||G.arcStage<0) G.arcStage=0;    // saves from before the Case Worker arc
    G.arcDone=!!G.arcDone;
    // A save written mid-warning restores sweepWarned:true, but the timer
    // that would fire the sweep died with the old tab — leaving it set
    // blocks every future lookout warning for the rest of the save.
    G.sweepWarned=false; G.packedUp=false;
    if(!WEATHERS[G.weather]) G.weather='clear';                    // saves from before HV-5
    if(G.forecast!==null&&!WEATHERS[G.forecast]) G.forecast=null;
    if(typeof G.structures.radio==='undefined') G.structures.radio=false;
    if(typeof G.structures.stash==='undefined') G.structures.stash=false;    // saves from before HV-12
    if(typeof G.dog!=='number'||G.dog<0||G.dog>2){ G.dog=0; }      // saves from before HV-6
    if(typeof G.dogMetDay!=='number') G.dogMetDay=0;
    G.dogHungry=!!G.dogHungry;
    if(!G.regulars||typeof G.regulars.marisol!=='number'){          // saves from before HV-7
      G.regulars={marisol:0,ray:0,dee:0};
    }
    if(typeof G.lastDeeDay!=='number') G.lastDeeDay=-9;
    if(typeof G.oddJobDay!=='number') G.oddJobDay=-1;              // saves from before HV-8
    if(typeof G.rep!=='number'||G.rep<0||G.rep>100) G.rep=0;       // saves from before HV-9
    if(typeof G.repGiftDay!=='number') G.repGiftDay=-1;
    if(typeof G.soupNights!=='number') G.soupNights=0;             // saves from before HV-10
    if(typeof G.mural!=='number'||G.mural<0||G.mural>4) G.mural=0; // saves from before HV-11
    if(typeof G.muralDay!=='number') G.muralDay=-1;
    if(typeof G.meetings!=='number') G.meetings=0;                 // saves from before HV-14
    if(typeof G.meetingDay!=='number') G.meetingDay=-9;
    if(!G.petitions||typeof G.petitions!=='object') G.petitions={}; // saves from before HV-15
    if(G.favor&&(typeof G.favor.who!=='string'||!FAVORS[G.favor.who])) G.favor=null; // saves from before HV-16
    if(typeof G.favorsDone!=='number') G.favorsDone=0;
    if(typeof G.lastFavorDay!=='number') G.lastFavorDay=-9;
    if(typeof G.ticketsSent!=='number') G.ticketsSent=0;           // saves from before HV-17
    if(typeof G.ticketLastDay!=='number') G.ticketLastDay=-9;
    if(typeof G.lastLetterDay!=='number') G.lastLetterDay=-9;
    if(G.ticketAsk&&typeof G.ticketAsk.day!=='number') G.ticketAsk=null;
    if(typeof G.snapUntil!=='number') G.snapUntil=null;             // saves from before HV-18
    if(typeof G.snapsSurvived!=='number') G.snapsSurvived=0;
    if(typeof G.structures.guitar!=='boolean') G.structures.guitar=false; // saves from before HV-19
    if(typeof G.busks!=='number') G.busks=0;
    if(typeof G.buskDay!=='number') G.buskDay=-9;
    if(typeof G.structures.cart!=='boolean') G.structures.cart=false; // saves from before HV-20
    if(typeof G.deposits!=='number') G.deposits=0;
    if(typeof G.depositDay!=='number') G.depositDay=-9;
    if(typeof G.welcomes!=='number') G.welcomes=0; // saves from before HV-21
    if(typeof G.newcomerLastDay!=='number') G.newcomerLastDay=-9;
    if(typeof G.structures.pantry!=='boolean') G.structures.pantry=false; // saves from before HV-22
    if(typeof G.pantryFills!=='number') G.pantryFills=0;
    if(typeof G.structures.coats!=='boolean') G.structures.coats=false; // saves from before HV-23
    if(typeof G.coldCut!=='number') G.coldCut=0;
    if(typeof G.structures.toolbox!=='boolean') G.structures.toolbox=false; // saves from before HV-24
    if(typeof G.benchSaves!=='number') G.benchSaves=0;
    if(typeof G.structures.compost!=='boolean') G.structures.compost=false; // saves from before HV-25
    if(typeof G.compostDays!=='number') G.compostDays=0;
    if(typeof G.structures.awning!=='boolean') G.structures.awning=false; // saves from before HV-26
    if(typeof G.awningSaves!=='number') G.awningSaves=0;
    if(typeof G.structures.barrel!=='boolean') G.structures.barrel=false; // saves from before HV-27
    if(typeof G.barrelWater!=='number') G.barrelWater=0;
    if(typeof G.barrelDays!=='number') G.barrelDays=0;
    if(typeof G.rainBetOn!=='boolean') G.rainBetOn=false; // saves from before HV-28
    if(typeof G.rainBetDay!=='number') G.rainBetDay=-9;
    if(typeof G.rainBetsWon!=='number') G.rainBetsWon=0;
    if(typeof G.garageCover!=='boolean') G.garageCover=false; // saves from before HV-29
    if(typeof G.garageSaves!=='number') G.garageSaves=0;
    if(typeof G.rayDebt!=='number') G.rayDebt=0; // saves from before HV-30
    if(typeof G.rayLoans!=='number') G.rayLoans=0;
    if(typeof G.fridgeSeeded!=='boolean') G.fridgeSeeded=true;     // saves from before HV-31 were never fresh camps to count
    if(G.newcomerAsk && typeof G.newcomerAsk.day!=='number') G.newcomerAsk=null;
    if(typeof G.friendDay!=='number') G.friendDay=-1; // saves from before HV-65
  }catch(e){}
}

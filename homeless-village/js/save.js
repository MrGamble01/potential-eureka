function saveGame(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(G)); }catch(e){}
}

function loadGame(){
  try{
    var raw = localStorage.getItem(SAVE_KEY);
    if(raw){ Object.assign(G, JSON.parse(raw)); }
    if(!G.activeCrafts) G.activeCrafts={}; // saves from before crafts were persisted
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
  }catch(e){}
}

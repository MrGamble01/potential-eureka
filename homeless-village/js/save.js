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
    if(typeof G.dog!=='number'||G.dog<0||G.dog>2){ G.dog=0; }      // saves from before HV-6
    if(typeof G.dogMetDay!=='number') G.dogMetDay=0;
    G.dogHungry=!!G.dogHungry;
    if(!G.regulars||typeof G.regulars.marisol!=='number'){          // saves from before HV-7
      G.regulars={marisol:0,ray:0,dee:0};
    }
    if(typeof G.lastDeeDay!=='number') G.lastDeeDay=-9;
  }catch(e){}
}
